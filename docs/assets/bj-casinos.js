/* ============================================================
   bj-casinos.js — 澳门娱乐场 21 点目录（21 家 / 45 张台）
   · 每家场分「普通场 / 中场 / 贵宾厅 / 私人厅」，限额与牌副各自独立
   · 6 套会员卡体系，等级名取自官方公开卡系：
       金沙会 / 银河优越会(金·白金·黑·钻石) / 永利会(红·白金·黑·主席卡)
       金狮会(蓝宝石·珍珠·白金·黑狮·狮王) / 新濠会 / 澳博至尊卡(翡翠·黄金·白金·钻石)
     邀请制最高档单独列出；积分为模拟口径（HKD），现场表台随时调整。
   ============================================================ */
window.BJ_CASINOS = {
  updated: '2026-11',
  currency: 'MOP（与 HKD 近似 1:1，仅作模拟）',
  programs: {
    sands: {
      name: '金沙会', brand: 'Sands Rewards',
      mopPerPoint: 5000, conversion: '圈内估算 4,000–6,000 MOP 有效投注 = 1 分，取中值 5,000',
      tiers: [['金卡', 0], ['红宝石', 888], ['钻石', 8888]],
      tiersNote: '红宝石内部细分为 Ruby I / II / III，仅展示标签，不设独立门槛；6 个月累计积分',
      tiersKnown: true,
      vip: {
        name: 'Paiza', note: '中场积分与 Paiza 贵宾厅是两套体系',
        tiers: [
          { name: 'Paiza Platinum', turnover: 12000000, maxBet: 20000, days: 12 },
          { name: 'Paiza Diamond', turnover: 30000000, maxBet: 50000, days: 20 },
          { name: 'Paiza Chairman（御匾主席）', turnover: 80000000, maxBet: 150000, days: 30, top: true }
        ]
      }
    },
    galaxy: {
      name: '银娱优越会', brand: 'GEG Privilege Club',
      mopPerPoint: 6000, conversion: '圈内估算 5,000–7,000 MOP = 1 分，取中值 6,000',
      tiers: [['皇', 0], ['爵', null], ['赫', null], ['尊', null]],
      tiersNote: '档位名称官方公布，升级积分官方未公开',
      tiersKnown: false,
      vip: {
        name: '金尊', note: '贵宾厅独立于中场优越会',
        tiers: [
          { name: '金尊（基础贵宾）', turnover: 10000000, maxBet: 15000, days: 10 },
          { name: '金尊御尊（顶层）', turnover: 70000000, maxBet: 120000, days: 28, top: true }
        ]
      }
    },
    melco: {
      name: '摩卡会', brand: 'Mocha Club',
      mopPerPoint: 0, conversion: '21 点不计摩卡积分：摩卡会仅角子机计分',
      no21Points: true,
      tiers: [['礼悦', 0], ['贵宾', 688], ['尊尚', 6888], ['钻誉（邀请）', null]],
      tiersNote: '角子机积分档位；21 点不产生摩卡积分',
      tiersKnown: false,
      vip: {
        name: '铂悦', note: '21 点贵宾归属铂悦体系，与摩卡积分相互独立',
        tiers: [
          { name: '铂悦（基础贵宾）', turnover: 10000000, maxBet: 15000, days: 10 },
          { name: '铂悦臻尊（顶层）', turnover: 65000000, maxBet: 100000, days: 25, top: true }
        ]
      }
    },
    mgm: {
      name: '金狮会', brand: 'Golden Lion Club',
      mopPerPoint: 25, conversion: '官方基准 20 MOP = 1 分，21 点桌面衰减后固定按 25 MOP = 1 分',
      tiers: [['蓝宝石', 0], ['珍珠', 400], ['铂金', 5900], ['黑玺', 15000]],
      tiersNote: '6 个月累计积分（官方基准）',
      tiersKnown: true,
      vip: {
        name: 'Privé / 狮王卡', note: '贵宾厅邀约制，狮王卡为隐藏顶层',
        tiers: [
          { name: 'Privé（常规贵宾）', turnover: 9000000, maxBet: 12000, days: 10 },
          { name: '狮王卡（隐藏顶层）', turnover: 60000000, maxBet: 100000, days: 25, top: true }
        ]
      }
    },
    wynn: {
      name: '红卡', brand: 'Red Card',
      mopPerPoint: 6500, conversion: '圈内估算 5,000–8,000 MOP = 1 分，取中值 6,500',
      tiers: [['红卡', 0]],
      tiersNote: '中场有分级，但档位名称与升级积分官方完全不公开',
      tiersKnown: false,
      vip: {
        name: '永利会贵宾',
        tiers: [
          { name: '永利基础贵宾', turnover: 13000000, maxBet: 20000, days: 12 },
          { name: '主席卡（隐藏顶层）', turnover: 90000000, maxBet: 180000, days: 30, top: true }
        ]
      }
    },
    sjm: {
      name: '葡京中场积分卡', brand: 'SJM',
      mopPerPoint: 5000, conversion: '圈内估算 5,000 MOP = 1 分（可信度低）',
      tiers: [['红卡', 0], ['银卡', null], ['金卡', null], ['黑钻', null]],
      tiersNote: '档位全部为坊间流传，无官方佐证，可信度低',
      tiersKnown: false,
      vip: {
        name: '至尊贵宾',
        tiers: [
          { name: '至尊贵宾（基础）', turnover: 8000000, maxBet: 10000, days: 8 },
          { name: '至尊御尊（顶层）', turnover: 55000000, maxBet: 90000, days: 22, top: true }
        ]
      }
    }
  },
  casinos: [
    /* ---------- 金沙中国 ---------- */
    { id: 'venetian', name: '威尼斯人', op: '金沙中国', bj: 1.5, sur: true, prog: 'sands', rooms: [
      { name: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 300,  max: 5000,  note: '金光大道中场，洗牌机为主' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 1000, max: 50000, note: '八副牌靴，可投降' }
    ] },
    { id: 'parisian', name: '巴黎人', op: '金沙中国', bj: 1.5, sur: true, prog: 'sands', rooms: [
      { name: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 300,  max: 5000,  note: '低额台为主，游客多' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 1000, max: 30000, note: '与威尼斯人同套台规' }
    ] },
    { id: 'londoner', name: '伦敦人', op: '金沙中国', bj: 1.5, sur: true, prog: 'sands', rooms: [
      { name: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 500,  max: 10000, note: '新场，台数多' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 2000, max: 50000, note: '高额区可预约' }
    ] },
    { id: 'sands', name: '金沙', op: '金沙中国', bj: 1.5, sur: true, prog: 'sands', rooms: [
      { name: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 300,  max: 3000,  note: '半岛老场，台数少' },
      { name: '高额区', decks: 8, csm: false, s17: true, seats: 6, min: 1000, max: 20000, note: '隔出的高额区' }
    ] },
    { id: 'plaza', name: '百利宫', op: '金沙中国', bj: 1.5, sur: true, prog: 'sands', rooms: [
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 2000,  max: 100000, note: '四季名店旁高端厅' },
      { name: '私人厅', decks: 8, csm: false, s17: true, seats: 5, min: 10000, max: 500000, note: '独立包厅' }
    ] },

    /* ---------- 银河娱乐 ---------- */
    { id: 'galaxy', name: '银河', op: '银河娱乐', bj: 1.5, sur: true, prog: 'galaxy', rooms: [
      { name: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 500,  max: 5000,   note: '6 副牌靴，分牌后不可再分 A' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 2000, max: 100000, note: '8 副牌靴，限额高' }
    ] },
    { id: 'starworld', name: '星际', op: '银河娱乐', bj: 1.5, sur: true, prog: 'galaxy', rooms: [
      { name: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 500,  max: 10000, note: '半岛场，高额台较多' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 2000, max: 50000, note: '楼层贵宾厅' }
    ] },
    { id: 'broadway', name: '百老汇', op: '银河娱乐', bj: 1.5, sur: true, prog: 'galaxy', rooms: [
      { name: '普通场', decks: 6, csm: false, s17: true, seats: 6, min: 300, max: 3000, note: '银河旁的平价场' },
      { name: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 500, max: 5000, note: '与银河同一卡系' }
    ] },

    /* ---------- 永利 ---------- */
    { id: 'wynn', name: '永利澳门', op: '永利澳门', bj: 1.5, sur: true, prog: 'wynn', rooms: [
      { name: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 500,  max: 20000,  note: '6 副牌靴，位置少' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 2000, max: 100000, note: '白金/黑卡主要在这里打' }
    ] },
    { id: 'wynn-palace', name: '永利皇宫', op: '永利澳门', bj: 1.5, sur: true, prog: 'wynn', rooms: [
      { name: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 1000, max: 20000,   note: '路氹中场' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 5000, max: 500000,  note: '主席卡邀约厅' },
      { name: '主席厅', decks: 8, csm: false, s17: true, seats: 5, min: 20000, max: 1000000, note: 'Chairman’s Club 包厅' }
    ] },

    /* ---------- 美高梅 ---------- */
    { id: 'mgm', name: '美高梅澳门', op: '美高梅', bj: 1.5, sur: true, prog: 'mgm', rooms: [
      { name: '中场',   decks: 8, csm: true,  s17: true, seats: 6, min: 500, max: 10000, note: '半岛场，8 副洗牌机' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 2000, max: 50000, note: '珍珠卡以上可进' }
    ] },
    { id: 'mgm-cotai', name: '美高梅路氹', op: '美高梅', bj: 1.5, sur: true, prog: 'mgm', rooms: [
      { name: '中场',   decks: 8, csm: true,  s17: true, seats: 6, min: 500, max: 20000,  note: '路氹新场，台数多' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 2000, max: 100000, note: '高层贵宾厅' }
    ] },

    /* ---------- 新濠 ---------- */
    { id: 'cod', name: '新濠天地', op: '新濠博亚', bj: 1.5, sur: true, prog: 'melco', rooms: [
      { name: '中场',   decks: 8, csm: false, s17: true, seats: 6, min: 500, max: 20000,  note: '8 副牌靴，台数密集' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 2000, max: 100000, note: '摩珀斯厅限额更高' }
    ] },
    { id: 'studio', name: '新濠影汇', op: '新濠博亚', bj: 1.5, sur: true, prog: 'melco', rooms: [
      { name: '普通场', decks: 6, csm: true,  s17: true, seats: 6, min: 300, max: 5000,  note: '家庭客多，低额台密集' },
      { name: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 500, max: 10000, note: '洗牌机为主' }
    ] },
    { id: 'altira', name: '新濠锋', op: '新濠博亚', bj: 1.5, sur: true, prog: 'melco', rooms: [
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 2000,  max: 100000, note: '半岛精品贵宾厅' },
      { name: '私人厅', decks: 8, csm: false, s17: true, seats: 5, min: 10000, max: 500000, note: '独立包厅' }
    ] },

    /* ---------- 澳娱综合 ---------- */
    { id: 'grand-lisboa', name: '新葡京', op: '澳娱综合', bj: 1.2, sur: false, prog: 'sjm', rooms: [
      { name: '普通场', decks: 6, csm: false, s17: true, seats: 6, min: 100, max: 2000,  note: '低额台，部分台 BJ 只赔 6:5' },
      { name: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 300, max: 5000,  note: '主楼层中场' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 1000, max: 50000, note: '高层贵宾厅' }
    ] },
    { id: 'lisboa-palace', name: '上葡京', op: '澳娱综合', bj: 1.5, sur: true, prog: 'sjm', rooms: [
      { name: '中场',   decks: 8, csm: false, s17: true, seats: 6, min: 500,  max: 20000,  note: '路氹新场，8 副牌靴' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 2000, max: 100000, note: '至尊卡高额厅' }
    ] },
    { id: 'lisboa', name: '葡京', op: '澳娱综合', bj: 1.2, sur: false, prog: 'sjm', rooms: [
      { name: '普通场', decks: 6, csm: false, s17: true, seats: 6, min: 100, max: 2000, note: '老葡京，最低注门槛最低' },
      { name: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 200, max: 3000, note: '与普通场相邻' }
    ] },
    { id: 'larc', name: '凯旋门', op: '澳娱综合', bj: 1.2, sur: false, prog: 'sjm', rooms: [
      { name: '普通场', decks: 6, csm: false, s17: true, seats: 6, min: 200, max: 3000, note: '半岛卫星场，台规偏保守' },
      { name: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 300, max: 5000, note: '小规模中场' }
    ] },
    { id: 'oceanus', name: '回力海立方', op: '澳娱综合', bj: 1.5, sur: true, prog: 'sjm', rooms: [
      { name: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 300, max: 5000,  note: '码头旁，洗牌机为主' },
      { name: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 1000, max: 30000, note: '海景贵宾厅' }
    ] },

    /* ---------- 卫星场 ---------- */
    { id: 'ponte16', name: '十六浦', op: '卫星场', bj: 1.2, sur: false, prog: 'sjm', rooms: [
      { name: '普通场', decks: 6, csm: false, s17: true, seats: 6, min: 200, max: 3000, note: '内港卫星场，过渡期后并入承批公司' }
    ] }
  ]
};