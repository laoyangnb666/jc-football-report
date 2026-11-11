/* 模拟投注页词典 */
I18N.extend({
  dict: {
    'jc-football-report · 模拟投注 · 自己算边际': 'jc-football-report · Simulator · Work out the edge',
    '用当期在售场次的真实赔率与模型概率做模拟投注：自己算边际、看串关的乘方损耗。':
      'Simulate with live odds and model probabilities: work out the edge yourself and see how parlays compound the vig.',

    'Simulator · 当期快照': 'Simulator · Current snapshot',
    '自己算一遍': 'Run the numbers',
    '边际。': 'yourself.',
    '用当期在售场次的真实赔率与模型概率做模拟。左边选比赛与玩法，右边看资金敞口与串关损耗。':
      'Simulate with live odds and model probabilities. Pick a match and market on the left; watch exposure and parlay decay on the right.',
    '所有 EV 都是模型口径，不构成任何建议。': 'All EVs are model-based and are not advice.',

    '本轮在售': 'On sale now',
    '请选择一场比赛': 'Pick a match',
    '模拟资金池': 'Simulated bankroll',
    '单关': 'Single',
    '串关': 'Parlay',
    '敞口 0.0%': 'Exposure 0.0%',
    '投注单': 'Bet slip',
    '清空': 'Clear',
    '追加': 'Add',
    '本局原注': 'Stake',
    '还没有投注。左边点任意赔率加入。': 'No bets yet. Click any odds on the left to add one.',
    '资金不足': 'Insufficient funds',
    '投注笔数': 'Bets',
    '合计投注': 'Total stake',
    '期望回报（模型口径）': 'Expected return (model)',
    '期望盈亏': 'Expected P/L',
    '腿数': 'Legs',
    '串关倍率': 'Parlay odds',
    '联合概率（模型）': 'Joint probability (model)',
    '命中回报': 'Return if won',
    '串关至少需要 2 腿。': 'A parlay needs at least 2 legs.',
    '切成串关会怎样 → 切换到「串关」查看': 'What if parlayed? Switch to "Parlay" to see.',
    '比分概率（仅展示，未抓比分盘赔率）': 'Scoreline probabilities (display only; no correct-score odds captured)',
    '本场不参与': 'No bet on this match',
    'λ 来源 / 盘口位移': 'λ sources / line drift',
    '融合 λ': 'Blended λ',
    '市场 λ': 'Market λ',
    '独立 λ': 'Own λ',
    '伤停修正': 'Injury adj.',
    '亚盘位移': 'Asian drift',
    '家': 'books',
    '总进球（8 桶）': 'Total goals (8 buckets)',
    '让球胜平负': 'Handicap 1X2',
    '大 2.5': 'Over 2.5',
    '双方进球': 'BTTS',
    '模型': 'Model',
    '不投注': 'No bet',
    '球': 'goals',
    '注': 'bet',

    '这是模拟器。': 'This is a simulator.',
    '本页面为统计方法的模拟演示，使用虚拟资金，不涉及任何真实交易。': 'A statistical simulation with virtual funds. No real transactions.'
  },

  html: {
    'sim.title': 'Run the numbers <span class="serif" style="color:var(--green)">yourself.</span>',
    'sim.disc': 'This page is a statistical simulation using virtual funds. No real transactions are involved. <b>Nothing here is betting advice.</b> All probabilities are model and market estimates; China Sports Lottery margins are about 13.9%, so long-run expectation is negative. Gambling carries extreme risk — you may lose your entire stake. Follow the laws of your jurisdiction; under-18s may not participate.',
    'sim.warn': '<b>This is a simulator.</b> Virtual funds only, no real account connected. China Sports Lottery takes about 13.9%, so every single bet starts roughly 12 percentage points in the hole — most EVs you see here are negative, and that is the point.',
    'sim.lead': 'Simulate with live odds and model probabilities. Pick a match and market on the left; watch your exposure and parlay decay on the right. All EVs are model-based and are not advice.',
    'sim.singleNote': 'Single-bet return = the stake-weighted sum of (p × odds); p here is the <b>model</b> probability, so it can exceed the 86.1% de-vig line. Using de-vig probabilities instead, every bet sits exactly at 86.1%.',
    'sim.parlayNote': 'The realised return of these legs multiplied together is shown above. If every leg were priced at the standard 86.1%, an n-leg parlay would return 0.861<sup>n</sup>. <b>The more legs, the more the vig compounds.</b>',
    'sim.warnExpo': 'Exposure is above the 6% daily cap used by this method. Backtest rules: ≤2% per match, ≤6% per day.',
    'sim.warnStake': 'One bet exceeds 2% of the bankroll. The standard stake for a strong short-odds pick is 1–2%.',
    'sim.warnLegs': 'A 3-leg parlay already returns below 64% structurally; no amount of leg-picking fixes that product.'
  },

  phrases: [
    ['胜平负', '1X2'],
    ['让球胜平负', 'Handicap 1X2'],
    ['总进球', 'Goals'],
    ['让球', 'Handicap'],
    ['主队受让 ', 'Home +'],
    ['主队让 ', 'Home −'],
    ['主胜', 'Home'],
    ['客胜', 'Away'],
    ['平局', 'Draw'],
    ['主推', 'Strong'],
    ['小注', 'Small'],
    ['观察', 'Watch'],
    ['回避', 'Avoid'],
    ['不参与', 'No bet'],
    ['大 2.5', 'Over 2.5'],
    ['英锦标赛', 'EFL Trophy'],
    ['伯顿', 'Burton'],
    ['诺茨郡', 'Notts County'],
    ['布罗姆利', 'Bromley'],
    ['米尔顿', 'Milton Keynes'],
    ['谢周三', 'Sheffield Wed'],
    ['阿克宁顿', 'Accrington'],
    ['巴恩斯利', 'Barnsley'],
    ['奥德汉姆', 'Oldham'],
    ['共识λ ', 'Market λ '],
    ['独立λ ', 'Own λ '],
    ['融合 ', 'Blend '],
    ['亚盘位移 ', 'Asian drift '],
    ['伤停修正 ', 'Injury adj. '],
    [' 家', ' books'],
    [' 场', ' matches'],
    ['模型 ', 'Model '],
    ['模型', 'Model'],
    [' 球 ', ' goals '],
    [' 球', ' goals'],
    ['｜', ' · ']
  ]
});

/* 动态组合规则 */
I18N.extend({
  rules: [
    [/\u5468\u4e00(\d{3})/, 'Mon $1'],
    [/\u5468\u4e8c(\d{3})/, 'Tue $1'],
    [/\u5468\u4e09(\d{3})/, 'Wed $1'],
    [/\u5468\u56db(\d{3})/, 'Thu $1'],
    [/\u5468\u4e94(\d{3})/, 'Fri $1'],
    [/\u5468\u516d(\d{3})/, 'Sat $1'],
    [/\u5468\u65e5(\d{3})/, 'Sun $1'],
    /* 〇 / 1 / 2 ... 球 */
    [/^(\d+) \u7403$/, '$1 goals'],
    /* 让球 -1 */
    [/\u8ba9\u7403 ([+-]?\d+)$/, 'Handicap $1'],
    /* 每注（p × odds） */
    [/^(\d+) \u6ce8$/, '$1 bets'],
    /* 家 数 */
    [/^(\d+) \u5bb6$/, '$1 books']
  ]
});