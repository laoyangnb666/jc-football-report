// 竞彩足球分析内核 v6
// 去水 / Dixon-Coles / 共识 λ（v6：16+ 家即时欧赔均值拟合，对齐 SKILL v5 L1）/ 独立强度模型（比率法+收缩）/ 自适应融合权重 / 逐场综合预测 / 回测校准 / 串关
// 零依赖，可直接 node 运行（内置自检样例）；也可整段粘进 Exec 沙盒执行。
//
// v6 相对 v2 的变化（对齐 SKILL v5）：
//  1. 新增「共识 λ」（L1）：用捷报 16+ 家即时欧赔均值去水拟合 λ 与偏斜（fitFromConsensus）。
//     竞彩赔率只做价格与 EV 基准，不再单独拟合 λ——对齐 SKILL v5「竞彩只做价格与 EV 基准」。
//  2. 新增「自适应融合权重 k」：k 随共识庄家数收缩——n < 10 时 k 向市场模型收缩（fit2D 回退），
//     n ≥ 16 时全额 k=0.35。无共识欧赔时回退 v2 的 fitFromZJQ/fit2D。
//  3. 保留 v2 的独立强度模型（比率法+收缩）、纪律层（v5.1 红牌风险）、回测校准、串关。
//  4. 保留 v2 相对 v1 的全部变化：独立强度模型、融合、predictMatch、比分 top-N、判定规则、backtest。

const RHO = -0.10;      // Dixon-Coles 低比分相关修正
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
  return { p: inv.map((x) => x / s), m: s - 1, overround: s };
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
  const z = devig(zjqOdds.map(Number));
  const lambdaTotal = -Math.log(Math.max(z.p[0], 1e-9));
  const target = devig(spfOdds).p;
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
  const target = consP ? consP.slice() : devig(consEU).p;
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
  const target = devig(spfOdds).p;
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

// ---------- 4. 独立强度模型（比率法 + 收缩） ----------
// team: {home:{gf,ga,p}, away:{gf,ga,p}}  均为本队视角的主场/客场累计
// form: {gf,ga,p} 近 6 场（可选）
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
    const baseH = lgHome * attH * defA, baseA = lgAway * attA * defH;
    const ratioH = fh / ((home.home.gf / home.home.p) * 0.6 + (home.home.ga / home.home.p) * 0.4 || 1);
    const ratioA = fa / ((away.away.gf / away.away.p) * 0.6 + (away.away.ga / away.away.p) * 0.4 || 1);
    formFactor = 1 + 0.15 * (((ratioH + ratioA) / 2) - 1);
    lamH *= 1 + 0.15 * (ratioH - 1);
    lamA *= 1 + 0.15 * (ratioA - 1);
  }

  lamH = clamp(lamH, 0.25, 4.5); lamA = clamp(lamA, 0.2, 4.2);
  const lamTotal = lamH + lamA, share = lamH / lamTotal;
  return {
    lambdaTotal: lamTotal, w: share, lamH, lamA, formFactor, source: 'team',
    components: { lgHome, lgAway, attH, defH, attA, defA },
    sample: { home: home.home.p, away: away.away.p },
  };
}

// 融合：市场映像与独立模型按权重 k 线性混合 λ，w 以市场为主（市场对强弱分配更准）
function blendModels(market, team, k = K_BLEND) {
  if (!market && !team) return null;
  if (!team) return { ...market, blendK: 0 };
  if (!market) return { ...team, blendK: 1 };
  const lam = (1 - k) * market.lambdaTotal + k * team.lambdaTotal;
  const w = (1 - k * 0.5) * market.w + (k * 0.5) * team.w;
  return {
    lambdaTotal: lam, w, blendK: k, source: 'blend',
    market, team, grid: grid(lam, w),
  };
}

// ---------- 4.5 纪律层：红牌风险（v5.1，披露制 + 待验证） ----------
// 输入 row.discipline（全部来自捷报裁判分析页，可查源）：
//   refH/refA: 主裁判对主队/客队口径的场均红牌（大样本，200+ 场）
//   teamH/teamA: 主队（本侧）/客队（本侧）近 10 场场均红牌
//   refYellowH/refYellowA/teamYellowH/teamYellowA: 同口径场均黄牌（可选，仅披露）
// 机制：红牌期望 λ_red = 0.5·裁判口径 + 0.5·球队口径（两个独立估计互相印证）；
//   P(该队吃红) = 1 − exp(−λ_red)（泊松近似）。
// 效应量级取文献共识（非本样本回测）：10 人作战进攻 λ −40%、对方 +30%；
//   红牌平均发生在 ~60'，期望作用时长占比 ≈ 0.35。
//   故对 λ 的期望修正：己方 −0.40·0.35·P，对方 +0.30·0.35·P，封顶 ±0.12 球。
// 「球员情绪状态」本身不可查询，纪律恶化（近 5 场 vs 近 10 场牌数）与裁判严格度是其可观测代理；
//   更衣室新闻只进文字层，不进 λ。
function disciplineLayer(disc) {
  if (!disc) return null;
  const redH = 0.5 * (num(disc.refH) ?? 0) + 0.5 * (num(disc.teamH) ?? 0);
  const redA = 0.5 * (num(disc.refA) ?? 0) + 0.5 * (num(disc.teamA) ?? 0);
  if (redH <= 0 && redA <= 0) return null;
  const pRedH = 1 - Math.exp(-redH), pRedA = 1 - Math.exp(-redA);
  const T = 0.35, SELF = 0.40, OPP = 0.30;
  const adjH = clamp(-SELF * T * pRedH + OPP * T * pRedA, -0.12, 0.12);
  const adjA = clamp(-SELF * T * pRedA + OPP * T * pRedH, -0.12, 0.12);
  const yellowH = 0.5 * (num(disc.refYellowH) ?? 0) + 0.5 * (num(disc.teamYellowH) ?? 0);
  const yellowA = 0.5 * (num(disc.refYellowA) ?? 0) + 0.5 * (num(disc.teamYellowA) ?? 0);
  return {
    lamRedH: redH, lamRedA: redA, pRedH, pRedA, adjH, adjA,
    hot: yellowH >= 2.3 || yellowA >= 2.3,   // 高摩擦场次标记（只披露，不改 λ）
    yellowH, yellowA,
  };
}

// ---------- 5. 逐场综合预测 ----------
// row: {
//   no, lg, home, away, kickoff, hc,
//   spf:[h,d,a] | null, rq:[h,d,a] | null, supSPF:[h,d,a] | null,
//   zjq:[8] | null, open:[h,d,a] | null,
//   consEU:[h,d,a] | null, consP:[h,d,a] | null, nBooks:int | null,   // v6 共识欧赔
//   team:{home:{home:{gf,ga,p}, away:{gf,ga,p}}, away:{...}, form:{home,away}} | null,
//   panlu:{home:{...}, away:{...}} | null,
//   bookAvg:{ euOpen, euLive, rqOpen:{h,line,a}, rqLive, ouOpen:{line}, ouLive } | null,
//   discipline:{ refH, refA, teamH, teamA, refYellowH?, refYellowA?, teamYellowH?, teamYellowA? } | null
// }
function predictMatch(row) {
  const out = { no: row.no, lg: row.lg, home: row.home, away: row.away, hc: row.hc, kickoff: row.kickoff };
  // v6：优先共识 λ（L1），无共识时回退竞彩拟合（v2 行为）
  const mk = row.consEU ? fitFromConsensus(row.consEU, row.consP)
    : row.spf && row.zjq ? fitFromZJQ(row.zjq, row.spf)
    : row.spf ? fit2D(row.spf) : null;
  const tm = row.team ? teamStrength(row.team.home, row.team.away, row.team.form) : null;
  // v6：k 随共识庄家数自适应收缩
  const kBase = row.blendK === undefined ? adaptiveK(row.nBooks) : row.blendK;
  const bl = blendModels(mk, tm, kBase);
  if (!bl) return { ...out, ok: false, reason: '缺少共识欧赔与胜平负赔率，无法拟合 λ' };

  // v3：伤停修正（人工情报裁定，报告必须披露依据）
  const adj = row.injuryAdj || { home: 0, away: 0 };
  // v5.1：纪律层红牌风险（自动、可复算，披露制；无 discipline 输入时不启用）
  const disc = disciplineLayer(row.discipline);
  const lamH = clamp(bl.lambdaTotal * bl.w + (adj.home || 0) + (disc ? disc.adjH : 0), 0.2, 4.8);
  const lamA = clamp(bl.lambdaTotal * (1 - bl.w) + (adj.away || 0) + (disc ? disc.adjA : 0), 0.15, 4.5);
  const lamTotal = lamH + lamA, w = lamH / lamTotal;
  const g = grid(lamTotal, w);
  const s = summarize(g);
  const buckets = goalBuckets(g);
  const intervals = goalIntervals(g);
  const rq = row.hc === null || row.hc === undefined ? null : rqProb(g, row.hc);
  const eu = row.spf ? devig(row.spf) : null;

  const res = {
    ...out, ok: true,
    lambdaTotal: lamTotal, w, lamH, lamA,
    injuryAdj: adj,
    discipline: disc,
    blendK: bl.blendK, modelSource: bl.source,
    // v6：共识层（L1）与市场层（竞彩）分开标注
    consLambda: row.consEU ? (mk && mk.source === 'consensus' ? mk.lambdaTotal : null) : null,
    consW: row.consEU ? (mk && mk.source === 'consensus' ? mk.w : null) : null,
    consEU: row.consEU || null, consP: row.consP || null, nBooks: row.nBooks || 0,
    marketLambda: mk ? mk.lambdaTotal : null, marketW: mk ? mk.w : null,
    teamLambda: tm ? tm.lambdaTotal : null, teamW: tm ? tm.w : null,
    teamComponents: tm ? tm.components : null, teamSample: tm ? tm.sample : null,
    probs: {
      H: s.H, D: s.D, A: s.A, o25: s.o25, btts: s.btts,
      rq: rq, hafu: hafu(g),
    },
    devig: eu ? eu.p : null, margin: eu ? eu.m : null,
    supSPF: row.supSPF || null,
    delta: eu && row.supSPF ? row.supSPF.map((x, i) => x - 100 * eu.p[i]) : null,
    scores: topScores(g, 6).map(([h, a, p]) => ({ h, a, p })),
    buckets, intervals,
    forecast: buildForecast(s, buckets, intervals, g),
    verdict: verdictFromPrediction(row, s, eu, rq, g, buckets),
    rec: buildRecommendation(row, s, eu, rq, buckets),
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
function verdictFromPrediction(row, s, eu, rqP, g, buckets) {
  const no = row.no;
  const model = [s.H, s.D, s.A];
  const modelPick = model.indexOf(Math.max(...model));

  // 仅让球盘在售
  if (!eu) {
    const d = row.rq ? devig(row.rq) : null;
    if (!d) return { level: '中性', pick: '不参与', reason: '无可用盘口' };
    const dl = row.supRQ ? row.supRQ.map((x, i) => x - 100 * d.p[i]) : [0, 0, 0];
    const mx = Math.max(...dl), fav = dl.indexOf(mx);
    if (mx >= 15) return { level: '回避', pick: `让球盘 ${SIDE[fav]} ${row.rq[fav].toFixed(2)}`,
      reason: `人气 +${mx.toFixed(0)}pp，价格无补偿；模型让球 ${(rqP ? rqP[fav] * 100 : NaN).toFixed(1)}%` };
    if (rqP) {
      const bi = rqP.indexOf(Math.max(...rqP));
      const ev = rqP[bi] * row.rq[bi] - 1;
      if (ev > 0.02) return { level: '关注', pick: `让球盘 ${SIDE[bi]} ${row.rq[bi].toFixed(2)}`,
        reason: `模型 ${(rqP[bi] * 100).toFixed(1)}% vs 隐含 ${(d.p[bi] * 100).toFixed(1)}%，EV +${(ev * 100).toFixed(1)}%` };
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

// ---------- 6b. 购买方案层（v3 新增） ----------
// 每场输出：级别（主推/小注/观察/回避）+ 具体玩法/选项/赔率/仓位 + 焦点标记
// 规则依据两轮回测：
//  - 超短赔（去水第一方向概率 ≥66%）跨两轮 11/12=91.7% 对隐含 67% → 唯一可主推信号
//  - 但伤停反向修正 ≥0.15 的超短赔必须降级（周一004 亚特兰大 1.30 爆冷的教训）
//  - 让球盘模型 EV > 2% 可小注（跨轮 3/4）
//  - 人气 Δ ≥ +15pp 且模型不支持 → 回避
//  - 比分只做娱乐仓，仓位 ≤0.5%/注
function buildRecommendation(row, s, eu, rqP, buckets) {
  const SIDE3 = ['主胜', '平局', '客胜'];
  const modelP = [s.H, s.D, s.A];
  const modelPick = modelP.indexOf(Math.max(...modelP));
  const devPick = eu ? eu.p.indexOf(Math.max(...eu.p)) : null;
  const devProb = eu ? eu.p[devPick] : null;
  const supPick = row.supSPF ? row.supSPF.indexOf(Math.max(...row.supSPF)) : null;
  const div = row.supSPF && devPick !== supPick && row.supSPF[supPick] - row.supSPF[devPick] >= 8;
  const adj = row.injuryAdj || {};
  const favAdj = devPick === 0 ? (adj.home || 0) : (adj.away || 0);
  const favOdds = eu ? row.spf[devPick] : null;
  const delta = eu && row.supSPF ? row.supSPF.map((x, i) => x - 100 * eu.p[i]) : null;
  const deltaMax = delta ? Math.max(...delta) : 0;
  const hotIdx = delta ? delta.indexOf(deltaMax) : -1;

  // 焦点场：人气极端 / λ 极端 / 重大伤停 / 价格大幅移动
  const bookAvg = row.bookAvg || {};
  const priceMove = (bookAvg.euOpen && bookAvg.euLive && bookAvg.euOpen[0] && bookAvg.euLive[0])
    ? Math.abs(bookAvg.euLive[0] - bookAvg.euOpen[0]) : 0;
  const focus = deltaMax >= 15 || s.H + s.D + s.A === 0 || Math.max(0, ...(row.injuryAdj ? [Math.abs(row.injuryAdj.home || 0), Math.abs(row.injuryAdj.away || 0)] : [0])) >= 0.2 || priceMove >= 0.15;

  const plays = [];
  let level = '观察';
  const notes = [];

  // 让球盘 EV（所有场次都算）
  let rqBest = null;
  if (rqP && row.rq) {
    const evs = rqP.map((p, i) => p * row.rq[i] - 1);
    const bi = evs.indexOf(Math.max(...evs));
    rqBest = { side: SIDE3[bi], odds: row.rq[bi], ev: evs[bi], p: rqP[bi], impl: (1 / row.rq[bi]) / (row.rq.reduce((a, x) => a + 1 / x, 0)) };
  }

  if (!eu) {
    // 仅让球盘在售
    if (rqBest && rqBest.ev > 0.02) {
      level = '小注';
      plays.push({ play: '让球胜平负', pick: rqBest.side, odds: rqBest.odds, p: rqBest.p, ev: rqBest.ev, stake: '小注（0.5–1%）' });
      notes.push(`仅让球盘在售，模型 ${(rqBest.p * 100).toFixed(1)}% 对隐含 ${(rqBest.impl * 100).toFixed(1)}%，EV +${(rqBest.ev * 100).toFixed(1)}%`);
    } else {
      level = '回避';
      notes.push(rqBest ? `仅让球盘在售，最好一侧 EV ${(rqBest.ev * 100).toFixed(1)}% 仍为负` : '无可用盘口');
    }
  } else if (devProb >= 0.66) {
    // 超短赔区：四轮回测 17/23=73.9% 对隐含 67% 已无显著优势（EV≈−5%），v5 起主推降级为小注
    // 第三轮教训（利物浦 1.33 翻车）与第四轮教训（桑德兰 1.27 爆冷）：
    // 「伤停为替补级」的单一来源判断不可信，伤修 ≤ −0.15 必须降级（第四轮 −0.20/−0.30 两场爆冷被阈值成功拦下）
    const EMP = 0.739;
    if (modelPick === devPick && favAdj >= -0.15 && !div) {
      level = '小注';
      plays.push({ play: '胜平负（单关）', pick: SIDE3[devPick], odds: favOdds, p: EMP, pSrc: '回测经验（23 样本）', ev: EMP * favOdds - 1, stake: '小注（0.5–1%）' });
      notes.push(`超短赔区：去水 ${(devProb * 100).toFixed(1)}%，模型同向 ${(modelP[devPick] * 100).toFixed(1)}%；方案概率采用跨轮回测经验值 ${EMP * 100}%（17/23），非模型输出；四轮 EV≈−5%，只给小注`);
      if (favAdj <= -0.2) notes.push(`重伤修 ${favAdj.toFixed(2)}：热门侧爆冷风险高（第四轮 −0.20/−0.30 两场全部爆冷），仅观察`);
      // 深度让球提示
      if (row.hc !== null && row.hc <= -2 && rqBest) {
        plays.push({ play: '让球胜平负', pick: `谨慎：让 ${row.hc} 需净胜 ${Math.abs(row.hc) + 1} 球`, odds: rqBest.odds, p: rqBest.p, ev: rqBest.ev, stake: '不建议' });
        notes.push(`让 ${row.hc} 球需净胜 ${Math.abs(row.hc) + 1} 球以上，模型仅 ${(rqP[0] * 100).toFixed(1)}%，让球盘无值`);
      }
    } else {
      level = '观察';
      if (div) notes.push(`超短赔但资金方向相反（支持率 ${SIDE3[supPick]} ${row.supSPF[supPick]}% vs 定价 ${SIDE3[devPick]}），回测分歧规则采信定价但仓位归零`);
      if (favAdj < -0.15) notes.push(`超短赔但该侧伤停修正 ${favAdj.toFixed(2)}（周一004 亚特兰大 1.30 爆冷同型），等首发确认`);
      if (modelPick !== devPick) notes.push(`模型 ${SIDE3[modelPick]} 与去水第一方向 ${SIDE3[devPick]} 不同向`);
      plays.push({ play: '胜平负', pick: SIDE3[devPick], odds: favOdds, p: devProb, ev: modelP[devPick] * favOdds - 1, stake: '暂不买，等临场' });
    }
  } else if (deltaMax >= 15 && modelPick !== hotIdx) {
    level = '回避';
    notes.push(`人气 +${deltaMax.toFixed(0)}pp 堆在 ${SIDE3[hotIdx]}，模型仅 ${(modelP[hotIdx] * 100).toFixed(1)}%，价格不含补偿`);
  } else if (rqBest && rqBest.ev > 0.02) {
    level = '小注';
    plays.push({ play: '让球胜平负', pick: rqBest.side, odds: rqBest.odds, p: rqBest.p, ev: rqBest.ev, stake: '小注（0.5–1%）' });
    notes.push(`让球盘 ${rqBest.side}：模型 ${(rqBest.p * 100).toFixed(1)}% 对隐含 ${(rqBest.impl * 100).toFixed(1)}%，EV +${(rqBest.ev * 100).toFixed(1)}%`);
  } else {
    level = '观察';
    notes.push(`无结构性边际：去水第一方向 ${SIDE3[devPick]} ${(devProb * 100).toFixed(1)}%，模型偏差 ${(Math.max(...modelP.map((p, i) => Math.abs(p - eu.p[i]))) * 100).toFixed(1)}pp`);
  }

  // 大小球建议（仅当模型与盘路同向且概率足够偏）
  if (row.panlu && row.panlu.home && row.panlu.away) {
    const ovH = (row.panlu.home['总'] || {})['over%'], ovA = (row.panlu.away['总'] || {})['over%'];
    if (ovH !== undefined && ovA !== undefined) {
      const panluBig = (ovH + ovA) / 2;
      if (s.o25 >= 0.60 && panluBig >= 50) {
        plays.push({ play: '总进球', pick: '大 2.5', odds: null, p: s.o25, ev: null, stake: '小注（0.5–1%）' });
      } else if (s.o25 <= 0.40 && panluBig <= 50) {
        plays.push({ play: '总进球', pick: '小 2.5', odds: null, p: 1 - s.o25, ev: null, stake: '小注（0.5–1%）' });
      }
    }
  }

  // 比分娱乐仓（仅焦点场）
  if (focus && eu) {
    const t2 = (row.scoresHint || []);
    notes.push('焦点场：如需博比分，仅限娱乐仓 ≤0.5%/注，见比分分布');
  }

  const summary = plays.length
    ? `${level}：${plays.filter(p => p.stake !== '不建议').map(p => `${p.play} ${p.pick}${p.odds ? ' @' + p.odds.toFixed(2) : ''}（${p.stake}）`).join('；')}`
    : `${level}：本场不参与`;

  return { level, focus, plays, notes, summary, rqBest };
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

// ---------- 自检样例（虚构对阵，仅验证函数可运行） ----------
if (typeof module !== 'undefined' && require.main === module) {
  const demo = {
    no: '示例A', lg: '示例联赛', home: '主队甲', away: '客队乙', kickoff: '11-15 22:00', hc: -1,
    spf: [2.10, 3.55, 3.40], rq: [4.20, 3.80, 1.60],
    supSPF: [29, 29, 42], supRQ: [30, 30, 40], open: null,
    zjq: [12, 5.5, 3.6, 3.5, 4.6, 8.5, 15, 22],
    team: {
      home: { home: { gf: 12, ga: 6, p: 6 }, away: { gf: 7, ga: 11, p: 6 } },
      away: { home: { gf: 9, ga: 8, p: 6 }, away: { gf: 8, ga: 9, p: 6 } },
      form: { home: { gf: 8, ga: 5, p: 5 }, away: { gf: 6, ga: 7, p: 5 } },
    },
  };
  const p = predictMatch(demo);
  console.log('== 综合预测 ==', p.no, `${p.home} vs ${p.away}`);
  console.log('λ', p.lambdaTotal.toFixed(2), 'w', p.w.toFixed(3), '来源', p.modelSource,
    '| 市场λ', p.marketLambda && p.marketLambda.toFixed(2), '独立λ', p.teamLambda && p.teamLambda.toFixed(2));
  console.log('胜平负', [p.probs.H, p.probs.D, p.probs.A].map((x) => (x * 100).toFixed(1) + '%').join(' / '),
    '| 去水', p.devig ? p.devig.map((x) => (x * 100).toFixed(1) + '%').join(' / ') : '-');
  console.log('总进球区间', Object.entries(p.intervals).map(([k, v]) => `${k}:${(v * 100).toFixed(1)}%`).join(' '));
  console.log('比分 top5', p.forecast.scores.map((s) => `${s.s} ${(s.p * 100).toFixed(1)}%`).join(' | '));
  console.log('判定', p.verdict.level, p.verdict.pick, '|', p.verdict.reason);

  // 纪律层自检：客队纪律差 + 严格裁判 → 客队 λ 应下调、主队 λ 应上调
  const demoDisc = { ...demo, discipline: { refH: 0.15, refA: 0.15, teamH: 0.0, teamA: 0.30, refYellowH: 2.5, refYellowA: 2.5, teamYellowH: 1.8, teamYellowA: 2.6 } };
  const pd = predictMatch(demoDisc);
  const p0 = predictMatch({ ...demo, discipline: null });
  console.log('== 纪律层 ==', 'P(主红)', (pd.discipline.pRedH * 100).toFixed(1) + '%',
    'P(客红)', (pd.discipline.pRedA * 100).toFixed(1) + '%',
    'adjH', pd.discipline.adjH.toFixed(3), 'adjA', pd.discipline.adjA.toFixed(3),
    '| λ总', p0.lambdaTotal.toFixed(3), '→', pd.lambdaTotal.toFixed(3),
    '| 高摩擦', pd.discipline.hot);

  // v6 共识 λ 自检：16 家即时欧赔 → fitFromConsensus；k 自适应
  const demoCons = { ...demo, consEU: [2.10, 3.50, 3.40], consP: [0.452, 0.271, 0.277], nBooks: 18 };
  const pc = predictMatch(demoCons);
  console.log('== 共识 λ ==', '来源', pc.modelSource, 'k', pc.blendK.toFixed(2),
    '| 共识λ', pc.consLambda && pc.consLambda.toFixed(2), '融合λ', pc.lambdaTotal.toFixed(2),
    '| 胜平负', [pc.probs.H, pc.probs.D, pc.probs.A].map((x) => (x * 100).toFixed(1) + '%').join(' / '));

  const bt = backtest([p], { '示例A': [2, 1] });
  console.log('== 回测 ==', JSON.stringify(bt.hit));
  console.log('去吧', devig([2.0, 3.4, 4.0]).m.toFixed(4),
    '两串', JSON.stringify(combo([{ p: 0.6, odds: 1.46 }, { p: 0.55, odds: 1.6 }])));
}

module.exports = {
  RHO, K_SHRINK, K_BLEND, K_SHRINK_BOOKS, SIDE,
  devig, grid, summarize, topScores, goalBuckets, goalIntervals, rqProb, hafu,
  fitFromZJQ, fit2D, fitFromConsensus, adaptiveK, teamStrength, blendModels, disciplineLayer,
  predictMatch, buildForecast, verdictFromPrediction, buildRecommendation,
  backtest, ev, combo,
};