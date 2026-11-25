// 竞彩足球分析内核 v8
// 去水（比例 + Shin 双口径）/ Dixon-Coles / 共识 λ（16+ 家即时欧赔）/ 独立强度模型 / 自适应融合 / 纪律与红牌 / ρ 与置信闸门 / 逐场预测 / 回测 / 串关 / 传足复式优化
// 零依赖，可直接 node 运行（内置自检样例）；也可整段粘进 Exec 沙盒执行。
//
// v8 相对 v7.2 的变化（2026-11-21）：
//  1. Shin 去水：在比例去水之上按内幕交易比例 z 校正 favorite-longshot 偏差，热门概率上修、
//     冷门下修；与比例法并排输出（devigCmp），差异 >2pp 的场次在报告中标注。
//  2. 共识拟合改用 Shin 口径（fitFromConsensus / fit2D / fitFromZJQ 内部统一）。
//  3. σ 拆解：σ = σ_market(0.10 + 共识离散度) + σ_team(0.30/√有效场次)，量级与 v7 对齐但可追溯。
//  4. 新增传足层（sfcCoverage / sfcPlan / sfcPick）：胜负彩 14 场与任九的复式覆盖概率、
//     贪心注数分配、稳胆/博胆/双选/全包分级；不改变单场概率，只做组合优化。
//
// v7 相对 v6 的变化（历史记录）：
//  1. 独立层强制可追踪：team 缺失时输出 degraded=true，禁止把市场复述包装成「模型边际」；
//     k 仍随庄家数收缩，但 degraded 场次的 EV/推荐全部降级为观察。
//  2. 独立层升级：主客分离样本 + 近因半衰期加权（250 天）+ 场地样本不足回退 + 休息天数疲劳修正。
//  3. 共识层新增离散度 consSD：庄家分歧越大，置信区间越宽，推荐所需边际越高。
//  4. 纪律层 v2：裁判红牌率 + 球队近一年红牌率（按样本加权）+ 球员情绪/停赛人工风险输入；
//     输出 P(红牌) 与「某侧吃红后」的情景概率，红牌风险高的深盘直接否决。
//  5. 新增 ρ 敏感性闸门：EV 在 ρ ∈ {0,-0.05,-0.10,-0.15} 必须同号且为正才可推荐（SKILL 铁律 14）。
//  6. 推荐层收紧：EV ≥ +3% 且 边际 ≥ 2.5pp 且 ρ 稳定；赔率 < 1.35 一律不推荐；
//     单关关闭（single=0）的单场不产出「小注/主推」，只能标为串关腿并给出组合 EV 警告。

const RHO = -0.10;      // Dixon-Coles 低比分相关修正
const RHO_SET = [0, -0.05, -0.10, -0.15];
const MIN_ODDS = 1.35;  // 低于此赔率在 13.9% 抽水下结构性负 EV，不做单场推荐
const MIN_EV = 0.03;    // 推荐最低模型 EV
const MIN_EDGE = 0.025; // 推荐最低概率边际（模型 − 隐含）
const K_SHRINK = 8;     // 强度评级收缩常数：p/(p+K)
const K_BLEND = 0.35;   // 独立模型与共识模型的默认融合权重
const K_SHRINK_BOOKS = 10; // 共识庄家数低于此值时 k 向市场模型收缩
const SIDE = ['主胜', '平局', '客胜'];

function factorial(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
function num(x) { const v = Number(x); return Number.isFinite(v) ? v : null; }

// ---------- 1. 去水 ----------
// P(i) = (1/odds_i) / Σ(1/odds_j)；m 为 margin（小数）
function devig(odds) {
  const inv = odds.map((x) => 1 / x);
  const s = inv.reduce((a, b) => a + b, 0);
  return { p: inv.map((x) => x / s), m: s - 1, overround: s, method: 'proportional' };
}

// v8：Shin 去水（Shin 1993）。比例法假设庄家只在全池收水；Shin 额外假设一部分是内幕交易，
// 能把「热门被高估、冷门被低估」的 favorite-longshot 偏差校正回来。竞彩 13.9% 抽水下差异可达 1–3pp。
// 解 z ∈ [0,0.5)：Σ [√(z² + 4(1−z)·π_i²/S) − z] / (2(1−z)) = 1，π_i = 1/odds_i，S = Σπ。
function devigShin(odds) {
  const pi = odds.map((x) => 1 / x);
  const S = pi.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(S) || S <= 1 || odds.some((x) => !Number.isFinite(x) || x <= 1)) return devig(odds);
  const f = (z) => pi.reduce((a, x) => a + (Math.sqrt(z * z + 4 * (1 - z) * x * x / S) - z) / (2 * (1 - z)), 0);
  let lo = 0, hi = 0.49;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 1) lo = mid; else hi = mid;
  }
  const z = (lo + hi) / 2;
  const p = pi.map((x) => (Math.sqrt(z * z + 4 * (1 - z) * x * x / S) - z) / (2 * (1 - z)));
  const s2 = p.reduce((a, b) => a + b, 0);
  return { p: p.map((x) => x / s2), z, m: S - 1, overround: S, method: 'shin' };
}

// 两种去水并排输出，供报告披露「口径差异」
function devigBoth(odds) {
  const a = devig(odds), b = devigShin(odds);
  return { ratio: a.p, shin: b.p, z: b.z || 0, diff: b.p.map((x, i) => (x - a.p[i]) * 100), m: a.m };
}

// ---------- 2. 比分网格 ----------
function grid(lambdaTotal, w, rho = RHO) {
  const lh = lambdaTotal * w, la = lambdaTotal * (1 - w), N = 12;
  const ph = [], pa = [];
  for (let k = 0; k < N; k++) {
    ph.push(Math.exp(-lh) * Math.pow(lh, k) / factorial(k));
    pa.push(Math.exp(-la) * Math.pow(la, k) / factorial(k));
  }
  const cells = []; let s = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let t = 1;
      if (i === 0 && j === 0) t = 1 - lh * la * rho;
      else if (i === 1 && j === 0) t = 1 + la * rho;
      else if (i === 0 && j === 1) t = 1 + lh * rho;
      else if (i === 1 && j === 1) t = 1 - rho;
      let p = ph[i] * pa[j] * t;
      if (p < 0) p = 0;
      cells.push([i, j, p]); s += p;
    }
  }
  cells.forEach((c) => (c[2] /= s));
  return { lh, la, cells };
}

function summarize(g) {
  let H = 0, D = 0, A = 0, o25 = 0, btts = 0;
  for (const [i, j, p] of g.cells) {
    if (i > j) H += p; else if (i === j) D += p; else A += p;
    if (i + j > 2.5) o25 += p;
    if (i > 0 && j > 0) btts += p;
  }
  return { H, D, A, o25, btts };
}

function topScores(g, n = 6) {
  return g.cells.slice().sort((a, b) => b[2] - a[2]).slice(0, n);
}

// 总进球桶：0,1,2,3,4,5,6,7+
function goalBuckets(g) {
  const b = new Array(8).fill(0);
  for (const [i, j, p] of g.cells) b[Math.min(i + j, 7)] += p;
  return b;
}

// 总进球区间：0-1 / 2-3 / 4-6 / 7+
function goalIntervals(g) {
  const b = goalBuckets(g);
  return {
    '0-1': b[0] + b[1],
    '2-3': b[2] + b[3],
    '4-6': b[4] + b[5] + b[6],
    '7+': b[7],
  };
}

// 让球盘三项概率：net = 主进球 - 客进球 + hc
function rqProb(g, hc) {
  let H = 0, D = 0, A = 0;
  for (const [i, j, p] of g.cells) {
    const net = i - j + hc;
    if (net > 0) H += p; else if (net === 0) D += p; else A += p;
  }
  return [H, D, A];
}

// 半全场：上下半场各分一半 λ，枚举上下半场比分后按 9 项归并
function hafu(g) {
  const pois = (l, k) => Math.exp(-l) * Math.pow(l, k) / factorial(k);
  const one = (l) => [pois(l, 0), pois(l, 1), pois(l, 2), 1 - pois(l, 0) - pois(l, 1) - pois(l, 2)];
  const fh = one(g.lh / 2), sh = one(g.lh / 2);
  const fa = one(g.la / 2), sa = one(g.la / 2);
  const out = {};
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) for (let d = 0; d < 4; d++) {
    const p = fh[a] * fa[b] * sh[c] * sa[d];
    const r1 = a > b ? 2 : a === b ? 1 : 0;             // 上半场结果
    const r2 = a + c > b + d ? 2 : a + c === b + d ? 1 : 0;  // 全场结果
    const key = `${r1}${r2}`;
    out[key] = (out[key] || 0) + p;
  }
  const s = Object.values(out).reduce((x, y) => x + y, 0);
  for (const k of Object.keys(out)) out[k] /= s;
  return out;
}

// ---------- 3. 市场映像：由盘口反解 λ 与 w ----------
function fitFromZJQ(zjqOdds, spfOdds) {
  const z = devigShin(zjqOdds.map(Number));
  const lambdaTotal = -Math.log(Math.max(z.p[0], 1e-9));
  const target = devigShin(spfOdds).p;
  let best = { w: 0.5, sse: Infinity, g: null };
  for (let w = 0.15; w <= 0.85; w += 0.0025) {
    const g = grid(lambdaTotal, w), s = summarize(g);
    const sse = (s.H - target[0]) ** 2 + (s.D - target[1]) ** 2 + (s.A - target[2]) ** 2;
    if (sse < best.sse) best = { w, sse, g };
  }
  return { lambdaTotal, w: best.w, sse: best.sse, grid: best.g, source: 'market' };
}

// v6 L1 共识 λ：16+ 家即时欧赔均值去水后拟合 λ 与偏斜（对齐 SKILL v5）
// consEU: [h,d,a] 均赔；consP: [h,d,a] 去水概率（可选，缺省由 consEU 去水）
// w 由比分网格对 consP 的 SSE 最小化；λ 由总进球网格 + consP 联合拟合（2D 搜索）
function fitFromConsensus(consEU, consP) {
  if (!consEU) return null;
  const target = consP ? consP.slice() : devigShin(consEU).p;
  let best = { lambdaTotal: 2.6, w: 0.5, sse: Infinity, g: null };
  for (let lt = 1.2; lt <= 5.6; lt += 0.02) {
    for (let w = 0.15; w <= 0.85; w += 0.005) {
      const g = grid(lt, w), s = summarize(g);
      const sse = (s.H - target[0]) ** 2 + (s.D - target[1]) ** 2 + (s.A - target[2]) ** 2;
      if (sse < best.sse) best = { lambdaTotal: lt, w, sse, g };
    }
  }
  return { ...best, source: 'consensus' };
}

// v6 自适应融合权重：k 随共识庄家数收缩
// n < 10 → k×0.5；10 ≤ n < 16 → k×0.75；n ≥ 16 → 全额 k
function adaptiveK(nBooks, base = K_BLEND) {
  if (!nBooks || nBooks < K_SHRINK_BOOKS) return base * 0.5;
  if (nBooks < 16) return base * 0.75;
  return base;
}

function fit2D(spfOdds) {
  const target = devigShin(spfOdds).p;
  let best = { lambdaTotal: 2.8, w: 0.5, sse: Infinity, g: null };
  for (let lt = 1.6; lt <= 5.2; lt += 0.02) {
    for (let w = 0.2; w <= 0.8; w += 0.01) {
      const g = grid(lt, w), s = summarize(g);
      const sse = (s.H - target[0]) ** 2 + (s.D - target[1]) ** 2 + (s.A - target[2]) ** 2;
      if (sse < best.sse) best = { lambdaTotal: lt, w, sse, g };
    }
  }
  return { ...best, source: 'market' };
}

// ---------- 4. 独立强度模型（比率法 + 收缩 + 近因加权 + 疲劳） ----------
// team: {home:{home:{gf,ga,p}, form:{gf,ga,p}, meta:{daysRest,fallback}}, away:{away:{...}, form, meta}}
// gf/ga 为近因加权（半衰期 250 天）后的场均；p 为加权有效场次
function teamStrength(home, away, form) {
  if (!home || !away || !home.home || !away.away) return null;
  const rate = (gf, p) => (p > 0 ? gf / p : null);
  const hg = rate(home.home.gf, home.home.p), hga = rate(home.home.ga, home.home.p);
  const ag = rate(away.away.gf, away.away.p), aga = rate(away.away.ga, away.away.p);
  if (hg === null || ag === null) return null;

  // 联赛基准：用「主队主场场均进球」与「客队客场场均失球」互相印证
  const lgHome = (hg + aga) / 2;
  const lgAway = (ag + hga) / 2;

  const shrink = (x, p) => 1 + (x - 1) * (p / (p + K_SHRINK));
  const attH = shrink(hg / lgHome, home.home.p);
  const defH = shrink(hga / lgAway, home.home.p);
  const attA = shrink(ag / lgAway, away.away.p);
  const defA = shrink(aga / lgHome, away.away.p);

  let lamH = lgHome * attH * defA;
  let lamA = lgAway * attA * defH;

  // 近 6 场状态修正：只作用于总进球，权重 0.15，且必须有样本
  let formFactor = 1;
  if (form && form.home && form.away && form.home.p >= 4 && form.away.p >= 4) {
    const fh = (form.home.gf / form.home.p) * 0.6 + (form.home.ga / form.home.p) * 0.4;
    const fa = (form.away.gf / form.away.p) * 0.6 + (form.away.ga / form.away.p) * 0.4;
    const ratioH = fh / ((home.home.gf / home.home.p) * 0.6 + (home.home.ga / home.home.p) * 0.4 || 1);
    const ratioA = fa / ((away.away.gf / away.away.p) * 0.6 + (away.away.ga / away.away.p) * 0.4 || 1);
    formFactor = 1 + 0.15 * (((ratioH + ratioA) / 2) - 1);
    lamH *= 1 + 0.15 * (ratioH - 1);
    lamA *= 1 + 0.15 * (ratioA - 1);
  }

  // 疲劳：休息 <4 天，每少一天进攻 −1.2%，下限 −7%；≥4 天不修正
  const restH = home.meta && Number.isFinite(home.meta.daysRest) ? home.meta.daysRest : 7;
  const restA = away.meta && Number.isFinite(away.meta.daysRest) ? away.meta.daysRest : 7;
  const fatigueH = clamp(1 - 0.012 * Math.max(0, 4 - restH), 0.93, 1);
  const fatigueA = clamp(1 - 0.012 * Math.max(0, 4 - restA), 0.93, 1);
  lamH *= fatigueH;
  lamA *= fatigueA;

  lamH = clamp(lamH, 0.25, 4.5); lamA = clamp(lamA, 0.2, 4.2);
  const lamTotal = lamH + lamA, share = lamH / lamTotal;
  return {
    lambdaTotal: lamTotal, w: share, lamH, lamA, formFactor, source: 'team',
    components: { lgHome, lgAway, attH, defH, attA, defA },
    fatigue: { home: fatigueH, away: fatigueA, restH, restA },
    venueFallback: !!(home.meta && home.meta.fallback) || !!(away.meta && away.meta.fallback),
    sample: { home: home.home.p, away: away.away.p },
  };
}

// 融合：市场映像与独立模型按权重 k 线性混合 λ，w 以市场为主（市场对强弱分配更准）
// v7.1：位移封顶——联赛 ±0.35 球 / ±0.04 份额；杯赛与国际赛 ±0.25 球 / ±0.02 份额。
//   独立层用于「温和修正」，不允许跨联赛/小样本把市场总进球或强弱分配整体推翻（新加坡 vs 巴拉圭的教训）。
function blendModels(market, team, k = K_BLEND, caps) {
  if (!market && !team) return null;
  if (!team) return { ...market, blendK: 0, degraded: true, degradedReason: '独立强度层缺失（无主客分离历史），模型=共识复述' };
  if (!market) return { ...team, blendK: 1, degraded: true, degradedReason: '共识欧赔缺失，仅独立层' };
  const capLam = (caps && caps.lam) || 0.35;
  const capShare = (caps && caps.share) || 0.04;
  const rawTot = (team.lambdaTotal - market.lambdaTotal) * k;
  const rawShare = (team.w - market.w) * k * 0.5;
  const dTot = clamp(rawTot, -capLam, capLam);
  const dShare = clamp(rawShare, -capShare, capShare);
  const lam = market.lambdaTotal + dTot;
  const w = clamp(market.w + dShare, 0.12, 0.88);
  return {
    lambdaTotal: lam, w, blendK: k, source: 'blend',
    capped: Math.abs(rawTot) > capLam || Math.abs(rawShare) > capShare,
    market, team, grid: grid(lam, w),
  };
}

// ---------- 4.5 纪律层 v2：红牌风险 / 摩擦指数（可观测代理，披露制） ----------
// 输入 row.discipline（捷报裁判页 + 球队近一年纪律统计，可查源）：
//   refH/refA: 裁判对主/客队口径的场均红牌（样本 n=refN）
//   teamRedH/teamRedA: 球队近一年本侧场均红牌（样本 teamN_H/N_A）
//   refYellowH/refYellowA, teamYellowH/teamYellowA: 同口径场均黄牌
//   playerRiskH/playerRiskA: 关键球员情绪/停赛人工风险，单位=额外期望红牌（0~0.2，须有新闻源）
//   rivalry: 德比/宿敌标记（只抬高摩擦指数，不直接改 λ）
// 机制：λ_red = 0.45·裁判 + 0.35·球队（样本≥5才启用）+ 0.20·球员风险，按可用项归一；
//   P(吃红)=1−exp(−λ_red)；期望修正 −0.40·T·P(己方吃红) + 0.30·T·P(对方吃红)，T=0.42，封顶 ±0.18。
// 情绪本身不可查询——这里只用纪律数据做代理，新闻只进文字层。
function disciplineLayer(disc) {
  if (!disc) return null;
  const refH = num(disc.refH), refA = num(disc.refA);
  const teamH = num(disc.teamRedH), teamA = num(disc.teamRedA);
  const nH = num(disc.teamN_H) || 0, nA = num(disc.teamN_A) || 0;
  const playerH = num(disc.playerRiskH) || 0, playerA = num(disc.playerRiskA) || 0;

  let lamH = 0, wh = 0, lamA = 0, wa = 0;
  if (refH !== null) { lamH += 0.45 * refH; wh += 0.45; }
  if (teamH !== null && nH >= 5) { lamH += 0.35 * teamH; wh += 0.35; }
  if (playerH > 0) { lamH += 0.20 * playerH; wh += 0.20; }
  if (refA !== null) { lamA += 0.45 * refA; wa += 0.45; }
  if (teamA !== null && nA >= 5) { lamA += 0.35 * teamA; wa += 0.35; }
  if (playerA > 0) { lamA += 0.20 * playerA; wa += 0.20; }
  if (wh > 0) lamH /= wh;
  if (wa > 0) lamA /= wa;
  if (wh === 0 && wa === 0) return null;

  const pRedH = 1 - Math.exp(-Math.max(lamH, 0));
  const pRedA = 1 - Math.exp(-Math.max(lamA, 0));
  const T = 0.42, SELF = 0.40, OPP = 0.30;
  const adjH = clamp(-SELF * T * pRedH + OPP * T * pRedA, -0.18, 0.18);
  const adjA = clamp(-SELF * T * pRedA + OPP * T * pRedH, -0.18, 0.18);

  const yellowH = 0.5 * (num(disc.refYellowH) ?? 0) + 0.5 * (num(disc.teamYellowH) ?? 0);
  const yellowA = 0.5 * (num(disc.refYellowA) ?? 0) + 0.5 * (num(disc.teamYellowA) ?? 0);
  const yAvg = (yellowH + yellowA) / 2;
  const rAvg = (lamH + lamA) / 2;
  const friction = Math.round(clamp((yAvg - 1.30) / 1.50 * 45 + (rAvg - 0.06) / 0.15 * 35 + (disc.rivalry ? 20 : 0), 0, 100));
  const frictionLabel = friction >= 70 ? '高摩擦' : friction >= 50 ? '偏紧' : '正常';

  return {
    lamRedH: lamH, lamRedA: lamA, pRedH, pRedA, adjH, adjA,
    hot: friction >= 70,
    yellowH, yellowA, friction, frictionLabel,
    refName: disc.refName || null, refN: disc.refN || null,
    sources: disc.sources || null,
  };
}

// 红牌情景：给定「某侧吃红」条件概率（红牌平均发生在 60'，作用时长 T=0.42）
// 己方进攻 ×(1−0.40·T)，对方进攻 ×(1+0.30·T)
function redScenario(lamH, lamA, pRedH, pRedA) {
  if (pRedH <= 0 && pRedA <= 0) return null;
  const T = 0.42;
  const base = summarize(grid(lamH + lamA, lamH / (lamH + lamA), RHO));
  const cond = (redHome) => {
    const lh = lamH * (redHome ? 1 - 0.40 * T : 1 + 0.30 * T);
    const la = lamA * (redHome ? 1 + 0.30 * T : 1 - 0.40 * T);
    return summarize(grid(lh + la, lh / (lh + la), RHO));
  };
  const hRed = cond(true), aRed = cond(false);
  const rest = Math.max(0, 1 - pRedH - pRedA);
  const expected = {
    H: rest * base.H + pRedH * hRed.H + pRedA * aRed.H,
    D: rest * base.D + pRedH * hRed.D + pRedA * aRed.D,
    A: rest * base.A + pRedH * hRed.A + pRedA * aRed.A,
  };
  return { baseline: base, homeRed: hRed, awayRed: aRed, expected };
}

// ---------- 4.6 ρ 敏感性闸门（SKILL 铁律 14） ----------
// 同一组 λ 在 ρ ∈ {0,-0.05,-0.10,-0.15} 复算；EV 必须全部同号且为正才可推荐
function probAt(lamH, lamA, rho, market, sel, hc) {
  const g = grid(lamH + lamA, lamH / (lamH + lamA), rho);
  if (market === 'spf') {
    const s = summarize(g);
    return [s.H, s.D, s.A][sel];
  }
  if (market === 'rq') {
    const r = rqProb(g, hc);
    return r[sel];
  }
  if (market === 'btts') {
    const s = summarize(g);
    return sel === 0 ? s.btts : 1 - s.btts;
  }
  return null;
}

function rhoGate(lamH, lamA, market, sel, odds, hc) {
  if (!odds) return null;
  const evs = RHO_SET.map((rho) => {
    const p = probAt(lamH, lamA, rho, market, sel, hc);
    return p === null ? null : p * odds - 1;
  }).filter((x) => x !== null);
  if (!evs.length) return null;
  const evMin = Math.min(...evs), evMax = Math.max(...evs);
  return { evs, evMin, evMax, stablePositive: evMin > 0, stableNegative: evMax < 0, stable: evMin > 0 || evMax < 0 };
}

// ---------- 4.7 置信区间：λ 不确定性（独立层样本+共识离散度）× ρ 极值 ----------
function probBand(lamH, lamA, sigma, market, sel, hc) {
  const vals = [];
  for (const d of [-sigma, 0, sigma]) {
    for (const rho of [0, -0.15]) {
      const lh = clamp(lamH + d, 0.15, 5), la = clamp(lamA - d, 0.15, 5);
      const p = probAt(lh, la, rho, market, sel, hc);
      if (p !== null) vals.push(p);
    }
  }
  if (!vals.length) return null;
  return [Math.min(...vals), Math.max(...vals)];
}

function confidence(lamH, lamA, sigma) {
  const out = [];
  for (let sel = 0; sel < 3; sel++) out.push(probBand(lamH, lamA, sigma, 'spf', sel, null));
  return out;
}

// ---------- 4.8 盘口位移（只披露方向，不重复计入 λ——即时盘已在共识内） ----------
function movementLayer(row) {
  if (!row.consEU_open || !row.consEU) return null;
  const po = devig(row.consEU_open).p, pl = devig(row.consEU).p;
  const d = pl.map((x, i) => (x - po[i]) * 100);
  const absMax = Math.max(...d.map(Math.abs));
  const steam = d.indexOf(Math.max(...d));
  return { dH: d[0], dD: d[1], dA: d[2], absMax, steam, side: SIDE[steam], moved: absMax >= 4 };
}

// ---------- 5. 逐场综合预测 ----------
// row: {
//   no, lg, home, away, kickoff, hc,
//   spf:[h,d,a] | null, rq:[h,d,a] | null, supSPF:[h,d,a] | null,
//   zjq:[8] | null, open:[h,d,a] | null,
//   consEU:[h,d,a] | null, consP:[h,d,a] | null, consSD:[sdH,sdD,sdA] | null, nBooks:int | null,
//   consEU_open:[h,d,a] | null,
//   team:{home:{home:{gf,ga,p}, form, meta}, away:{away:{gf,ga,p}, form, meta}, form} | null,
//   discipline:{ refH, refA, teamRedH, teamRedA, teamN_H, teamN_A, refYellowH, refYellowA,
//                teamYellowH, teamYellowA, playerRiskH, playerRiskA, rivalry, refName, refN } | null,
//   injuryAdj:{home,away} | null, single:0|1
// }
function isCup(lg) { return /杯|友谊|国际赛|锦标|欧国联|世预|附加/.test(lg || ''); }

function predictMatch(row) {
  const out = { no: row.no, lg: row.lg, home: row.home, away: row.away, hc: row.hc, kickoff: row.kickoff };
  // 优先共识 λ（L1），无共识时回退竞彩拟合
  const mk = row.consEU ? fitFromConsensus(row.consEU, row.consP)
    : row.spf && row.zjq ? fitFromZJQ(row.zjq, row.spf)
    : row.spf ? fit2D(row.spf) : null;
  const tm = row.team ? teamStrength(row.team.home, row.team.away, row.team.form) : null;
  // k 随庄家数自适应；杯赛/国际赛 0.25，联赛 0.35
  const cup = isCup(row.lg);
  const kBase = row.blendK === undefined ? adaptiveK(row.nBooks, cup ? 0.25 : K_BLEND) : row.blendK;
  const bl = blendModels(mk, tm, kBase, cup ? { lam: 0.25, share: 0.02 } : { lam: 0.35, share: 0.04 });
  if (!bl) return { ...out, ok: false, reason: '缺少共识欧赔与胜平负赔率，无法拟合 λ' };

  // 伤停/停赛人工裁定（须有源）
  const adj = row.injuryAdj || { home: 0, away: 0 };
  // 纪律层 v2：红牌风险（自动、可复算）
  const disc = disciplineLayer(row.discipline);
  const lamH = clamp(bl.lambdaTotal * bl.w + (adj.home || 0) + (disc ? disc.adjH : 0), 0.2, 4.8);
  const lamA = clamp(bl.lambdaTotal * (1 - bl.w) + (adj.away || 0) + (disc ? disc.adjA : 0), 0.15, 4.5);
  const lamTotal = lamH + lamA, w = lamH / lamTotal;
  const g = grid(lamTotal, w);
  const s = summarize(g);
  const buckets = goalBuckets(g);
  const intervals = goalIntervals(g);
  const rq = row.hc === null || row.hc === undefined ? null : rqProb(g, row.hc);
  const eu = row.spf ? devigShin(row.spf) : null;
  const euCmp = row.spf ? devigBoth(row.spf) : null;

  // λ 不确定性（v8 拆解）：
  //   σ_market = 0.10 基础噪声 + 共识离散度（庄家分歧越大越大，封顶 +0.08）
  //   σ_team   = 0.30/√(独立层有效场次)，样本 <4 场取 0.14 上限；缺独立层不计此项、另加 0.15
  // 量级与 v7 的 0.16–0.19 对齐，但每一项都可追溯。
  const sdMean = row.consSD ? row.consSD.reduce((a, b) => a + b, 0) / 3 : null;
  const sampleSum = tm && tm.sample ? tm.sample.home + tm.sample.away : 0;
  const sigmaMarket = 0.10 + (sdMean !== null ? clamp((sdMean - 0.006) * 8, 0, 0.08) : 0.02);
  const sigmaTeam = tm ? clamp(0.30 / Math.sqrt(Math.max(sampleSum, 4)), 0.04, 0.14) : 0;
  const sigma = sigmaMarket + sigmaTeam + (bl.degraded ? 0.15 : 0);

  const red = disc ? redScenario(lamH, lamA, disc.pRedH, disc.pRedA) : null;
  const move = movementLayer(row);
  const conf = confidence(lamH, lamA, sigma);

  const res = {
    ...out, ok: true,
    lambdaTotal: lamTotal, w, lamH, lamA,
    injuryAdj: adj,
    discipline: disc,
    redScenario: red,
    movement: move,
    degraded: !!bl.degraded, degradedReason: bl.degradedReason || null,
    blendK: bl.blendK, blendCapped: !!bl.capped, modelSource: bl.source,
    consLambda: row.consEU ? (mk && mk.source === 'consensus' ? mk.lambdaTotal : null) : null,
    consW: row.consEU ? (mk && mk.source === 'consensus' ? mk.w : null) : null,
    consEU: row.consEU || null, consP: row.consP || null, consSD: row.consSD || null, nBooks: row.nBooks || 0,
    marketLambda: mk ? mk.lambdaTotal : null, marketW: mk ? mk.w : null,
    teamLambda: tm ? tm.lambdaTotal : null, teamW: tm ? tm.w : null,
    teamComponents: tm ? tm.components : null, teamSample: tm ? tm.sample : null,
    fatigue: tm ? tm.fatigue : null, venueFallback: tm ? tm.venueFallback : null,
    sigma: +sigma.toFixed(3),
    sigmaParts: { market: +sigmaMarket.toFixed(3), team: +sigmaTeam.toFixed(3) },
    confidence: conf,
    single: row.single === 1,
    probs: {
      H: s.H, D: s.D, A: s.A, o25: s.o25, btts: s.btts,
      rq: rq, hafu: hafu(g),
    },
    devig: eu ? eu.p : null, margin: eu ? eu.m : null,
    devigMethod: eu ? eu.method : null,
    devigCmp: euCmp ? { ratio: euCmp.ratio, shin: euCmp.shin, z: +euCmp.z.toFixed(4), diff: euCmp.diff.map((x) => +x.toFixed(2)) } : null,
    supSPF: row.supSPF || null,
    delta: eu && row.supSPF ? row.supSPF.map((x, i) => x - 100 * eu.p[i]) : null,
    scores: topScores(g, 6).map(([h, a, p]) => ({ h, a, p })),
    buckets, intervals,
    forecast: buildForecast(s, buckets, intervals, g),
    verdict: verdictFromPrediction(row, s, eu, rq, g, buckets, bl.degraded),
    rec: buildRecommendation(row, s, eu, rq, buckets, {
      lamH, lamA, disc, degraded: !!bl.degraded, movement: move, sigma, confidence: conf, capped: !!bl.capped,
    }),
  };
  return res;
}

// 综合预测：按可靠度从高到低排列（胜平负 > 总进球区间 > 比分）
function buildForecast(s, buckets, intervals, g) {
  const spfPick = s.H >= s.D && s.H >= s.A ? '主胜' : s.D >= s.A ? '平局' : '客胜';
  const spfP = Math.max(s.H, s.D, s.A);
  const ivMax = Object.entries(intervals).sort((a, b) => b[1] - a[1])[0];
  const ouLine = s.o25 >= 0.5 ? '大 2.5' : '小 2.5';
  const tops = topScores(g, 5);
  return {
    spf: spfPick, spfP,
    goals: ivMax[0], goalsP: ivMax[1],
    ou: ouLine, ouP: s.o25 >= 0.5 ? s.o25 : 1 - s.o25,
    btts: s.btts >= 0.5 ? '是' : '否', bttsP: s.btts >= 0.5 ? s.btts : 1 - s.btts,
    scores: tops.map(([h, a, p]) => ({ s: `${h}-${a}`, p })),
    scoresCum: tops.slice(0, 5).reduce((x, c) => x + c[2], 0),
  };
}

// ---------- 6. 逐场判定（按回测修正） ----------
// 修正要点：
//  a) 冷端 Δ ≤ -8pp 不再直接给「小注」——33 场回测显示其实际兑现 30.0%，仅比隐含 26.3% 高 3.7pp，
//     落在噪声内。只有「模型与去水同向背离人气」才升级。
//  b) 支持率第一方向 ≠ 去水第一方向 时，一律采信去水方向（回测 3/3）。
//  c) 热端 Δ ≥ +15pp 仍标回避，但理由是价格不含补偿，不是「会输」。
function verdictFromPrediction(row, s, eu, rqP, g, buckets, degraded) {
  const model = [s.H, s.D, s.A];
  const modelPick = model.indexOf(Math.max(...model));
  if (degraded) {
    return { level: '观望', pick: '不参与', reason: '独立强度层缺失：模型退化为共识复述，不具备定价优势' };
  }

  // 仅让球盘在售
  if (!eu) {
    const d = row.rq ? devigShin(row.rq) : null;
    if (!d) return { level: '中性', pick: '不参与', reason: '无可用盘口' };
    const dl = row.supRQ ? row.supRQ.map((x, i) => x - 100 * d.p[i]) : [0, 0, 0];
    const mx = Math.max(...dl), fav = dl.indexOf(mx);
    if (mx >= 15) return { level: '回避', pick: `让球盘 ${SIDE[fav]} ${row.rq[fav].toFixed(2)}`,
      reason: `人气 +${mx.toFixed(0)}pp，价格无补偿；模型让球 ${(rqP ? rqP[fav] * 100 : NaN).toFixed(1)}%` };
    if (rqP) {
      const bi = rqP.indexOf(Math.max(...rqP));
      const ev = rqP[bi] * row.rq[bi] - 1;
      if (ev > 0.02) return { level: '关注', pick: `让球盘 ${SIDE[bi]} ${row.rq[bi].toFixed(2)}（模型倾向，非方案）`,
        reason: `模型 ${(rqP[bi] * 100).toFixed(1)}% vs 隐含 ${(d.p[bi] * 100).toFixed(1)}%，EV +${(ev * 100).toFixed(1)}%${row.single === 1 ? '' : '；单关关闭，方案层不执行'}` };
    }
    return { level: '观望', pick: '不参与',
      reason: `仅让球盘在售，模型 ${(rqP ? Math.max(...rqP) * 100 : d.p[0] * 100).toFixed(1)}% 对隐含 ${(d.p[0] * 100).toFixed(1)}%` };
  }

  const dl = row.supSPF ? row.supSPF.map((x, i) => x - 100 * eu.p[i]) : [0, 0, 0];
  const md = model.map((p, i) => (p - eu.p[i]) * 100);
  const devPick = eu.p.indexOf(Math.max(...eu.p));
  const supPick = row.supSPF ? row.supSPF.indexOf(Math.max(...row.supSPF)) : devPick;
  const diverge = row.supSPF && devPick !== supPick;

  // 分歧：采信去水方向
  if (diverge) {
    const gap = Math.abs(dl[supPick]);
    return { level: '关注', pick: `${SIDE[devPick]} ${row.spf[devPick].toFixed(2)}`,
      reason: `资金在${SIDE[supPick]}（Δ${dl[supPick] >= 0 ? '+' : ''}${dl[supPick].toFixed(0)}pp）与定价相反，回测中此类场次定价方 3/3 命中，采信定价` };
  }

  const mx = Math.max(...dl);
  const hotIdx = dl.indexOf(mx), coldIdx = dl.indexOf(Math.min(...dl));
  const maxMd = Math.max(...md.map(Math.abs));

  // 热端 + 模型不支撑 → 回避
  if (mx >= 15 && modelPick !== hotIdx) {
    return { level: '回避', pick: `${SIDE[hotIdx]} ${row.spf[hotIdx].toFixed(2)}`,
      reason: `人气 +${mx.toFixed(0)}pp，模型仅 ${(model[hotIdx] * 100).toFixed(1)}% 低于去水 ${(eu.p[hotIdx] * 100).toFixed(1)}%，价格不含补偿` };
  }
  // 冷端 + 模型同向 → 关注
  if (dl[coldIdx] <= -8 && modelPick === coldIdx && maxMd >= 2) {
    const ev = model[coldIdx] * row.spf[coldIdx] - 1;
    return { level: '关注', pick: `${SIDE[coldIdx]} ${row.spf[coldIdx].toFixed(2)}`,
      reason: `缺口 ${dl[coldIdx].toFixed(0)}pp 且模型同向（${(model[coldIdx] * 100).toFixed(1)}% vs 去水 ${(eu.p[coldIdx] * 100).toFixed(1)}%），EV ${(ev * 100 >= 0 ? '+' : '')}${(ev * 100).toFixed(1)}%` };
  }
  // 定价有效
  if (maxMd <= 3) {
    return { level: '观望', pick: '不参与',
      reason: `模型与去水偏差 ${maxMd.toFixed(1)}pp，定价有效；人气最大偏离 ${mx >= 0 ? '+' : ''}${mx.toFixed(0)}pp` };
  }
  return { level: '中性', pick: '不参与',
    reason: `模型偏差 ${maxMd.toFixed(1)}pp（${SIDE[modelPick]} 方向），人气 Δ ${mx.toFixed(0)}pp，无结构性错价` };
}

// ---------- 6b. 购买方案层 v7 ----------
// 只推荐同时通过以下闸门的选项：
//   赔率 ≥1.35（13.9% 抽水下短赔结构性负 EV）
//   EV ≥ +3%、模型边际 ≥ 2.5pp
//   ρ ∈ {0,-0.05,-0.10,-0.15} 下 EV 全部为正（防模型伪影）
//   非 degraded（独立层缺失 → 无定价优势）
//   深盘（|hc|≥2）且热门侧 P(红牌) ≥12% → 否决
// 单关关闭（single=0）时，只把最优选项标为「串关腿」，不产出小注/主推。
function buildRecommendation(row, s, eu, rqP, buckets, ctx) {
  const SIDE3 = ['主胜', '平局', '客胜'];
  const modelP = [s.H, s.D, s.A];
  const modelPick = modelP.indexOf(Math.max(...modelP));
  const devPick = eu ? eu.p.indexOf(Math.max(...eu.p)) : null;
  const devProb = eu ? eu.p[devPick] : null;
  const delta = eu && row.supSPF ? row.supSPF.map((x, i) => x - 100 * eu.p[i]) : null;
  const deltaMax = delta ? Math.max(...delta) : 0;
  const hotIdx = delta ? delta.indexOf(deltaMax) : -1;
  const disc = ctx && ctx.disc;
  const degraded = !!(ctx && ctx.degraded);
  const single = row.single === 1;
  const redMax = disc ? Math.max(disc.pRedH, disc.pRedA) : 0;
  const cup = isCup(row.lg);
  const capped = !!(ctx && ctx.capped);

  const focus = deltaMax >= 15 || redMax >= 0.15
    || Math.max(0, ...(row.injuryAdj ? [Math.abs(row.injuryAdj.home || 0), Math.abs(row.injuryAdj.away || 0)] : [0])) >= 0.2
    || !!(ctx && ctx.movement && ctx.movement.moved);

  const notes = [];
  const cands = [];

  const add = (market, sel, odds, p, impl) => {
    if (!odds || !Number.isFinite(odds) || !Number.isFinite(p) || !Number.isFinite(impl)) return;
    const ev = p * odds - 1, edge = p - impl;
    const gate = rhoGate(ctx.lamH, ctx.lamA, market, sel, odds, row.hc);
    cands.push({
      market, sel, play: market === 'spf' ? '胜平负' : '让球胜平负',
      pick: SIDE3[sel], odds, p, impl, ev, edge,
      rho: gate,
    });
  };

  if (eu) {
    const d = devigShin(row.spf);
    for (let i = 0; i < 3; i++) add('spf', i, row.spf[i], modelP[i], d.p[i]);
  }
  if (rqP && row.rq) {
    const d = devigShin(row.rq);
    for (let i = 0; i < 3; i++) add('rq', i, row.rq[i], rqP[i], d.p[i]);
  }

  const fails = [];
  const sigma = ctx && ctx.sigma ? ctx.sigma : 0.2;
  const pass = cands.filter((c) => {
    if (c.odds < MIN_ODDS) { fails.push(`${c.play} ${c.pick} 赔率 ${c.odds.toFixed(2)} < ${MIN_ODDS}`); return false; }
    if (c.ev < MIN_EV) return false;
    if (c.edge < MIN_EDGE) return false;
    // 置信闸门：边际必须超过 λ 不确定性的半宽，否则是模型噪声
    const band = probBand(ctx.lamH, ctx.lamA, sigma, c.market, c.sel, row.hc);
    if (band) {
      const half = (band[1] - band[0]) / 2;
      c.band = band; c.half = half;
      if (c.edge <= half) { fails.push(`${c.play} ${c.pick} 边际 ${(c.edge * 100).toFixed(1)}pp ≤ 置信半宽 ${(half * 100).toFixed(1)}pp（λ±${sigma.toFixed(2)}）`); return false; }
    }
    if (!c.rho || !c.rho.stablePositive) { fails.push(`${c.play} ${c.pick} EV 随 ρ 翻转（${c.rho ? (c.rho.evMin * 100).toFixed(1) : '?'}% ~ ${c.rho ? (c.rho.evMax * 100).toFixed(1) : '?'}%）`); return false; }
    if (c.market === 'rq' && row.hc !== null && Math.abs(row.hc) >= 2) {
      const favSide = row.hc < 0 ? 0 : 2; // 让球方为让球侧（简化：主让看主，客让看客）
      const pRedFav = favSide === 0 ? (disc ? disc.pRedH : 0) : (disc ? disc.pRedA : 0);
      if (pRedFav >= 0.12) { fails.push(`深盘让球被红牌风险否决（热门侧 P(红) ${(pRedFav * 100).toFixed(1)}%）`); return false; }
    }
    // 跨赛事让球盘：独立层被位移封顶，说明历史样本与当前对手强度不可比，让球盘不推荐
    if (c.market === 'rq' && cup && capped) {
      fails.push(`${c.play} ${c.pick}：跨赛事独立层被封顶（样本与当前对手强度不可比），让球盘不推荐`);
      return false;
    }
    return true;
  });
  pass.sort((a, b) => b.ev - a.ev);

  let level = '观察';
  let best = pass[0] || null;

  if (degraded) {
    level = '回避';
    notes.push('独立强度层缺失：模型=共识复述，不具备定价优势，不产出投注建议');
  } else if (!best) {
    const near = cands.slice().sort((a, b) => b.ev - a.ev)[0];
    level = '观察';
    notes.push(near
      ? `无可过闸门选项：最优 ${near.play} ${near.pick} @${near.odds.toFixed(2)}，模型 EV ${(near.ev * 100 >= 0 ? '+' : '')}${(near.ev * 100).toFixed(1)}%、边际 ${(near.edge * 100).toFixed(1)}pp，未达 EV +3%/边际 2.5pp`
      : '无可用盘口');
  } else if (!single) {
    level = '观察';
    notes.push(`单关关闭：本场无单关可投；${best.play} ${best.pick} 仅可作串关腿（EV ${(best.ev * 100 >= 0 ? '+' : '')}${(best.ev * 100).toFixed(1)}%），串关须合并计算并标注复利抽水风险`);
  } else {
    level = best.ev >= 0.08 && best.edge >= 0.05 ? '主推' : '小注';
  }

  // 深盘提示（无论是否推荐）
  if (row.hc !== null && row.hc !== undefined && Math.abs(row.hc) >= 2) {
    const side = row.hc < 0 ? '主队' : '客队';
    notes.push(`${side}让 ${Math.abs(row.hc)} 球需净胜 ${Math.abs(row.hc) + 1} 球以上；模型让球 ${(rqP ? rqP[0] * 100 : NaN).toFixed(1)}% / ${(rqP ? rqP[1] * 100 : NaN).toFixed(1)}% / ${(rqP ? rqP[2] * 100 : NaN).toFixed(1)}%`);
  }
  // 红牌/摩擦披露
  if (disc) {
    notes.push(`纪律层：P(主红) ${(disc.pRedH * 100).toFixed(1)}%、P(客红) ${(disc.pRedA * 100).toFixed(1)}%，摩擦指数 ${disc.friction}（${disc.frictionLabel}）${disc.refName ? '，裁判 ' + disc.refName : ''}`);
    if (redMax >= 0.15) notes.push(`红牌风险偏高：${disc.pRedH >= disc.pRedA ? '主队' : '客队'}吃红概率 ${(redMax * 100).toFixed(1)}%，相关让球/大小盘不追`);
  }
  if (ctx && ctx.movement && ctx.movement.moved) {
    notes.push(`初盘→即时共识位移 ${ctx.movement.side} ${ctx.movement.absMax.toFixed(1)}pp（只披露方向，不重复计入 λ）`);
  }
  if (row.injuryAdj && (Math.abs(row.injuryAdj.home || 0) + Math.abs(row.injuryAdj.away || 0)) > 0) {
    notes.push(`伤停/停赛人工修正：主 ${(row.injuryAdj.home || 0).toFixed(2)}、客 ${(row.injuryAdj.away || 0).toFixed(2)}（须有源）`);
  }

  const plays = [];
  const rqLabel = (sel) => {
    if (row.hc === null || row.hc === undefined) return SIDE3[sel];
    if (sel === 0) return `主胜（${row.home} ${row.hc >= 0 ? '+' : ''}${row.hc}）`;
    if (sel === 2) return `客胜（${row.away} ${-row.hc >= 0 ? '+' : ''}${-row.hc}）`;
    return `让球平（${row.home} ${row.hc >= 0 ? '+' : ''}${row.hc}）`;
  };
  if (best) {
    plays.push({
      play: best.play, pick: best.pick, odds: best.odds, p: best.p, ev: best.ev, edge: best.edge,
      impl: best.impl,
      market: best.market,
      pickLabel: best.market === 'rq' ? rqLabel(best.sel) : best.pick,
      handicap: best.market === 'rq' ? row.hc : null,
      rho: best.rho, stake: single ? (level === '主推' ? '主推（1–2%）' : '小注（0.5–1%）') : '串关腿（单关关闭，组合须另算）',
    });
    // 让球盘与胜平负方向不同时，必须把「盘口不同」讲清楚，避免读成「模型自相矛盾」
    if (best.market === 'rq' && best.sel !== modelPick) {
      notes.push(`注意：这是让球盘 ${rqLabel(best.sel)}，不是胜平负。本场胜平负模型方向为${SIDE3[modelPick]} ${(modelP[modelPick] * 100).toFixed(1)}%——让球盘看的是让球后的结果，强队赢 1 球仍可能输盘。`);
    }
  }

  const summary = plays.length
    ? `${level}：${plays.map((p) => `${p.play} ${p.pickLabel || p.pick} @${p.odds.toFixed(2)}（EV ${(p.ev * 100 >= 0 ? '+' : '')}${(p.ev * 100).toFixed(1)}%，${p.stake}）`).join('；')}`
    : `${level}：本场不参与`;

  return { level, focus, plays, notes, summary, single, failed: fails.slice(0, 3), candidates: cands.length };
}

// ---------- 7. 回测校准 ----------
// preds: predictMatch 的输出数组；results: { 编号: [主进球, 客进球] }
function backtest(preds, results) {
  const acc = {
    n: 0, noData: 0,
    spf_model: [0, 0], spf_devig: [0, 0], spf_sup: [0, 0],
    ou: [0, 0], rq: [0, 0], btts: [0, 0],
    goalsBucket: [0, 0], goalsInterval: [0, 0],
    scoreTop1: [0, 0], scoreTop3: [0, 0], scoreTop5: [0, 0],
    expDevig: 0, expModel: 0,
  };
  const rows = [];
  for (const p of preds) {
    const r = results[p.no];
    if (!r) { acc.noData++; continue; }
    const [gh, ga] = r;
    const act = gh > ga ? 0 : gh === ga ? 1 : 2;
    const tot = gh + ga;
    acc.n++;
    const mIdx = [p.probs.H, p.probs.D, p.probs.A].indexOf(Math.max(p.probs.H, p.probs.D, p.probs.A));
    const dIdx = p.devig.indexOf(Math.max(...p.devig));
    acc.spf_model[mIdx === act ? 0 : 1]++;
    acc.spf_devig[dIdx === act ? 0 : 1]++;
    acc.expDevig += p.devig[dIdx];
    acc.expModel += [p.probs.H, p.probs.D, p.probs.A][mIdx];
    if (p.supSPF) {
      const sIdx = p.supSPF.indexOf(Math.max(...p.supSPF));
      acc.spf_sup[sIdx === act ? 0 : 1]++;
    }
    const ouPick = p.probs.o25 >= 0.5 ? 1 : 0;
    acc.ou[(tot > 2.5 ? 1 : 0) === ouPick ? 0 : 1]++;
    const bPick = p.probs.btts >= 0.5 ? 1 : 0;
    acc.btts[(gh > 0 && ga > 0 ? 1 : 0) === bPick ? 0 : 1]++;
    if (p.probs.rq && p.hc !== null && p.hc !== undefined) {
      const net = gh + p.hc - ga;
      const ra = net > 0 ? 0 : net === 0 ? 1 : 2;
      const rp = p.probs.rq.indexOf(Math.max(...p.probs.rq));
      acc.rq[rp === ra ? 0 : 1]++;
    }
    const bIdx = Math.min(tot, 7);
    acc.goalsBucket[p.buckets.indexOf(Math.max(...p.buckets)) === bIdx ? 0 : 1]++;
    const ivMax = Object.entries(p.intervals).sort((a, b) => b[1] - a[1])[0][0];
    const hitIv = (ivMax === '0-1' && tot <= 1) || (ivMax === '2-3' && tot >= 2 && tot <= 3)
      || (ivMax === '4-6' && tot >= 4 && tot <= 6) || (ivMax === '7+' && tot >= 7);
    acc.goalsInterval[hitIv ? 0 : 1]++;
    const sc = `${gh}-${ga}`;
    acc.scoreTop1[p.scores[0] && `${p.scores[0].h}-${p.scores[0].a}` === sc ? 0 : 1]++;
    acc.scoreTop3[p.scores.slice(0, 3).some((x) => `${x.h}-${x.a}` === sc) ? 0 : 1]++;
    acc.scoreTop5[p.scores.slice(0, 5).some((x) => `${x.h}-${x.a}` === sc) ? 0 : 1]++;
    rows.push({ no: p.no, score: sc, act: SIDE[act], tot,
      model: SIDE[mIdx], devig: SIDE[dIdx], force: act === mIdx, ou: ouPick === (tot > 2.5 ? 1 : 0) });
  }
  const rate = (a) => (a[0] + a[1] > 0 ? a[0] / (a[0] + a[1]) : null);
  return {
    rows, n: acc.n,
    hit: {
      spf_model: rate(acc.spf_model), spf_devig: rate(acc.spf_devig), spf_sup: rate(acc.spf_sup),
      ou: rate(acc.ou), rq: rate(acc.rq), btts: rate(acc.btts),
      goalsBucket: rate(acc.goalsBucket), goalsInterval: rate(acc.goalsInterval),
      scoreTop1: rate(acc.scoreTop1), scoreTop3: rate(acc.scoreTop3), scoreTop5: rate(acc.scoreTop5),
    },
    counts: acc,
    devigCalibration: { meanImplied: acc.expDevig / (acc.n || 1), meanModel: acc.expModel / (acc.n || 1) },
  };
}

// ---------- 8. EV 与串关 ----------
function ev(p, odds) { return p * odds - 1; }

// 串关：n 腿联乘。注意 p × odds 恒接近 1/(1+margin)
function combo(legs) {
  const p = legs.reduce((a, l) => a * l.p, 1);
  const odds = legs.reduce((a, l) => a * l.odds, 1);
  return { odds, p, ev: p * odds - 1 };
}

// ---------- 9. 传足（胜负彩 14 场 / 任九）复式优化器（v8 新增） ----------
// 思路：每场三选概率来自同一模型（融合 λ + 伤停 + 纪律），不另做一套。
// 复式选择的本质是「用注数换覆盖」：注数 = Π(每场选择数)，覆盖概率用独立卷积精确计算。
// 目标函数按「一等奖（全中）」为主、「二等奖（≥13 场）」为辅，贪心分配双选，直到预算用尽。
// 注意：这不是提高 EV——彩票返奖率固定，复式只降低「全错」的方差，不改变负期望本质。
function sfcCoverage(probs, sets) {
  let dist = [1];
  for (let i = 0; i < probs.length; i++) {
    const cover = clamp(sets[i].reduce((a, s) => a + probs[i][s], 0), 0, 1);
    const nd = new Array(dist.length + 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      nd[k] += dist[k] * (1 - cover);
      nd[k + 1] += dist[k] * cover;
    }
    dist = nd;
  }
  const tickets = sets.reduce((a, s) => a * s.length, 1);
  const tail = (from) => dist.slice(from).reduce((a, b) => a + b, 0);
  return {
    dist, tickets,
    pAll: dist[dist.length - 1] || 0,
    pAlmost: tail(Math.max(0, probs.length - 1)),
  };
}

// matches: [{ no, home, away, p:[pH,pD,pA], marketP?:[pH,pD,pA] }]
// budgets: 可用注数档位（1 注 2 元）
function sfcPlan(matches, budgets = [16, 64, 128]) {
  const probs = matches.map((m) => m.p);
  const n = probs.length;
  const order = probs.map((p) => p.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]));
  const baseSets = order.map((o) => [o[0]]);
  const baseCov = sfcCoverage(probs, baseSets);
  const baseline = { sets: baseSets.map((s) => s.slice()), ...baseCov, cost: baseCov.tickets * 2 };

  const plans = [];
  for (const budget of budgets) {
    let sets = baseSets.map((s) => s.slice());
    let cur = sfcCoverage(probs, sets);
    for (let guard = 0; guard < 60; guard++) {
      let best = null;
      for (let i = 0; i < n; i++) {
        if (sets[i].length >= 3) continue;
        const added = order[i].find((idx) => !sets[i].includes(idx));
        if (added === undefined) continue;
        const ns = sets.map((s, j) => (j === i ? s.concat(added) : s));
        const c = sfcCoverage(probs, ns);
        const dT = c.tickets - cur.tickets;
        if (dT <= 0 || c.tickets > budget * 1.1) continue;
        const penalty = c.tickets > budget ? 1.25 : 1; // 优先用满但不明显超额
        const ret = (5 * (c.pAll - cur.pAll) + (c.pAlmost - cur.pAlmost)) / dT / penalty;
        if (!best || ret > best.ret) best = { ns, c, ret };
      }
      if (!best) break;
      sets = best.ns; cur = best.c;
    }
    plans.push({
      budget, sets: sets.map((s) => s.slice()),
      tickets: cur.tickets, cost: cur.tickets * 2,
      pAll: cur.pAll, pAlmost: cur.pAlmost, dist: cur.dist,
    });
  }

  // 任九：选 9 场「最大概率乘积」最高，再给单/双选建议
  const rank = probs.map((p, i) => ({ i, top: Math.max(...p) })).sort((a, b) => b.top - a.top);
  const picks = rank.slice(0, Math.min(9, n)).map((x) => x.i);
  const p9 = picks.reduce((a, i) => a * Math.max(...probs[i]), 1);
  const ren9 = {
    picks, p9, cost: 2,
    detail: picks.map((i) => ({ i, no: matches[i].no, home: matches[i].home, away: matches[i].away, sel: order[i][0], p: probs[i][order[i][0]] })),
  };

  // 冷门雷达：模型概率 − 市场概率（仅展示，不改变选择）
  const upsets = matches.map((m, i) => {
    if (!m.marketP) return null;
    const d = m.p.map((x, j) => (x - m.marketP[j]) * 100);
    const k = d.indexOf(Math.max(...d));
    return { no: m.no, side: SIDE[k], gap: +d[k].toFixed(1), modelP: +(m.p[k] * 100).toFixed(1), marketP: +(m.marketP[k] * 100).toFixed(1) };
  }).filter(Boolean).sort((a, b) => b.gap - a.gap);

  return { n, baseline, plans, ren9, upsets, order };
}

// 单场传足建议：单选（差距大）/ 双选（次选接近）/ 全包（三选接近）
function sfcPick(p) {
  const sorted = p.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]);
  const gap = sorted[0][0] - sorted[1][0];
  const level = gap >= 0.22 ? '稳胆' : gap >= 0.10 ? '博胆' : gap >= 0.04 ? '双选' : '全包';
  return { top: sorted[0][1], second: sorted[1][1], third: sorted[2][1], gap, level, order: sorted.map((x) => x[1]) };
}

// ---------- 自检样例（虚构对阵，仅验证函数可运行） ----------
if (typeof module !== 'undefined' && require.main === module) {
  const demo = {
    no: '示例A', lg: '示例联赛', home: '主队甲', away: '客队乙', kickoff: '11-15 22:00', hc: -1, single: 1,
    spf: [2.10, 3.55, 3.40], rq: [4.20, 3.80, 1.60],
    supSPF: [29, 29, 42], supRQ: [30, 30, 40], open: null,
    zjq: [12, 5.5, 3.6, 3.5, 4.6, 8.5, 15, 22],
    consEU: [2.10, 3.50, 3.40], consP: [0.452, 0.271, 0.277], consSD: [0.006, 0.004, 0.005], nBooks: 18,
    team: {
      home: { home: { gf: 12, ga: 6, p: 6 }, form: { gf: 8, ga: 5, p: 5 }, meta: { daysRest: 5, fallback: false } },
      away: { away: { gf: 8, ga: 9, p: 6 }, form: { gf: 6, ga: 7, p: 5 }, meta: { daysRest: 5, fallback: false } },
      form: { home: { gf: 8, ga: 5, p: 5 }, away: { gf: 6, ga: 7, p: 5 } },
    },
  };
  const p = predictMatch(demo);
  console.log('== 综合预测 ==', p.no, `${p.home} vs ${p.away}`);
  console.log('λ', p.lambdaTotal.toFixed(2), 'w', p.w.toFixed(3), '来源', p.modelSource, 'k', p.blendK.toFixed(2),
    '| 市场λ', p.marketLambda && p.marketLambda.toFixed(2), '独立λ', p.teamLambda && p.teamLambda.toFixed(2),
    '| degraded', p.degraded);
  console.log('胜平负', [p.probs.H, p.probs.D, p.probs.A].map((x) => (x * 100).toFixed(1) + '%').join(' / '),
    '| 去水', p.devig ? p.devig.map((x) => (x * 100).toFixed(1) + '%').join(' / ') : '-',
    '| σ', p.sigma);
  console.log('总进球区间', Object.entries(p.intervals).map(([k, v]) => `${k}:${(v * 100).toFixed(1)}%`).join(' '));
  console.log('比分 top5', p.forecast.scores.map((s) => `${s.s} ${(s.p * 100).toFixed(1)}%`).join(' | '));
  console.log('判定', p.verdict.level, p.verdict.pick, '|', p.verdict.reason);
  console.log('方案', p.rec.level, p.rec.summary);

  // 纪律层自检：客队纪律差 + 严格裁判 → 客队 λ 应下调、主队 λ 应上调
  const demoDisc = { ...demo, discipline: { refH: 0.15, refA: 0.15, teamRedH: 0.0, teamRedA: 0.30, teamN_H: 20, teamN_A: 20, refYellowH: 2.5, refYellowA: 2.5, teamYellowH: 1.8, teamYellowA: 2.6, refName: '示例裁判', refN: 100 } };
  const pd = predictMatch(demoDisc);
  const p0 = predictMatch({ ...demo, discipline: null });
  console.log('== 纪律层 ==', 'P(主红)', (pd.discipline.pRedH * 100).toFixed(1) + '%',
    'P(客红)', (pd.discipline.pRedA * 100).toFixed(1) + '%',
    'adjH', pd.discipline.adjH.toFixed(3), 'adjA', pd.discipline.adjA.toFixed(3),
    '| λ总', p0.lambdaTotal.toFixed(3), '→', pd.lambdaTotal.toFixed(3),
    '| 摩擦', pd.discipline.friction, pd.discipline.frictionLabel);
  console.log('== 红牌情景 ==', '主队吃红后主胜', (pd.redScenario.homeRed.H * 100).toFixed(1) + '%',
    '客队吃红后主胜', (pd.redScenario.awayRed.H * 100).toFixed(1) + '%');

  // 共识 λ 自检
  const pc = predictMatch({ ...demo, consEU: [2.10, 3.50, 3.40], consP: [0.452, 0.271, 0.277], nBooks: 18 });
  console.log('== 共识 λ ==', '来源', pc.modelSource, 'k', pc.blendK.toFixed(2),
    '| 共识λ', pc.consLambda && pc.consLambda.toFixed(2), '融合λ', pc.lambdaTotal.toFixed(2),
    '| ρ闸门', JSON.stringify(pc.rec.plays[0] ? pc.rec.plays[0].rho : null));

  // degraded 自检：无独立层 → 必须显式降级
  const deg = predictMatch({ ...demo, team: null });
  console.log('== degraded ==', deg.degraded, '|', deg.rec.level, '|', deg.rec.notes[0]);

  const bt = backtest([p], { '示例A': [2, 1] });
  console.log('== 回测 ==', JSON.stringify(bt.hit));
  console.log('去吧', devig([2.0, 3.4, 4.0]).m.toFixed(4),
    '两串', JSON.stringify(combo([{ p: 0.6, odds: 1.46 }, { p: 0.55, odds: 1.6 }])));
}

module.exports = {
  RHO, RHO_SET, K_SHRINK, K_BLEND, K_SHRINK_BOOKS, SIDE, MIN_ODDS, MIN_EV, MIN_EDGE,
  devig, devigShin, devigBoth, grid, summarize, topScores, goalBuckets, goalIntervals, rqProb, hafu,
  fitFromZJQ, fit2D, fitFromConsensus, adaptiveK, teamStrength, blendModels, disciplineLayer,
  redScenario, probAt, probBand, rhoGate, confidence, movementLayer, isCup,
  predictMatch, buildForecast, verdictFromPrediction, buildRecommendation,
  backtest, ev, combo, sfcCoverage, sfcPlan, sfcPick,
};