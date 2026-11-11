/* Skill 文档页词典 */
I18N.extend({
  dict: {
    'Skill 文档 · jc-football-report': 'Skill Docs · jc-football-report',
    'jc-football-report Skill 完整文档：铁律、七步流程、逐场判定规则、购买方案层、数据源口径、报告骨架与交付前自检。':
      'Full jc-football-report skill documentation: hard rules, seven-step workflow, per-match verdict rules, betting-plan layer, source conventions, report skeleton and pre-delivery checklist.',
    'Skill documentation': 'Skill documentation',

    /* 目录 / 标题 */
    '一、铁律': '1 · Hard rules',
    '二、七步流程': '2 · Seven-step workflow',
    '三、逐场判定规则': '3 · Per-match verdict rules',
    '四、购买方案层': '4 · Betting-plan layer',
    '五、数据源': '5 · Data sources',
    '六、报告骨架': '6 · Report skeleton',
    '七、串关的结构性事实': '7 · Parlay arithmetic',
    '八、核心 API': '8 · Core API',
    '九、交付前自检': '9 · Pre-delivery checklist',
    '参考文件': 'References',
    '目录': 'Contents',

    /* 正文短句 */
    '按顺序执行，不要跳步。': 'Run in order. Do not skip steps.',
    '先算四个量：': 'Compute four quantities first:',
    '产出一份可复算的报告：把赔率还原成概率，用': 'Produce a reproducible report: turn the odds back into probabilities, build your own probabilities from',
    '做出自己的概率，再把两者与公众资金流三方对照，并对每一场写出综合预测与购买方案。':
      'make your own probabilities, then triangulate both against public money flows, and write a combined forecast plus betting plan for every match.',
    '盘口之外的独立信息': 'information independent of the line',

    /* 表头 */
    '#': '#',
    '条件': 'Condition',
    '级别': 'Level',
    '理由模板': 'Reason template',
    '含义': 'Meaning',
    '仓位': 'Stake',
    '层': 'Layer',
    '源': 'Source',
    '取什么': 'What we take',
    '边界': 'Boundary',
    '篇': 'Part',
    '章节': 'Section',
    '内容': 'Contents',
    '串关': 'Parlay',
    '返还率': 'Return',
    '说明': 'Notes',
    '函数': 'Function',
    '作用': 'Purpose',
    '文件': 'File',
    '步骤': 'Step',
    '要点': 'Key points',

    /* 判定级别 */
    '主推': 'Strong pick',
    '小注': 'Small stake',
    '观察': 'Watch',
    '回避': 'Avoid',
    '关注': 'Watch',
    '观望': 'Hold',
    '中性': 'Neutral',

    /* 判定表 */
    'SPF 未开售，仅让球盘，模型最高侧 EV > 2%': 'No 1X2; handicap only, model’s best side EV &gt; 2%',
    '支持率第一方向 ≠ 去水第一方向': 'Public money top side ≠ de-vig top side',
    'Δ ≥ +15pp 且模型不支持该侧': 'Δ ≥ +15pp and the model does not support that side',
    'max|md| ≤ 3pp': 'max|md| ≤ 3pp',
    '其余': 'Everything else',
    '模型 61.2% vs 隐含 47.0%，EV +12.8%': 'Model 61.2% vs implied 47.0%, EV +12.8%',
    '人气 +20pp，模型仅 15.3% 低于去水 22.0%，价格不含补偿':
      'Public +20pp, model only 15.3% vs de-vig 22.0% — price carries no compensation',
    '模型与去水偏差 1.5pp，定价有效': 'Model vs de-vig gap 1.5pp; pricing is efficient',
    '模型偏差 3.1pp，人气 Δ 5pp，无结构性错价': 'Model gap 3.1pp, public Δ 5pp; no structural mispricing',

    /* 购买方案表 */
    '有跨轮回测支撑的结构性信号，模型与市场同向':
      'Structural signal backed by cross-round backtests, model and market aligned',
    '计划资金 1–2%': '1–2% of planned bankroll',
    '单一市场有正 EV（让球盘 EV>2%、大小球模型与盘路同向）':
      'A single market with positive EV (handicap EV &gt;2%, totals model aligned with cover trend)',
    '0.5–1%': '0.5–1%',
    '无边际或信号冲突；必须写明「等什么」（首发 / 临场价格）':
      'No edge or conflicting signals; must state what you are waiting for (lineups / live price)',
    '0': '0',
    '人气过热（Δ ≥ +15pp）且模型不支持': 'Overcrowded (Δ ≥ +15pp) and unsupported by the model',
    '0，并注明为什么': '0, with a stated reason',

    /* 数据源表 */
    '在售场次、全部玩法赔率、支持率、官方去水概率':
      'On-sale matches, all pool odds, public support rate, official de-vig probabilities',
    '唯一法定价，定价基准': 'The only legal price; pricing benchmark',
    '官方伤停停赛一览（含位置与首发场次）、历史交锋近 5 次':
      'Official injury/suspension list (position and starts) and last 5 head-to-heads',
    '官方数据，伤停首选': 'Official data; first choice for injuries',
    '主客分离得失球、联赛盘路、18 家初盘与即时欧赔/亚盘水位/大小球、天气场地':
      'Home/away split goals, league cover trends, 18 bookmakers’ open and live prices, weather and venue',
    '独立模型的唯一输入来源': 'The only input source for the independent model',
    '伤停、首发、赛程冲突、动机线索': 'Injuries, lineups, fixture congestion, motivation',
    '定性，需第二来源确认': 'Qualitative; needs a second source',
    'xG/xGA、官方公告、裁判、联赛形势、换帅与预计首发':
      'xG/xGA, official statements, referees, league context, managerial changes, projected lineups',
    '每个数字必须能点回原页': 'Every number must link back to its page',

    /* 报告骨架表 */
    '上一轮逐市场命中率 + 盘口隐含对照 + 待验证清单状态':
      'Last round’s hit rate per market + implied comparison + open-question status',
    'margin、去水、λ 三来源、比分矩阵、总进球逐桶 EV':
      'Margin, de-vig, three λ sources, scoreline matrix, per-bucket goals EV',
    '官方伤停表、历史交锋、盘路（主客分开）、天气场地':
      'Official injuries, head-to-heads, cover trends (home/away split), weather and venue',
    '初盘→即时、竞彩 vs 国际偏离、人气税热冷两端':
      'Open → live lines, China vs international divergence, public-money extremes',
    '八条检查项、源清单（含访问时间）、缺失字段、伤停修正披露':
      'Eight checks, source list (with visit time), missing fields, injury-adjustment disclosure',
    '每场：①胜平负 ②总进球（方向 + 8 桶）③比分 top-5 分布':
      'Each match: ① 1X2 ② goals (direction + 8 buckets) ③ scoreline top-5 distribution',
    '级别 + 玩法 + 选项 + 赔率 + 概率/隐含 + EV + 仓位 + 否决条件':
      'Level + market + selection + odds + probability/implied + EV + stake + kill criteria',
    '赔率/去水/支持率/λ/综合预测/级别/方案':
      'Odds / de-vig / public / λ / forecast / level / plan',
    '串关测算（全部标 EV，结论固定单关优先）、资金管理、复核时点':
      'Parlay maths (EV on all, conclusion always singles-first), bankroll, review timing',
    '免责、样本量、开赛前 60 分钟重跑提示':
      'Disclaimer, sample size, reminder to re-run 60 minutes before kick-off',

    /* 串关表 */
    '基准': 'Baseline',
    '单关': 'Single',
    '两串': '2-leg',
    '三串': '3-leg',
    '五串': '5-leg',

    /* 小标题 */
    '超短赔主推规则': 'Short-odds strong-pick rule',
    '焦点场加详': 'Extra detail for focus matches',
    '解析陷阱': 'Parsing traps',

    /* API 表 */
    '去水，返回 {p, m, overround}': 'De-vig; returns {p, m, overround}',
    '12×12 泊松 + Dixon-Coles 比分网格': '12×12 Poisson + Dixon-Coles scoreline grid',
    '汇总胜平负/大小球/双方进球；最高概率比分': 'Summarise 1X2 / over-under / BTTS; top scorelines',
    '总进球 8 桶与 4 区间': 'Goals in 8 buckets and 4 intervals',
    '让球盘三项概率（hc 为主队视角让球数）': 'Handicap three-way probabilities (hc from the home side)',
    '半全场 9 项分布': 'Half-time/full-time 9-way distribution',
    '市场映像：由盘口反解 λ 与 w': 'Market mapping: back-solve λ and w from the line',
    '独立强度模型：比率法 + 样本量收缩（K=8）+ 近 6 场状态（权重 0.15）':
      'Independent strength model: ratio method + sample shrinkage (K=8) + last-6 form (weight 0.15)',
    '融合，默认 k = 0.35': 'Blend, default k = 0.35',
    '一次产出全部：λ 三来源、比分分布、总进球桶与区间、胜平负、让球、双方进球、半全场、判定、购买方案':
      'Produces everything: three λ sources, scoreline distribution, goals buckets and intervals, 1X2, handicap, BTTS, HT/FT, verdict, betting plan',
    '购买方案层：级别 + 玩法 + 仓位 + 否决条件': 'Betting-plan layer: level + market + stake + kill criteria',
    '回测校准：逐市场命中率与盘口隐含对比': 'Backtest calibration: per-market hit rate vs implied',
    '期望值 / 串关联乘': 'Expected value / parlay multiplication',

    /* 参考文件 */
    'Skill 主入口：铁律、流程、判定规则': 'Skill entry point: hard rules, workflow, verdict rules',
    '模型数学定义 + 33 场回测校准结果（改阈值看这里）': 'Model maths + 33-match calibration (change thresholds here)',
    '八节完整分析检查表，每条标注数据源与用途': 'Eight-section analysis checklist with source and purpose per item',
    '核心四层 + 13 个扩展数据源、采集口径、交叉校验': 'Four core layers + 13 extended sources, collection conventions, cross-validation',
    '两篇式结构、购买方案层规范、排版 token': 'Two-part structure, betting-plan spec, layout tokens',
    '零依赖内核，可直接 node 运行自检': 'Zero-dependency core; run with node for a self-test',
    '独立强度模型（比率法 + 收缩）': 'Independent strength model (ratio + shrinkage)',
    '一': 'I',
    '二': 'II',

    /* 流程表步骤名 */
    '回测上一轮': 'Backtest last round',
    '采集': 'Collect',
    '建模': 'Model',
    '判定与方案': 'Verdict & plan',
    '补齐逻辑': 'Fill the logic',
    '组装': 'Assemble',
    '渲染与交付': 'Render & deliver',

    /* 判定表长句（片段已被部分替换，这里整句兜底） */
    '资金在平局（Δ+5pp）与定价相反，回测中此类场次定价方 3/3 命中，采信定价':
      'Money sits on the draw (Δ+5pp) against the price; such matches went 3/3 to the pricing side, so trust the price',
    'Δ ≤ −8pp 且 模型同向 且 max|md| ≥ 2pp': 'Δ ≤ −8pp and model aligned and max|md| ≥ 2pp',
    '缺口 −8pp 且模型同向（33.2% vs 28.3%），EV +5.1%':
      'Gap −8pp and model aligned (33.2% vs 28.3%), EV +5.1%',
    '缺口 −8pp 且模型同向': 'Gap −8pp and model aligned',

    /* 数据源表名称列 */
    '竞彩官网 lottery.gov.cn/jc/jsq/zqspf/': 'Official site lottery.gov.cn/jc/jsq/zqspf/',
    '竞彩官网 sporttery.cn/jc/zqdz/': 'Official site sporttery.cn/jc/zqdz/',
    '捷报 cp.nowscore.com + live.nowscore.com': 'Nowscore cp.nowscore.com + live.nowscore.com',
    '直播吧 zhibo8.com': 'Zhibo8 zhibo8.com',
    '联网搜索': 'Web search',

    /* 报告骨架章节 */
    '1 回测校准': '1 Backtest calibration',
    '2 定价引擎': '2 Pricing engine',
    '3 基本面': '3 Fundamentals',
    '4 市场情报': '4 Market intelligence',
    '5 数据卫生': '5 Data hygiene',
    '6 逐场综合预测': '6 Per-match forecast',
    '7 逐场购买方案': '7 Per-match betting plan',
    '8 全量总表': '8 Full summary table',
    '9 执行层': '9 Execution layer',
    '10 风险披露': '10 Risk disclosure',

    /* 代码旁注 */
    '去水，返回': 'De-vig; returns',
    '且': 'and',
    '模型同向': 'model aligned',
    '竞彩官网': 'Official site',
    '捷报': 'Nowscore',
    '直播吧': 'Zhibo8',
  },

  html: {
    'sk.lead': 'This document is the <b>generation spec</b> for reports, not a user manual. It fixes the order of steps, verdict thresholds, mandatory disclosure fields and the pre-delivery checklist. Every round of reports must be checked against it line by line.',
    'sk.title': 'Skill documentation: <span class="serif" style="color:var(--green)">method and discipline.</span>',
    'sk.intro': 'Produce a reproducible report: turn the odds back into probabilities, build your own probabilities from <b>information independent of the line</b>, triangulate both against public money flows, and write a combined forecast plus betting plan for every match.',

    'sk.r1': '<b>Every match needs a combined forecast.</b> With N matches on sale, write N rows, always in the order scoreline (top-5 distribution) → goals (interval + over/under) → 1X2. Never focus only on the headline games.',
    'sk.r2': '<b>Every match needs a betting plan.</b> Land on a concrete market and selection (home/draw/away/handicap side/a goals bucket/avoid), with stake and kill criteria. The reason must contain at least one number.',
    'sk.r3': '<b>Never a single scoreline.</b> Two-round backtest: top1 hit 0/23, top3 42.9%, top5 71.4%. Give only a ranked distribution with probabilities and cumulative coverage.',
    'sk.r4': '<b>The model needs inputs beyond the line.</b> Back-solving λ from the odds and pushing probabilities back out is just repeating the market (deviation always &lt;3pp). You must ingest Nowscore’s home/away split goals.',
    'sk.r5': 'The report does pricing and intelligence analysis only; it promises no returns. Probabilities are estimates from model and market.',
    'sk.r6': 'Every number must come from script output. No hand-written estimates.',
    'sk.r7': 'Every number entering the model must be traceable to a source; anything untraceable goes into the text marked “to verify”.',
    'sk.r8': '<b>Backtest before conclusions.</b> Each round must run <code>backtest()</code> on the previous round’s finished matches, write “actual hit rate vs implied probability” into the report, and only then adjust thresholds.',
    'sk.r9': 'This skill captures method and layout only. It stores no specific odds, matches or conclusions from any round.',

    'sk.flowP': 'Run in order. Do not skip steps.',
    'sk.f1': 'Take the finished scorelines, run <code>backtest(preds, results)</code> for per-market hit rates, and check the open-question list. <b>Do this before collecting new data.</b>',
    'sk.f2': 'Official on-sale matches (all pools + public support + official probabilities), Nowscore per match (home/away split goals, cover trends, 18 bookmakers’ open and live lines, weather), plus Zhibo8 and search to fill injuries and motivation.',
    'sk.f3': '<code>predictMatch(row)</code> produces λ (market + own + injury adjustment), scoreline distribution, goals buckets and intervals, 1X2, handicap, BTTS and half-time/full-time.',
    'sk.f4': '<code>verdict</code> gives the short verdict, <code>rec</code> gives the full betting plan. Do not hand-edit thresholds.',
    'sk.f5': 'Walk the eight-section analysis checklist and mark each item as in-model / in-text / downgraded for missing data.',
    'sk.f6': 'Write the HTML in the two-part structure: part one states facts, part two gives conclusions only.',
    'sk.f7': 'A4, printBackground, margin 0; drop the PDF into the workspace and deliver a link plus three core conclusions.',

    'sk.vCode': 'dev[i]  de-vig probability\nΔ[i]    = public support − de-vig  (pp)\nmd[i]   = model probability − de-vig  (pp)\nev[i]   = p × odds − 1',
    'sk.vCallout': '<b>Why “cold-side value small stake” was removed:</b> in the first backtest, cold-side selections (Δ ≤ −8pp) converted 30.0% against 26.3% implied — only 3.7pp above. The hot side converted 59.1% vs 49.2% implied. With ~8pp standard error on 30 samples, both sit inside the noise. <b>Δ is not a pricing signal; it is a risk flag only.</b>',

    'sk.recP': 'Every match must ship a complete plan — never stop at “watch/hold”.',
    'sk.recH4a': 'Short-odds strong-pick rule',
    'sk.recPa': 'De-vig top-side probability ≥ 66% <b>and</b> model aligned <b>and</b> injury adjustment on that side ≥ −0.15 <b>and</b> no conflict in money flow → strong single. If any condition fails, downgrade to watch and say why.',
    'sk.recPb': 'The plan probability uses the <b>cross-round empirical 91.7% (11/12, 12 samples, SE ≈ 8pp)</b>, not model output; it must be starred in the report.',
    'sk.recH4b': 'Extra detail for focus matches',
    'sk.recPc': 'Any of: public Δ ≥ 15pp, injury adjustment ≥ 0.2, price move ≥ 0.15 marks a focus match. The plan must then include a primary and alternative market, a scoreline entertainment stake (≤0.5% per bet, top-2 scorelines) and the live kill criteria.',
    'sk.recCode': 'Wed 004 Fenerbahçe vs Liverpool | Strong pick | Focus\n  Primary: 1X2 (single) Away @1.33 | de-vig 66.0% / implied 75.2% | stake 1–2%\n  Reason: short-odds zone cross-round 11/12 = 91.7%; model aligned; Fenerbahçe new manager + 5 injuries\n  Kill: if the lineup rests Salah/Van Dijk entirely → drop it\n  Scoreline entertainment: 1-2 (9.7%), 1-1 (9.3%) at 0.5% each',

    'sk.srcP': 'Extended sources (enable as gaps appear): Titan007 <code>zq.titan007.com</code> (cover trends vs standard lines), Nowscore archives, 500.com, OddsPortal / Oddspedia (cross-book moves), Betfair / Smarkets (real fills), FBref / Understat (xG), Sofascore / FotMob (lineups), Transfermarkt (injuries and values), China Weather.',
    'sk.srcCallout': '<b>Layer B is the lifeline.</b> Without home/away split goals the independent model cannot be built and the report falls back to “repeating the line” — in that case the data-hygiene section must state “independent model missing; this report is line analysis only”.',
    'sk.srcH4': 'Parsing traps',
    'sk.srcLi1': 'The Nowscore odds table uses <b>uppercase</b> <code>&lt;TR&gt;</code> <code>&lt;TD&gt;</code>; the regex must be case-insensitive (<code>re.I</code>).',
    'sk.srcLi2': 'Some bookmakers (e.g. Ladbrokes) do not offer Asian lines and return only 12 data columns. <b>Never delete empty cells to align columns</b> — that shifts everything and yields absurd values such as “home win 1.06”.',
    'sk.srcLi3': 'Validate after parsing: all three European odds ≥ 1.01 and the inverse sum within 1.00–1.30; drop rows that fail.',

    'sk.skelP': '<b>Two-part structure</b>: part one states facts only, part two gives conclusions only. Read part two to act, read part one to verify.',

    'sk.comboP': 'Each leg’s <code>p × odds</code> always equals <code>1/(1+margin)</code>. With a 13.9% margin:',
    'sk.comboQuote': 'Parlay EV is necessarily negative, and more legs make it worse. That is not a leg-selection problem but a structural one. The report must list at least three measured parlays with EV, and the conclusion is always “singles first”.',

    'sk.checkLi4': '<b>No single scoreline prediction anywhere</b>',
    'sk.checkLi1': 'Backtest layer done, with an implied-probability comparison next to every hit rate',
    'sk.checkLi2': 'Match count = forecast rows = plan rows',
    'sk.checkLi3': 'Every match has scoreline / goals / 1X2 sections, with no “TBD”',
    'sk.checkLi5': 'λ states market value, own value, injury adjustment and blend weight k',
    'sk.checkLi6': 'Table numbers match <code>predictMatch</code> output exactly',
    'sk.checkLi7': 'All parlays carry EV, conclusion is singles-first',
    'sk.checkLi8': 'Data-hygiene items all have a status; missing ones state why',
    'sk.checkLi9': 'Final page lists sources, visit time (minute-level), missing fields and risk disclosure',
    'sk.checkLi10': 'PDF is in the workspace and the link works',

    'sk.end': 'Want to try it? <a href="simulator.html" style="color:var(--green);font-weight:500">Open the simulator</a> and work out the edge yourself with live odds and model probabilities.',

    'sk.ratioCode': 'hg  = home goals per home game      hga = home conceded per home game\nag  = away goals per away game      aga = away conceded per away game\n\nlgHome = (hg + aga) / 2        // league baseline, two estimates cross-checked\nlgAway = (ag + hga) / 2\n\nshrink(x, p) = 1 + (x − 1) · p / (p + K)      // K = 8\nattH = shrink(hg / lgHome, home home-games)\ndefH = shrink(hga / lgAway, home home-games)\nattA = shrink(ag / lgAway, away away-games)\ndefA = shrink(aga / lgHome, away away-games)\n\nλ_home = lgHome · attH · defA\nλ_away = lgAway · attA · defH',
    'sk.ratioP': 'Why home/away must be split: home and away are effectively two different teams. Fitting on aggregate data flattens sides that are strong at home and weak away.',

    'sk.disclaimer': 'This project is an open-source implementation of statistical pricing methodology, for research and study only. All probabilities are model and market estimates. <b>Nothing here is betting advice, and no returns are promised.</b> Backtest samples are limited, with standard errors of 8–10pp; any deviation below 15pp is not statistically significant. Gambling carries extreme risk — you may lose your entire stake. Follow the laws of your jurisdiction; under-18s may not participate.',

    'sk.strongShort': '≥66% de-vig top side, model aligned, injury adj ≥ −0.15, no money-flow conflict',
    'sk.reasonDiv': 'Money sits on the draw (Δ+5pp) against the price; in backtests such matches went 3/3 to the pricing side, so trust the price',
    'sk.reasonCold': 'Gap −8pp and model aligned (33.2% vs 28.3%), EV +5.1%'
  },

  rules: [
    [/\u4e00\u3001\u94c1\u5f8b/, '1 · Hard rules'],
    [/\u4e8c\u3001\u4e03\u6b65\u6d41\u7a0b/, '2 · Seven-step workflow'],
    [/\u4e09\u3001\u9010\u573a\u5224\u5b9a\u89c4\u5219/, '3 · Per-match verdict rules'],
    [/\u56db\u3001\u8d2d\u4e70\u65b9\u6848\u5c42/, '4 · Betting-plan layer'],
    [/\u4e94\u3001\u6570\u636e\u6e90/, '5 · Data sources'],
    [/\u516d\u3001\u62a5\u544a\u9aa8\u67b6/, '6 · Report skeleton'],
    [/\u4e03\u3001\u4e32\u5173\u7684\u7ed3\u6784\u6027\u4e8b\u5b9e/, '7 · Parlay arithmetic'],
    [/\u516b\u3001\u6838\u5fc3 API/, '8 · Core API'],
    [/\u4e5d\u3001\u4ea4\u4ed8\u524d\u81ea\u68c0/, '9 · Pre-delivery checklist']
  ]
});