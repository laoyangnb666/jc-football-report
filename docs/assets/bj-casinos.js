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
  programs: {
    sands: {
      name: '金沙会', brand: 'Sands Rewards Club', rate: 0.0010,
      tiers: [['红宝卡', 0], ['金宝卡', 300], ['白金卡', 3000], ['钻宝卡', 30000], ['尊享卡（邀请）', 150000]],
      basis: '按表台流水计分，1 元流水 = 1 分 ×0.10%'
    },
    galaxy: {
      name: '银河优越会', brand: 'GEG Privilege Club', rate: 0.0012,
      tiers: [['金卡', 0], ['白金卡', 500], ['黑卡', 5000], ['钻石卡', 50000], ['尊尚钻石（邀请）', 200000]],
      basis: '官方四档：金 / 白金 / 黑 / 钻石；最高档只邀不申'
    },
    wynn: {
      name: '永利会', brand: 'Wynn Rewards', rate: 0.0015,
      tiers: [['红卡', 0], ['白金卡', 1000], ['黑卡', 10000], ['主席卡（邀请）', 100000]],
      basis: '红卡为公开卡；白金/黑卡按季评；主席卡 Chairman’s Club 只邀不申'
    },
    mgm: {
      name: '金狮会', brand: 'Golden Lion Club', rate: 0.0010,
      tiers: [['蓝宝石卡', 0], ['珍珠卡', 400], ['白金卡', 4000], ['黑狮卡（Noir）', 40000], ['狮王卡（邀请）', 200000]],
      basis: '官方：Sapphire 免费、Pearl 半年 400 分、Platinum、Noir；狮王为邀请制'
    },
    melco: {
      name: '新濠会', brand: 'Melco Club', rate: 0.0010,
      tiers: [['红卡', 0], ['金卡', 300], ['白金卡', 3000], ['钻石卡', 30000], ['黑卡（邀请）', 150000]],
      basis: '新濠天地 / 影汇 / 锋共用一套卡，跨场累计'
    },
    sjm: {
      name: '澳博至尊卡', brand: 'SJM Supreme Card', rate: 0.0008,
      tiers: [['翡翠卡', 0], ['黄金卡', 200], ['白金卡', 2000], ['钻石卡', 20000], ['尊贵卡（邀请）', 100000]],
      basis: '官方按累计净消费：翡翠<5万、黄金5–15万、白金15–30万、钻石≥30万（MOP）'
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