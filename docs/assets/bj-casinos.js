/* ============================================================
   bj-casinos.js — 澳门娱乐场 21 点目录（21 家）
   数据口径：博监局 2026 年名单的 20 家 + 十六浦；
   各场 21 点台规与限额为公开资料整理的参考值（HKD），
   现场会随表台调整，仅用于模拟。
   会员卡体系按承批公司区分：金沙会 / 银河优越会 / 永利会 /
   美高梅会 / 新濠会 / 澳博会，升级门槛与积分率各不相同。
   ============================================================ */
window.BJ_CASINOS = {
  updated: '2026-11',
  programs: {
    sands: {
      name: '金沙会', rate: 0.0010,
      tiers: [['红卡', 0], ['金卡', 300], ['白金卡', 3000], ['钻石卡', 30000]],
      note: '流水 1 元 = 1 分 ×0.10%，积分按表台流水计'
    },
    galaxy: {
      name: '银河优越会', rate: 0.0012,
      tiers: [['红卡', 0], ['金卡', 500], ['白金卡', 5000], ['钻石卡', 50000]],
      note: '中场 0.12%，贵宾厅另有专属积分倍率'
    },
    wynn: {
      name: '永利会', rate: 0.0015,
      tiers: [['红卡', 0], ['金卡', 1000], ['白金卡', 10000], ['钻石卡', 100000]],
      note: '积分率最高，升卡门槛也最高'
    },
    mgm: {
      name: '美高梅会', rate: 0.0010,
      tiers: [['珍珠卡', 0], ['金卡', 400], ['白金卡', 4000], ['黑卡', 40000]],
      note: '珍珠→金→白金→黑，四档'
    },
    melco: {
      name: '新濠会', rate: 0.0010,
      tiers: [['红卡', 0], ['金卡', 300], ['白金卡', 3000], ['钻石卡', 30000]],
      note: '新濠天地/影汇/锋通用一套卡'
    },
    sjm: {
      name: '澳博会', rate: 0.0008,
      tiers: [['普通卡', 0], ['金卡', 200], ['白金卡', 2000], ['钻石卡', 20000]],
      note: '积分率最低，但升卡门槛也最低'
    }
  },
  casinos: [
    /* 金沙中国（5） */
    { id: 'venetian',  name: '威尼斯人',   op: '金沙中国', room: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 300,  max: 10000,  bj: 1.5, sur: true,  prog: 'sands',  note: '金光大道中场，洗牌机为主' },
    { id: 'parisian',  name: '巴黎人',     op: '金沙中国', room: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 300,  max: 5000,   bj: 1.5, sur: true,  prog: 'sands',  note: '低额台为主，游客多' },
    { id: 'londoner',  name: '伦敦人',     op: '金沙中国', room: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 500,  max: 10000,  bj: 1.5, sur: true,  prog: 'sands',  note: '与威尼斯人同一套台规' },
    { id: 'sands',     name: '金沙',       op: '金沙中国', room: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 300,  max: 5000,   bj: 1.5, sur: true,  prog: 'sands',  note: '澳门半岛老场，台数少' },
    { id: 'plaza',     name: '百利宫',     op: '金沙中国', room: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 1000, max: 50000,  bj: 1.5, sur: true,  prog: 'sands',  note: '四季名店旁高端厅' },

    /* 银河娱乐（3） */
    { id: 'galaxy',    name: '银河',       op: '银河娱乐', room: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 500,  max: 5000,   bj: 1.5, sur: true,  prog: 'galaxy', note: '6 副牌靴，分牌后不可再分 A' },
    { id: 'starworld', name: '星际',       op: '银河娱乐', room: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 500,  max: 10000,  bj: 1.5, sur: true,  prog: 'galaxy', note: '半岛场，高额台较多' },
    { id: 'broadway',  name: '百老汇',     op: '银河娱乐', room: '普通场', decks: 6, csm: false, s17: true, seats: 6, min: 300,  max: 3000,   bj: 1.5, sur: true,  prog: 'galaxy', note: '银河旁的平价场' },

    /* 永利（2） */
    { id: 'wynn',      name: '永利澳门',   op: '永利澳门', room: '中场',   decks: 6, csm: false, s17: true, seats: 6, min: 500,  max: 20000,  bj: 1.5, sur: true,  prog: 'wynn',   note: '6 副牌靴，位置少、单价高' },
    { id: 'wynn-palace', name: '永利皇宫', op: '永利澳门', room: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 1000, max: 100000, bj: 1.5, sur: true,  prog: 'wynn',   note: '路氹贵宾厅，8 副牌靴' },

    /* 美高梅（2） */
    { id: 'mgm',       name: '美高梅澳门', op: '美高梅',   room: '中场',   decks: 8, csm: true,  s17: true, seats: 6, min: 500,  max: 10000,  bj: 1.5, sur: true,  prog: 'mgm',    note: '半岛场，8 副洗牌机' },
    { id: 'mgm-cotai', name: '美高梅路氹', op: '美高梅',   room: '中场',   decks: 8, csm: true,  s17: true, seats: 6, min: 500,  max: 20000,  bj: 1.5, sur: true,  prog: 'mgm',    note: '路氹新场，台数多' },

    /* 新濠（3） */
    { id: 'cod',       name: '新濠天地',   op: '新濠博亚', room: '中场',   decks: 8, csm: false, s17: true, seats: 6, min: 500,  max: 20000,  bj: 1.5, sur: true,  prog: 'melco',  note: '8 副牌靴，摩珀斯厅限额更高' },
    { id: 'studio',    name: '新濠影汇',   op: '新濠博亚', room: '普通场', decks: 6, csm: true,  s17: true, seats: 6, min: 300,  max: 10000,  bj: 1.5, sur: true,  prog: 'melco',  note: '家庭客多，低额台密集' },
    { id: 'altira',    name: '新濠锋',     op: '新濠博亚', room: '贵宾厅', decks: 8, csm: false, s17: true, seats: 7, min: 1000, max: 50000,  bj: 1.5, sur: true,  prog: 'melco',  note: '半岛精品贵宾厅' },

    /* 澳娱综合（5） */
    { id: 'grand-lisboa', name: '新葡京',  op: '澳娱综合', room: '普通场', decks: 6, csm: false, s17: true, seats: 6, min: 100,  max: 3000,   bj: 1.2, sur: false, prog: 'sjm',    note: '低额台，部分台 BJ 只赔 6:5' },
    { id: 'lisboa-palace', name: '上葡京', op: '澳娱综合', room: '中场',   decks: 8, csm: false, s17: true, seats: 6, min: 500,  max: 20000,  bj: 1.5, sur: true,  prog: 'sjm',    note: '路氹新场，8 副牌靴' },
    { id: 'lisboa',    name: '葡京',       op: '澳娱综合', room: '普通场', decks: 6, csm: false, s17: true, seats: 6, min: 100,  max: 2000,   bj: 1.2, sur: false, prog: 'sjm',    note: '老葡京，最低注门槛最低' },
    { id: 'larc',      name: '凯旋门',     op: '澳娱综合', room: '普通场', decks: 6, csm: false, s17: true, seats: 6, min: 200,  max: 3000,   bj: 1.2, sur: false, prog: 'sjm',    note: '半岛卫星场，台规偏保守' },
    { id: 'oceanus',   name: '回力海立方', op: '澳娱综合', room: '中场',   decks: 6, csm: true,  s17: true, seats: 6, min: 300,  max: 5000,   bj: 1.5, sur: true,  prog: 'sjm',    note: '码头旁，洗牌机为主' },

    /* 卫星场（1，凑足 21 家） */
    { id: 'ponte16',   name: '十六浦',     op: '卫星场',   room: '普通场', decks: 6, csm: false, s17: true, seats: 6, min: 200,  max: 3000,   bj: 1.2, sur: false, prog: 'sjm',    note: '内港卫星场，2025 过渡期后并入承批公司' }
  ]
};