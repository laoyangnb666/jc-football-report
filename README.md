# 竞彩足球机构级分析报告

> 一个把中国体育彩票「竞彩足球」盘口还原成概率、并与公众资金流对比、找出结构性定价偏离的分析 Skill。
> 产出可复算的 PDF 报告，**每一场在售比赛都给出明确判断**。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node](https://img.shields.io/badge/Node.js-%3E%3D14-brightgreen)
![Skill](https://img.shields.io/badge/type-Agent%20Skill-blue)

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
| **逐场强制判断** | 在售 N 场就写 N 行判断，不允许只写焦点场、不允许「待定/需要观察」 |
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
const { verdictAll, devig, fitFromZJQ, combo } = require('./scripts/analyze.js');

// 每场比赛一行，字段顺序固定
const rows = [
  ['六023', '英超', '主队', '客队', '11-15 22:00', '-1',
   [2.10, 3.55, 3.40],   // 胜平负赔率
   [4.20, 3.80, 1.60],   // 让球赔率
   [29, 29, 42],         // 胜平负支持率 %
   [30, 30, 40],         // 让球支持率 %
   [12, 5.5, 3.6, 3.5, 4.6, 8.5, 15, 22], // 总进球 8 档（0/1/2/3/4/5/6/7+）
   null],                // 初盘欧赔，无则 null
];

verdictAll(rows).forEach(v => console.log(v.line));
```

## 目录结构

```
jc-football-report/
├── SKILL.md                        # Skill 主入口：铁律、流程、判定规则
├── references/
│   ├── analysis-framework.md       # 完整分析逻辑清单（八节检查表）
│   ├── data-collection.md          # 数据源清单与采集口径
│   └── report-template.md          # 报告六层结构与排版 token
├── scripts/
│   └── analyze.js                  # 去水 / Dixon-Coles / EV / 串关 / 逐场判定
├── LICENSE
└── README.md
```

## 分析方法论（六层）

| 层 | 内容 |
|---|---|
| 1 核心定价引擎 | margin、去水、λ/w 拟合、比分矩阵、总进球逐桶 EV |
| 2 基本面情报 | 伤停、动机、赛程、xG 与进球背离 |
| 3 市场情报 | 初盘到现价、聪明钱、人气税热冷两端 |
| 4 细分市场 | 让球盘 EV、深度让球、比分与半全场原则 |
| 5 数据卫生 | 八条检查项逐条给状态 |
| 6 复盘校准 | 已完场场次的双口径命中率 |

完整字段清单见 [references/analysis-framework.md](references/analysis-framework.md)，每条都标注了 `[源]`（去哪取）与 `[用]`（进模型 / 进报告 / 仅作背景）。

## 逐场判定规则

对每一场先算三个量：去水概率 `dev[i]`、缺口 `Δ[i] = 支持率 − 去水概率`、模型偏差 `md[i] = 模型概率 − 去水概率`。

| 条件 | 级别 | 输出示例 |
|---|---|---|
| Δ ≥ +15pp 且该侧是去水第一方向 | 回避 | `回避 主胜 1.71｜人气 +34pp，价格无补偿` |
| Δ ≤ −15pp 且该侧赔率 ≥ 2.5 | 小注 | `小注 客胜 3.61｜缺口 −20pp，仅限可承受全损仓位` |
| −15 < Δ ≤ −8pp | 关注 | `关注 平局 4.50｜缺口 −13pp，需基本面复核` |
| max\|md\| ≤ 1.5pp 且 Δ 在 [−8, +10] | 观望 | `观望｜定价有效，模型与盘口偏差 0.8pp，无边际` |
| SPF 未开售 | 让球判定 | `观望｜仅让球盘在售，模型 35.6% vs 隐含 33.9%` |
| 其余 | 中性 | `中性｜无缺口无冲突，不参与` |

**串关的结构性事实**：每腿 `p × odds` 恒等于 `1/(1+margin)`，margin 为 13.9% 时单腿 0.878、两串 0.771、三串 0.677。串关 EV 必然为负，倍率越高越负。报告结论固定为**单关优先**。

## 数据源

核心四层（默认必抓）：

| 层 | 源 | 用途 |
|---|---|---|
| A | 中国竞彩网 `www.lottery.gov.cn/jc/jsq/zqspf/` | 在售场次、全部玩法赔率、支持率（唯一法定价基准） |
| B | 捷报 `cp.nowscore.com` | 初盘欧赔、亚盘让球与水位、大小球、球队数据 |
| C | 直播吧 `www.zhibo8.com` | 伤停、首发、赛程、动机线索 |
| D | 联网搜索 | xG/xGA、官方公告、天气、裁判、联赛形势 |

扩展源（按缺口启用）：球探 `zq.titan007.com`（盘路）、500 彩票网、OddsPortal / Oddspedia（跨庄变价方向）、Betfair / Smarkets（真实成交）、Pinnacle 等锐利庄、FBref / Understat（xG）、Sofascore / FotMob（首发）、Transfermarkt（伤停与身价）、中国天气网。

**优先级**：`官方 > 交易所成交 > 锐利庄 > 聚合站均价 > 媒体`。完整口径与关键词模板见 [references/data-collection.md](references/data-collection.md)。

## 核心 API

`scripts/analyze.js` 导出的函数：

| 函数 | 作用 |
|---|---|
| `devig(odds)` | 去水，返回 `{p, m, overround}` |
| `grid(lambdaTotal, w, rho)` | 12×12 泊松 + Dixon-Coles 比分网格 |
| `summarize(g)` | 从网格汇总 主胜/平/客胜/大 2.5/双方进球 |
| `topScores(g, n)` | 最高概率比分 |
| `rqProb(g, hc)` | 让球盘三项概率（`hc` 为主队视角让球数） |
| `fitFromZJQ(zjqOdds, spfOdds)` | 有总进球赔率时，λ 由 P(0球) 反解 + 一维搜索 w |
| `fit2D(spfOdds)` | 无总进球赔率时，λ 与 w 二维拟合 |
| `ev(p, odds)` | 期望值 `p × odds − 1` |
| `combo(legs)` | 串关联乘 |
| `verdictOne(row)` / `verdictAll(rows)` | 逐场判定，输出判断行 |

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

**jc-football-report** is an open-source Agent Skill that turns China Sports Lottery football odds into comparable probabilities, then compares model output against market-implied prices and public money flow to surface structural mispricing.

Key ideas:

- **De-vig everything.** Strip the 13%+ overround before comparing anything.
- **Price against sharp books.** Use low-margin sharp lines as the probability benchmark, not the high-margin local book.
- **Verdict for every match.** If N matches are on sale, the report contains N written verdicts with a concrete pick and a numeric reason. No "TBD".
- **Traceable data.** Every number in the model must trace back to a source. Untraceable numbers stay in prose, marked "unverified".
- **Skill stores method only.** No specific odds, fixtures or conclusions are committed to this repo — those belong to a single report run.

Zero runtime dependencies; requires Node.js only.

```bash
git clone https://github.com/laoyangnb666/jc-football-report.git
node jc-football-report/scripts/analyze.js
```

See [SKILL.md](SKILL.md) for the workflow, [references/analysis-framework.md](references/analysis-framework.md) for the full analytical checklist, and [references/data-collection.md](references/data-collection.md) for the source list.

**Disclaimer:** For research and educational purposes only. Not betting advice. No guaranteed returns. Gambling carries a high risk of losing all capital. Comply with local laws; 18+ only.