<p align="center">
  <img src="docs/assets/logo.png" width="96" alt="jc-football-report logo">
</p>

<h1 align="center">竞彩足球机构级分析报告</h1>

> 一个把中国体育彩票「竞彩足球」盘口还原成概率、并与公众资金流对比、找出结构性定价偏离的分析 Skill。
> 产出可复算的 PDF 报告，**每一场在售比赛都给出明确判断**。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node](https://img.shields.io/badge/Node.js-%3E%3D14-brightgreen)
![Skill](https://img.shields.io/badge/type-Agent%20Skill-blue)
[![官网](https://img.shields.io/badge/%E5%AE%98%E7%BD%91-live-2F7A4F)](https://laoyangnb666.github.io/jc-football-report/)

**项目官网：[laoyangnb666.github.io/jc-football-report](https://laoyangnb666.github.io/jc-football-report/)**　（源码见 [docs/](docs/)）

---

## 这是什么

这不是「预测谁会赢」的工具，而是一套**定价与风险视角**的分析流程：

- 把赔率去水（de-vig）还原成市场隐含概率
- 用泊松 + Dixon-Coles 拟合出比分矩阵，一次性导出胜平负、让球、总进球、双方进球等市场的概率
- 把「模型概率」「盘口去水概率」「公众支持率」三者对比，找出**结构性偏离**
- 对每一场比赛写出可复算的判断，带具体选项、赔率和数字理由

核心立场：**目标是校准，不是预测。** 预测对错不重要，长期概率估准、看清抽水在哪里，才有意义。

## 核心特征

| 特征 | 说明 |
|---|---|
| **逐场综合预测** | 每场按可靠度从高到低给出：胜平负 → 总进球（区间 + 8 桶）→ 比分 top-5 分布 |
| **独立强度模型** | 用主客分离的得失球（比率法 + 样本量收缩）建立与盘口无关的概率，不再复述盘口 |
| **市场映像融合** | 市场 λ 与独立 λ 按 k=0.35 融合，λ 三个来源全部披露 |
| **回测驱动** | 每轮先用已完赛场次跑 `backtest()`，把「实际命中率 vs 盘口隐含概率」写进报告，再据此改阈值 |
| **去水定价** | 把 13%+ 的抽水还原，得到可比的市场真实概率 |
| **锐利盘口基准** | 做 value 判断时以低 margin 的锐利庄去水价为基准，不用竞彩价当基准 |
| **数据可溯源** | 每个进入模型的数字都要能追到源；追不到的不进模型，只进文字并标「待验证」 |
| **多源交叉校验** | 赔率三源对齐、伤停双源确认、xG 单一口径 |
| **只沉淀方法** | Skill 本身不含任何具体赔率、场次或结论，那些属于当次报告产出，用完即弃 |

## 快速开始

### 1. 安装 Skill

把本仓库复制到你的 agent skills 目录：

```bash
# Trae / Claude Code 全局 skill 目录
git clone https://github.com/laoyangnb666/jc-football-report.git \
  ~/.trae-cn/skills/jc-football-report
```

目录名必须是 `jc-football-report`，与 `SKILL.md` 的 frontmatter `name` 一致。

### 2. 运行核心脚本

脚本零依赖，只要有 Node.js：

```bash
node scripts/analyze.js
```

输出内置自检样例（虚构对阵，仅验证函数可运行）：

```
示例A｜关注｜主胜 2.10｜缺口 -16pp，需基本面无反向佐证
  λ= 2.73 w= 0.570 model= 45.0/27.5/27.5 bias= 0.73pp
  top5= 1-1 13.1% 2-1 9.3% 1-0 9.0% 2-0 7.9% 0-0 7.7%
  rqEV= -1.6/-18.2/-11.9
示例B｜回避｜客胜 5.50｜人气溢价 +28pp，价格不含补偿
```

### 3. 作为库调用

```js
const { predictMatch, backtest } = require('./scripts/analyze.js');

const row = {
  no: '周一004', lg: '意甲', home: '亚特兰大', away: '帕尔马',
  kickoff: '2026-11-03 03:45', hc: -1,
  spf: [1.30, 4.65, 6.45], rq: [2.07, 3.40, 2.76],
  supSPF: [78, 13, 9], zjq: [17, 7, 4.25, 3.10, 4.20, 7.20, 15, 20],
  team: {
    home: { home: {gf: 15, ga: 6, p: 5}, away: {gf: 8, ga: 9, p: 5} },
    away: { home: {gf: 7, ga: 10, p: 5}, away: {gf: 5, ga: 13, p: 5} },
    form: { home: {gf: 9, ga: 6, p: 5}, away: {gf: 4, ga: 12, p: 5} },
  },
};

const p = predictMatch(row);
console.log(p.lambdaTotal, p.w);          // 融合 λ 与主队份额
console.log(p.forecast.spf, p.forecast.goals, p.forecast.scores);
console.log(p.verdict.level, p.verdict.reason);

// 回测：把预测与实际比分对照
const bt = backtest([p], { '周一004': [3, 1] });
console.log(bt.hit);                       // 逐市场命中率
```

## 目录结构

```
jc-football-report/
├── SKILL.md                        # Skill 主入口：铁律、流程、判定规则
├── references/
│   ├── model-and-calibration.md    # 模型数学定义 + 33 场回测校准结果（改阈值看这里）
│   ├── analysis-framework.md       # 完整分析逻辑清单（八节检查表）
│   ├── data-collection.md          # 数据源清单与采集口径
│   └── report-template.md          # 报告七层结构与排版 token
├── scripts/
│   └── analyze.js                  # 去水 / Dixon-Coles / 独立强度 / 融合 / 综合预测 / 回测
├── LICENSE
└── README.md
```

## 分析方法论（七层）

| 层 | 内容 |
|---|---|
| 1 回测校准 | 上一轮逐市场命中率、实际 vs 盘口隐含、待验证项状态 |
| 2 核心定价引擎 | margin、去水、λ 三来源（市场/独立/融合）、比分矩阵、总进球逐桶 EV |
| 3 基本面情报 | 官方伤停、历史交锋、盘路、天气场地 |
| 4 市场情报 | 初盘到现价（欧赔+亚盘+大小球）、竞彩 vs 国际定价偏离、人气税 |
| 5 细分市场 | 让球盘 EV、大小球、比分与半全场原则 |
| 6 逐场综合预测 | 每场：比分 top-5 → 总进球区间与桶 → 胜平负 → 让球 → 判定 |
| 7 数据卫生 | 八条检查项逐条给状态、源清单、缺失字段、模型变更说明 |

完整字段清单见 [references/analysis-framework.md](references/analysis-framework.md)，每条都标注了 `[源]`（去哪取）与 `[用]`（进模型 / 进报告 / 仅作背景）。模型的数学定义与校准阈值见 [references/model-and-calibration.md](references/model-and-calibration.md)。

## 回测校准（33 场实测）

上一轮 42 场中已完赛的 33 场，用来量化模型有多不准：

| 口径 | 命中 | 命中率 |
|---|---|---|
| 去水概率第一方向 | 20 / 32 | **62.5%** |
| 支持率第一方向 | 17 / 32 | **53.1%** |
| 模型第一方向（焦点 7 场） | 5 / 7 | 71.4% |
| 大/小 2.5 方向 | 6 / 7 | 85.7% |
| 正确比分 top1 / top3 / top5 | 0 / 3 / 5 (共 7) | 0% / 42.9% / **71.4%** |

三条直接改变了模型设计的结论：

1. **跟随定价优于跟随人气**，相差 9.4pp；定价与资金方向相反的分歧场次中，定价方 3/3、资金方 0/3。
2. **「冷端价值小注」被证伪。** 冷端选项（Δ ≤ −8pp）实际兑现 30.0%、盘口隐含 26.3%，只高 3.7pp；30 样本标准误约 8pp。热端同样落在噪声内。Δ 不是定价信号。
3. **单一比分预测完全失效。** top1 命中 0/7。因此本 Skill 只输出带概率的 top-5 排名分布。

## 逐场判定规则

对每一场先算四个量：去水概率 `dev[i]`、缺口 `Δ[i] = 支持率 − 去水`、模型偏差 `md[i] = 模型概率 − 去水`、`ev[i] = p × odds − 1`。

| 条件 | 级别 | 输出示例 |
|---|---|---|
| SPF 未开售，仅让球盘，模型最高侧 EV > 2% | 关注 | `让球盘 客胜 3.05｜模型 29.4% vs 隐含 27.2%，EV +7.1%` |
| 支持率第一方向 ≠ 去水第一方向 | 关注 | `主胜 2.10｜资金在客胜（Δ+38pp）与定价相反，回测中此类场次定价方 3/3 命中，采信定价` |
| Δ ≥ +15pp 且模型不支持该侧 | 回避 | `主胜 1.44｜人气 +10pp，模型仅 66.8% 低于去水 67.5%，价格不含补偿` |
| Δ ≤ −8pp **且** 模型同向 **且** max\|md\| ≥ 2pp | 关注 | `客胜 3.61｜缺口 −20pp 且模型同向，EV +5.1%` |
| max\|md\| ≤ 3pp | 观望 | `观望｜模型与去水偏差 1.5pp，定价有效` |
| 其余 | 中性 | `中性｜模型偏差 3.1pp，人气 Δ 5pp，无结构性错价` |

与上一版的三处关键差异：**取消「Δ ≤ −8pp 即小注」**、**热端不是卖出理由**（只标价格不含补偿）、**新增分歧规则**。

**串关的结构性事实**：每腿 `p × odds` 恒等于 `1/(1+margin)`，margin 为 13.9% 时单腿 0.878、两串 0.771、三串 0.677。串关 EV 必然为负，倍率越高越负。报告结论固定为**单关优先**。

## 数据源

核心四层（默认必抓）：

| 层 | 源 | 用途 |
|---|---|---|
| A | 中国竞彩网 `www.lottery.gov.cn/jc/jsq/zqspf/` | 在售场次、全部玩法赔率、支持率、官方去水概率（唯一法定价基准） |
| A | 中国竞彩网 `www.sporttery.cn/jc/zqdz/` | **官方伤停与停赛一览、历史交锋近 5 次**（官方数据接口） |
| B | 捷报 `cp.nowscore.com` + `live.nowscore.com` | **主客分离得失球、联赛盘路、18 家博彩公司初盘与即时亚盘/水位/大小球、天气场地** |
| C | 直播吧 `www.zhibo8.com` | 伤停、首发、赛程、动机线索 |
| D | 联网搜索 | 官方公告、xG/xGA、天气、裁判、联赛形势 |

扩展源（按缺口启用）：球探 `zq.titan007.com`（盘路）、500 彩票网、OddsPortal / Oddspedia（跨庄变价方向）、Betfair / Smarkets（真实成交）、FBref / Understat（xG）、Sofascore / FotMob（首发）、Transfermarkt（伤停与身价）、中国天气网。

**B 层是独立模型的命脉。** 没有主客分离得失球，模型退化为盘口复述——此时必须在数据卫生层写明「独立模型缺失，本报告仅为盘口分析」。完整口径与关键词模板见 [references/data-collection.md](references/data-collection.md)。

## 核心 API

`scripts/analyze.js` 导出的函数：

| 函数 | 作用 |
|---|---|
| `devig(odds)` | 去水，返回 `{p, m, overround}` |
| `grid(lambdaTotal, w, rho)` | 12×12 泊松 + Dixon-Coles 比分网格 |
| `summarize(g)` / `topScores(g, n)` | 从网格汇总胜平负/大小球/双方进球；最高概率比分 |
| `goalBuckets(g)` / `goalIntervals(g)` | 总进球 8 桶与 4 区间 |
| `rqProb(g, hc)` | 让球盘三项概率 |
| `hafu(g)` | 半全场 9 项分布 |
| `fitFromZJQ(zjq, spf)` / `fit2D(spf)` | 市场映像：由盘口反解 λ 与 w |
| `teamStrength(home, away, form)` | **独立强度模型**：比率法 + 样本量收缩（K=8）+ 近 6 场状态（权重 0.15） |
| `blendModels(market, team, k)` | 融合，默认 k=0.35 |
| `predictMatch(row)` | **一次产出全部**：λ 三来源、比分分布、总进球桶与区间、胜平负、让球、双方进球、半全场、综合预测、判定 |
| `backtest(preds, results)` | 回测校准：逐市场命中率与盘口隐含对比 |
| `ev(p, odds)` / `combo(legs)` | 期望值 / 串关联乘 |

## 免责声明

- 本项目是**统计与定价方法论**的开源实现，仅供研究与学习使用。
- **不构成任何投注建议，不承诺任何收益。** 报告中的所有概率均为盘口与模型的推算值。
- 博彩具有极高风险，参与即可能损失全部本金。请遵守所在地区的法律法规，未满 18 周岁禁止参与。
- 数据来源为公开网站的实时快照，可能有时点误差、缺失或错误；使用者需自行复核。
- 作者不对因使用本项目产生的任何后果承担责任。

## 贡献

欢迎提交 Issue / PR：新增数据源、修正模型、补充联赛样本清洗规则、改进报告版式。

## 许可

[MIT](LICENSE)

---

## English

### What this is

**jc-football-report** is an open-source Agent Skill for China Sports Lottery football (竞彩足球). It does not try to "pick the winner". It treats the market as a **pricing problem**: strip the bookmaker's margin out of the odds to recover implied probabilities, build a model that is independent of those odds, then compare model probability, de-vigged probability and public betting support to surface **structural mispricing** — and write that comparison up as a reproducible, per-match verdict plus a PDF report.

Core stance: **calibration over prediction.** Being right on one match means nothing; estimating probabilities well over many matches and knowing exactly where the margin is taken is the whole point.

### Key ideas

- **De-vig everything.** Strip the 13%+ overround before comparing anything.
- **Price against sharp books.** Use low-margin sharp lines as the probability benchmark, not the high-margin local book.
- **Build an independent model.** Re-deriving probabilities from the odds is just restating the book. v2 fits a Dixon-Coles strength model from home/away split goal data, then blends it with the market at k=0.35.
- **Injuries are a disclosed manual override.** v3 applies an explicit λ adjustment for confirmed absences — the basis must be stated in the report, never silently baked in.
- **Two-part report.** Facts first (data analysis), conclusions second (forecast and stake plan). Read only part two to decide; read only part one to audit.
- **Forecast in reliability order.** Every match gets 1X2 → total-goals band → top-5 correct-score distribution. **Never a single score** — top1 hit 0/7 in backtest, top5 hit 71.4%.
- **Backtest first.** Every round starts by scoring the previous round and comparing hit rates against the book's implied probabilities before any new analysis.
- **Δ is not a signal.** "Back the cold side" was falsified: cold options landed 30.0% vs 26.3% implied — inside an 8pp standard error.
- **Traceable data.** Every number in the model must trace back to a source. Untraceable numbers stay in prose, marked "unverified".
- **Parleys are structurally −EV.** Each leg's `p × odds` equals `1/(1+margin)`: with a 13.9% margin a single leg returns 0.878, a two-leg parley 0.771, a three-leg 0.677. The report therefore always concludes **singles first**.
- **Skill stores method only.** No specific odds, fixtures or conclusions are committed to this repo — those belong to a single report run.

### How a report is built (seven layers)

| Layer | Content |
|---|---|
| 1 Backtest calibration | Previous round's per-market hit rate, actual vs. implied, status of open "to verify" items |
| 2 Pricing engine | Margin, de-vig, three λ sources (market / independent / blended), score matrix, per-bucket total-goals EV |
| 3 Fundamentals | Official injuries and suspensions, head-to-head, recent form, weather and pitch |
| 4 Market intelligence | Opening → current line (1X2 + Asian handicap + O/U), local vs. international pricing gap, popularity tax |
| 5 Sub-markets | Handicap EV, over/under, score and half-time/full-time principles |
| 6 Per-match forecast | For each fixture: top-5 scores → total-goals band and buckets → 1X2 → handicap → verdict |
| 7 Data hygiene | Eight checks with per-item status, source list, missing fields, model-change log |

### Quick start

Zero runtime dependencies; requires Node.js only (>= 14).

```bash
# install as an agent skill (Trae / Claude Code global skills dir)
git clone https://github.com/laoyangnb666/jc-football-report.git \
  ~/.trae-cn/skills/jc-football-report

# or just run the built-in self-check
node jc-football-report/scripts/analyze.js
```

The directory name must be `jc-football-report`, matching the `name` field in the `SKILL.md` frontmatter.

Use it as a library:

```js
const { predictMatch, backtest } = require('./scripts/analyze.js');

const p = predictMatch({
  no: 'Mon004', lg: 'Serie A', home: 'Atalanta', away: 'Parma',
  kickoff: '2026-11-03 03:45', hc: -1,          // handicap line
  spf: [1.30, 4.65, 6.45], rq: [2.07, 3.40, 2.76],
  supSPF: [78, 13, 9],                          // public support (%)
  zjq: [17, 7, 4.25, 3.10, 4.20, 7.20, 15, 20], // total-goals odds
  team: {                                       // home/away split goals
    home: { home: { gf: 15, ga: 6, p: 5 }, away: { gf: 8, ga: 9, p: 5 } },
    away: { home: { gf: 7, ga: 10, p: 5 }, away: { gf: 5, ga: 13, p: 5 } },
    form: { home: { gf: 9, ga: 6, p: 5 }, away: { gf: 4, ga: 12, p: 5 } },
  },
});

console.log(p.lambdaTotal, p.w);        // blended λ and home share
console.log(p.probs.H, p.probs.D, p.probs.A);
console.log(p.forecast.spf, p.forecast.spfP);   // 1X2 pick + probability
console.log(p.forecast.goals, p.forecast.goalsP); // total-goals band
console.log(p.forecast.scores);         // top-5 scoreline distribution
console.log(p.verdict.level, p.verdict.reason);

// backtest: score predictions against actual scores
const bt = backtest([p], { Mon004: [3, 1] });
console.log(bt.hit);                    // per-market hit rate
```

### Repo layout

```
jc-football-report/
├── SKILL.md                        # Skill entry: hard rules, workflow, verdict rules
├── references/
│   ├── model-and-calibration.md    # Model math + 33-match backtest (tune thresholds here)
│   ├── analysis-framework.md       # Full analysis checklist (eight sections)
│   ├── data-collection.md          # Source list, collection conventions, cross-checks
│   └── report-template.md          # Seven-layer report structure and typography tokens
├── scripts/
│   └── analyze.js                  # de-vig / Dixon-Coles / strength model / blend / forecast / backtest
├── LICENSE
└── README.md
```

### Core API (`scripts/analyze.js`)

| Function | Purpose |
|---|---|
| `devig(odds)` | Remove the margin; returns `{p, m, overround}` |
| `grid(lambdaTotal, w, rho)` | 12×12 Poisson + Dixon-Coles score grid |
| `summarize(g)` / `topScores(g, n)` | 1X2 / O-U / BTTS from the grid; highest-probability scorelines |
| `goalBuckets(g)` / `goalIntervals(g)` | Total goals in 8 buckets and 4 bands |
| `rqProb(g, hc)` | Three-way Asian-handicap probabilities |
| `hafu(g)` | Half-time/full-time 9-way distribution |
| `fitFromZJQ(zjq, spf)` / `fit2D(spf)` | Market mirror: back out λ and w from the prices |
| `teamStrength(home, away, form)` | **Independent model**: ratio method + sample-size shrinkage (K=8) + last-6 form (weight 0.15) |
| `blendModels(market, team, k)` | Blend, default k=0.35 |
| `predictMatch(row)` | **Everything in one call**: three λ sources, score distribution, goal buckets and bands, 1X2, handicap, BTTS, HT/FT, forecast, verdict |
| `backtest(preds, results)` | Calibration: per-market hit rate vs. implied probability |
| `ev(p, odds)` / `combo(legs)` | Expected value / parley multiplication |

### Backtest: 33 settled matches

Of 42 matches in the previous round, 33 had settled — enough to quantify how wrong the model is:

| Measure | Hits | Hit rate |
|---|---|---|
| De-vigged top direction | 20 / 32 | **62.5%** |
| Public-support top direction | 17 / 32 | **53.1%** |
| Model top direction (7 focus matches) | 5 / 7 | 71.4% |
| Over/under 2.5 direction | 6 / 7 | 85.7% |
| Correct score top1 / top3 / top5 | 0 / 3 / 5 (of 7) | 0% / 42.9% / **71.4%** |

Three findings changed the design: (1) following the price beats following the crowd by 9.4pp — in matches where price and money disagreed the pricing side went 3/3; (2) "small stake on the cold side" was falsified — cold options realised 30.0% vs. 26.3% implied, a 3.7pp gap inside an ~8pp standard error at n=30; (3) single-scoreline forecasts are useless (0/7), hence only a probability-ranked top-5 distribution is published.

### Data sources

Four core layers, always collected: China Sports Lottery (`lottery.gov.cn` — on-sale fixtures, all prices, public support, official de-vigged probabilities), the official injury/suspension and H2H feeds (`sporttery.cn`), Nowscore (`cp.nowscore.com` / `live.nowscore.com` — home/away split goals, 18 bookmakers' opening and live lines, weather and pitch), and Zhibo8 for line-ups and motivation. Extended sources are enabled per gap: Titan007, OddsPortal / Oddspedia, Betfair / Smarkets, FBref / Understat, Sofascore / FotMob, Transfermarkt.

Nowscore is the lifeline of the independent model: without home/away split goal data the model degrades into restating the book, and layer 7 must then state "independent model unavailable — market analysis only".

### Disclaimer

**For research and educational purposes only. Not betting advice. No guaranteed returns.** All probabilities are estimates derived from prices and models. Gambling carries a high risk of losing all capital. Comply with local laws; 18+ only. Data are live snapshots of public sites and may be stale, missing or wrong — verify before use. The author accepts no liability for any consequence of using this project.

Licensed under [MIT](LICENSE).

See [SKILL.md](SKILL.md) for the workflow, [references/model-and-calibration.md](references/model-and-calibration.md) for the model math and the 33-match backtest, and [references/data-collection.md](references/data-collection.md) for the source list.