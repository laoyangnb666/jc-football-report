// 竞彩足球分析内核：去水、Dixon-Coles 拟合、EV、串关、逐场判定
// 可直接 node 运行（内置样例自检），也可整段粘进 Exec 沙盒执行。

const RHO = -0.10;

function factorial(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// 去水：P(i) = (1/odds_i) / sum(1/odds_j)；m 为 margin（小数）
function devig(odds) {
  const inv = odds.map((x) => 1 / x);
  const s = inv.reduce((a, b) => a + b, 0);
  return { p: inv.map((x) => x / s), m: s - 1, overround: s };
}

// 泊松 + Dixon-Coles 相关修正，返回 12x12 网格
function grid(lambdaTotal, w, rho = RHO) {
  const lh = lambdaTotal * w;
  const la = lambdaTotal * (1 - w);
  const N = 12;
  const ph = [];
  const pa = [];
  for (let k = 0; k < N; k++) {
    ph.push(Math.exp(-lh) * Math.pow(lh, k) / factorial(k));
    pa.push(Math.exp(-la) * Math.pow(la, k) / factorial(k));
  }
  const cells = [];
  let s = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let t = 1;
      if (i === 0 && j === 0) t = 1 - lh * la * rho;
      else if (i === 1 && j === 0) t = 1 + la * rho;
      else if (i === 0 && j === 1) t = 1 + lh * rho;
      else if (i === 1 && j === 1) t = 1 - rho;
      let p = ph[i] * pa[j] * t;
      if (p < 0) p = 0;
      cells.push([i, j, p]);
      s += p;
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

function topScores(g, n = 5) {
  return g.cells.slice().sort((a, b) => b[2] - a[2]).slice(0, n);
}

// 让球盘三项概率：hc 为主队视角让球数（-2 表示让 2 球，+1 表示受让 1 球）
function rqProb(g, hc) {
  let H = 0, D = 0, A = 0;
  for (const [i, j, p] of g.cells) {
    const net = i - j + hc;
    if (net > 0) H += p;
    else if (net === 0) D += p;
    else A += p;
  }
  return [H, D, A];
}

// 有总进球赔率时：λ 由 P(0球) 反解，1D 搜索主队份额 w
function fitFromZJQ(zjqOdds, spfOdds) {
  const z = devig(zjqOdds.map(Number));
  const lambdaTotal = -Math.log(Math.max(z.p[0], 1e-9));
  const target = devig(spfOdds).p;
  let best = { w: 0.5, sse: Infinity, g: null };
  for (let w = 0.15; w <= 0.85; w += 0.0025) {
    const g = grid(lambdaTotal, w);
    const s = summarize(g);
    const sse = Math.pow(s.H - target[0], 2) + Math.pow(s.D - target[1], 2) + Math.pow(s.A - target[2], 2);
    if (sse < best.sse) best = { w, sse, g };
  }
  return { lambdaTotal, w: best.w, sse: best.sse, grid: best.g };
}

// 无总进球赔率时：λ 与 w 二维拟合
function fit2D(spfOdds) {
  const target = devig(spfOdds).p;
  let best = { lambdaTotal: 2.8, w: 0.5, sse: Infinity, g: null };
  for (let lt = 1.6; lt <= 5.2; lt += 0.02) {
    for (let w = 0.2; w <= 0.8; w += 0.01) {
      const g = grid(lt, w);
      const s = summarize(g);
      const sse = Math.pow(s.H - target[0], 2) + Math.pow(s.D - target[1], 2) + Math.pow(s.A - target[2], 2);
      if (sse < best.sse) best = { lambdaTotal: lt, w, sse, g };
    }
  }
  return best;
}

function ev(p, odds) {
  return p * odds - 1;
}

// 串关：n 腿联乘，注意 pTyp × odds 恒接近 1/(1+margin)
function combo(legs) {
  const p = legs.reduce((a, l) => a * l.p, 1);
  const odds = legs.reduce((a, l) => a * l.odds, 1);
  return { odds, p, ev: p * odds - 1 };
}

// ---------- 逐场判定 ----------
const SIDE = ['主胜', '平局', '客胜'];

function verdictOne(row) {
  const no = row[0], hc = row[5], spf = row[6], rq = row[7], sSPF = row[8], sRQ = row[9];

  // 未开售胜平负：只对让球盘给判断
  if (!spf) {
    const d = devig(rq);
    const dl = sRQ.map((s, i) => s - 100 * d.p[i]);
    const mx = Math.max(...dl), mn = Math.min(...dl);
    const fav = dl.indexOf(mx);
    let level = '观望', pick = '';
    if (mx >= 15) { level = '回避'; pick = `让球盘 ${SIDE[fav]} ${rq[fav].toFixed(2)}`; }
    else if (mn <= -15) { level = '小注'; pick = `让球盘 ${SIDE[dl.indexOf(mn)]} ${rq[dl.indexOf(mn)].toFixed(2)}`; }
    else if (mn <= -8) { level = '关注'; pick = `让球盘 ${SIDE[dl.indexOf(mn)]} ${rq[dl.indexOf(mn)].toFixed(2)}`; }
    else { pick = `让球盘 不参与`; }
    return {
      no, level, pick,
      line: `${no}｜${level}｜${pick}｜Δ ${mx >= 0 ? '+' : ''}${mx.toFixed(0)}pp / ${mn.toFixed(0)}pp｜margin ${(d.m * 100).toFixed(2)}%`,
      dev: d.p, delta: dl, margin: d.m * 100, note: '胜平负未开售，按让球盘判定',
    };
  }

  const d = devig(spf);
  const dl = sSPF.map((s, i) => s - 100 * d.p[i]);
  const mx = Math.max(...dl), mn = Math.min(...dl);
  const hiIdx = dl.indexOf(mx), loIdx = dl.indexOf(mn);

  // 定价偏差：有总进球用 1D 拟合，否则 2D；缺数据则跳过模型
  let model = null, bias = null, g0 = null, rqEV = null;
  if (row[10]) {
    const f = fitFromZJQ(row[10], spf);
    const s = summarize(f.grid);
    model = [(s.H * 100).toFixed(1), (s.D * 100).toFixed(1), (s.A * 100).toFixed(1)];
    bias = Math.max(...[s.H - d.p[0], s.D - d.p[1], s.A - d.p[2]].map(Math.abs)) * 100;
    g0 = f.grid;
  }

  // 让球盘 EV：让球的一侧是否还留有边际
  if (g0 && rq) {
    const rp = rqProb(g0, parseInt(hc, 10));
    rqEV = rp.map((p, i) => ev(p, rq[i]));
  }

  const pricingValid = bias !== null && bias <= 1.5;

  let level, pick, reason;
  if (mx >= 15) {
    level = '回避';
    pick = `${SIDE[hiIdx]} ${spf[hiIdx].toFixed(2)}`;
    reason = `人气溢价 +${mx.toFixed(0)}pp，价格不含补偿`;
  } else if (mn <= -15 && spf[loIdx] >= 2.5) {
    level = '小注';
    pick = `${SIDE[loIdx]} ${spf[loIdx].toFixed(2)}`;
    reason = `缺口 ${mn.toFixed(0)}pp，高赔冷门仅限小仓`;
  } else if (mn <= -8) {
    level = '关注';
    pick = `${SIDE[loIdx]} ${spf[loIdx].toFixed(2)}`;
    reason = `缺口 ${mn.toFixed(0)}pp，需基本面无反向佐证`;
  } else if (pricingValid) {
    level = '观望';
    pick = '不参与';
    reason = `定价有效，模型偏差 ${bias.toFixed(1)}pp，Δ ${dl.map((x) => x.toFixed(0)).join('/')}`;
  } else {
    level = '中性';
    pick = '不参与';
    reason = `无缺口无冲突${bias !== null ? `，模型偏差 ${bias.toFixed(1)}pp` : '，仅胜平负盘'}`;
  }

  // 胜平负无缺口时，让球盘是否还有边际：有正 EV 就升级为关注
  if (rqEV && (level === '观望' || level === '中性')) {
    const bi = rqEV.indexOf(Math.max(...rqEV));
    if (rqEV[bi] > 0.02) {
      level = '关注';
      pick = `让球盘 ${SIDE[bi]} ${rq[bi].toFixed(2)}`;
      reason += `；让球盘 ${SIDE[bi]} EV +${(rqEV[bi] * 100).toFixed(1)}%`;
    } else {
      reason += `；让球盘各侧 EV ${rqEV.map((e) => (e * 100).toFixed(1)).join('/')}%，${SIDE[bi]} 侧最好仍为 ${(rqEV[bi] * 100).toFixed(1)}%，无边际`;
    }
  }

  const evBest = spf.map((o, i) => `${SIDE[i]} EV ${(ev(d.p[i], o) * 100).toFixed(1)}%`).join(' / ');

  return {
    no, level, pick,
    line: `${no}｜${level}｜${pick}｜${reason}`,
    dev: d.p, delta: dl, margin: d.m * 100, model, bias, rqEV, evText: evBest,
    note: reason,
  };
}

function verdictAll(rows) {
  return rows.map(verdictOne);
}

// 自检样例：虚构对阵，仅用于验证函数可运行，不代表任何真实赛事
if (typeof module !== 'undefined' && require.main === module) {
  const s1 = ['示例A', '示例联赛', '主队甲', '客队乙', '11-15 22:00', '-1',
    [2.10, 3.55, 3.40], [4.20, 3.80, 1.60], [29, 29, 42], [30, 30, 40],
    [12, 5.5, 3.6, 3.5, 4.6, 8.5, 15, 22], null];
  const s2 = ['示例B', '示例联赛', '主队丙', '客队丁', '11-16 01:00', '+1',
    [1.60, 3.80, 5.50], [1.75, 3.60, 3.60], [30, 25, 45], [55, 25, 20],
    null, null];

  [s1, s2].forEach((row) => {
    const v = verdictOne(row);
    console.log(v.line);
    if (row[10]) {
      const f = fitFromZJQ(row[10], row[6]);
      const s = summarize(f.grid);
      console.log('  λ=', f.lambdaTotal.toFixed(2), 'w=', f.w.toFixed(3),
        'model=', [(s.H * 100).toFixed(1), (s.D * 100).toFixed(1), (s.A * 100).toFixed(1)].join('/'),
        'bias=', v.bias === null ? '-' : v.bias.toFixed(2) + 'pp');
      console.log('  top5=', topScores(f.grid).map((c) => `${c[0]}-${c[1]} ${(c[2] * 100).toFixed(1)}%`).join(' '));
      console.log('  rqEV=', v.rqEV === null ? '-' : v.rqEV.map((e) => (e * 100).toFixed(1)).join('/'));
    }
  });
  console.log('devig 校验=', devig([2.0, 3.4, 4.0]).m.toFixed(4),
    'combo2=', JSON.stringify(combo([{ p: 0.60, odds: 1.46 }, { p: 0.55, odds: 1.60 }])));
}

module.exports = { devig, grid, summarize, topScores, rqProb, fitFromZJQ, fit2D, ev, combo, verdictOne, verdictAll, RHO };
