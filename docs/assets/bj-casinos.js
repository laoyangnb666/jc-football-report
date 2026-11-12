/* ============================================================
   bj-casinos.js — 澳门娱乐场 21 点目录（21 家 · 全档厅房）
   ------------------------------------------------------------
   v2 结构：
   · 厅房统一 7 档，按 rank 排序，need 表示所需会员卡等级：
       0 普通场      need 0（自由入场）
       1 中场        need 0
       2 高额区      need 0
       3 贵宾厅      need 1（基础贵宾卡）
       4 私人厅      need 2（顶层贵宾卡）
       5 主席厅      need 3（主席卡）
       6 超级贵宾厅  need 4（御匾 / 超级卡）
   · 每张台自带完整规则：牌副、洗牌机、软17、BJ 赔付、早投降、DAS、
     分 A 再分/补牌、最大分门、五张牌、保险、等额、销牌、穿透率、发牌顺序
   · 会员体系：6 套中场卡（线性 6–7 档）+ 4 档贵宾卡（基础/私人/主席/超级）
   · 所有数值为模拟口径，现场表台会调整。
   ============================================================ */
(function () {
  const ROOM_META = {
    general:  { name: '普通场',     rank: 0, need: 0 },
    main:     { name: '中场',       rank: 1, need: 0 },
    high:     { name: '高额区',     rank: 2, need: 0 },
    vip:      { name: '贵宾厅',     rank: 3, need: 1 },
    private:  { name: '私人厅',     rank: 4, need: 2 },
    chairman: { name: '主席厅',     rank: 5, need: 3 },
    supervip: { name: '超级贵宾厅', rank: 6, need: 4 }
  };

  /* 每一档厅的基础台规（可被场馆与单厅覆盖） */
  const ROOM_BASE = {
    general: {
      seats: 6, decks: 6, csm: false, s17: true, bj: 1.5, sur: false, das: true,
      resplitA: false, hitSplitA: false, maxSplit: 4, fiveCard: false,
      ins: true, even: false, burn: 1, pen: 0.72, dealStyle: 'two-pass',
      minScale: 1, maxScale: 1
    },
    main: {
      seats: 6, decks: 6, csm: true, s17: true, bj: 1.5, sur: false, das: true,
      resplitA: false, hitSplitA: false, maxSplit: 4, fiveCard: false,
      ins: true, even: false, burn: 1, pen: 0.75, dealStyle: 'two-pass',
      minScale: 3, maxScale: 4
    },
    high: {
      seats: 6, decks: 8, csm: false, s17: true, bj: 1.5, sur: true, das: true,
      resplitA: false, hitSplitA: false, maxSplit: 4, fiveCard: false,
      ins: true, even: true, burn: 1, pen: 0.78, dealStyle: 'two-pass',
      minScale: 10, maxScale: 20
    },
    vip: {
      seats: 7, decks: 8, csm: false, s17: true, bj: 1.5, sur: true, das: true,
      resplitA: true, hitSplitA: false, maxSplit: 4, fiveCard: true,
      ins: true, even: true, burn: 1, pen: 0.80, dealStyle: 'two-pass',
      minScale: 20, maxScale: 40
    },
    private: {
      seats: 5, decks: 8, csm: false, s17: true, bj: 1.5, sur: true, das: true,
      resplitA: true, hitSplitA: false, maxSplit: 4, fiveCard: true,
      ins: true, even: true, burn: 1, pen: 0.82, dealStyle: 'per-box',
      minScale: 100, maxScale: 200
    },
    chairman: {
      seats: 5, decks: 8, csm: false, s17: true, bj: 1.5, sur: true, das: true,
      resplitA: true, hitSplitA: true, maxSplit: 4, fiveCard: true,
      ins: true, even: true, burn: 1, pen: 0.85, dealStyle: 'per-box',
      minScale: 200, maxScale: 400
    },
    supervip: {
      seats: 4, decks: 8, csm: false, s17: true, bj: 1.5, sur: true, das: true,
      resplitA: true, hitSplitA: true, maxSplit: 4, fiveCard: true,
      ins: true, even: true, burn: 1, pen: 0.88, dealStyle: 'per-box',
      minScale: 500, maxScale: 800
    }
  };

  /* 场馆组：决定底线注码与台规倾向 */
  const GROUPS = {
    sands:   { min: 300, note: '中场以洗牌机为主，贵宾厅改 8 副牌靴' },
    galaxy:  { min: 500, note: '6/8 副牌靴，分 A 后不可再分' },
    wynn:    { min: 500, note: '牌靴为主，贵宾厅开五张牌与早投降' },
    mgm:     { min: 500, note: '中场 8 副洗牌机，高额区 8 副牌靴' },
    melco:   { min: 500, note: '8 副牌靴，分 A 后可再分' },
    sjm:     { min: 100, note: '低额台 BJ 只赔 6:5，庄家软 17 要牌' },
    sat:     { min: 200, note: '卫星场台规偏保守，每局销两张' }
  };

  /* 场馆级台规覆盖（体现不同娱乐场的发牌习惯） */
  const OVERRIDES = {
    venetian:      { main: { csm: true }, vip: { sur: true } },
    parisian:      { main: { csm: true } },
    londoner:      { main: { csm: true }, high: { csm: false } },
    sands:         { main: { csm: true }, high: { sur: false } },
    plaza:         { vip: { sur: true, fiveCard: true }, supervip: { bj: 1.5 } },
    galaxy:        { main: { resplitA: false }, vip: { resplitA: false, sur: true } },
    starworld:     { main: { resplitA: false }, high: { sur: true } },
    broadway:      { general: { csm: false }, main: { resplitA: false } },
    wynn:          { high: { sur: true }, vip: { fiveCard: true, sur: true } },
    'wynn-palace': { vip: { fiveCard: true }, chairman: { hitSplitA: true } },
    mgm:           { main: { decks: 8, csm: true } },
    'mgm-cotai':   { main: { decks: 8, csm: true }, vip: { resplitA: true } },
    cod:           { main: { decks: 8 }, vip: { resplitA: true } },
    studio:        { general: { csm: true }, main: { csm: true, decks: 6 } },
    altira:        { vip: { resplitA: true, fiveCard: true } },
    'grand-lisboa':{ general: { bj: 1.2, s17: false, sur: false, pen: 0.70 }, main: { bj: 1.2, s17: false } },
    'lisboa-palace': { main: { decks: 8 }, vip: { sur: true } },
    lisboa:        { general: { bj: 1.2, s17: false, pen: 0.70 }, main: { bj: 1.2, s17: false } },
    larc:          { general: { bj: 1.2, s17: false, pen: 0.68 }, main: { bj: 1.2, s17: false } },
    oceanus:       { main: { csm: true } },
    ponte16:       { general: { bj: 1.2, s17: false, burn: 2, pen: 0.68, dealStyle: 'per-box' } }
  };

  function mkRoom(casino, group, lvlKey, extra) {
    const meta = ROOM_META[lvlKey];
    const base = ROOM_BASE[lvlKey];
    const g = GROUPS[group];
    const min = Math.round(g.min * base.minScale);
    const max = Math.round(g.min * base.maxScale * 10) ;
    return Object.assign({
      name: meta.name, rank: meta.rank, need: meta.need,
      seats: base.seats, decks: base.decks, csm: base.csm,
      s17: base.s17, bj: base.bj, sur: base.sur, das: base.das,
      resplitA: base.resplitA, hitSplitA: base.hitSplitA, maxSplit: base.maxSplit,
      fiveCard: base.fiveCard, ins: base.ins, even: base.even,
      burn: base.burn, pen: base.pen, dealStyle: base.dealStyle,
      min, max,
      note: (extra && extra.note) || ''
    }, (OVERRIDES[casino] && OVERRIDES[casino][lvlKey]) || {}, extra || {});
  }

  function rooms(casino, group, list, notes) {
    return list.map(k => mkRoom(casino, group, k, { note: (notes && notes[k]) || '' }));
  }

  /* ---------------- 会员体系（档位取自各场官方会籍页） ---------------- */
  const programs = {
    sands: {
      name: '金沙会', brand: 'Sands Rewards', mopPerPoint: 5000,
      conversion: '官方档位：金卡 → 红宝卡 Ⅰ/Ⅱ/Ⅲ → 钻石卡 Ⅰ/Ⅱ/Ⅲ → 御匾白金/钻石/主席卡；积分约 5,000 MOP = 1 分',
      tiers: [
        ['金卡', 0],
        ['红宝卡Ⅰ', 888], ['红宝卡Ⅱ', 2888], ['红宝卡Ⅲ', 6888],
        ['钻石卡Ⅰ', 8888], ['钻石卡Ⅱ', 18888], ['钻石卡Ⅲ', 38888],
        ['御匾白金卡', 88888], ['御匾钻石卡', 188888], ['御匾主席卡', 388888]
      ],
      tiersNote: '档位名称取自金沙会官方权益页；除公开档位序列外，升级积分为线性模拟值',
      tiersKnown: true,
      vip: {
        name: 'Paiza',
        note: '中场积分与 Paiza 贵宾厅是两套体系',
        tiers: [
          { name: 'Paiza Platinum（基础贵宾）', card: 1, turnover: 12000000, maxBet: 20000, days: 12 },
          { name: 'Paiza Private（私人厅）', card: 2, turnover: 30000000, maxBet: 50000, days: 18 },
          { name: 'Paiza Chairman（主席厅）', card: 3, turnover: 70000000, maxBet: 120000, days: 26 },
          { name: 'Paiza Sovereign（御匾 · 超级贵宾）', card: 4, turnover: 160000000, maxBet: 300000, days: 34, top: true }
        ]
      }
    },
    galaxy: {
      name: '银河优越', brand: 'GEG Privilege Club', mopPerPoint: 6000,
      conversion: '官方：皇卡累积满 10 分晋升爵卡；赫/尊/御尊/至尊门槛未公开，按线性模拟（约 6,000 MOP = 1 分）',
      tiers: [['皇', 0], ['爵', 10], ['赫', 600], ['尊', 2400], ['御尊', 9600], ['至尊', 38400]],
      tiersNote: '官方仅公布皇→爵为 10 分；赫/尊/御尊/至尊为线性模拟值',
      tiersKnown: true,
      vip: {
        name: '金尊',
        note: '贵宾厅独立于中场优越会',
        tiers: [
          { name: '金尊（基础贵宾）', card: 1, turnover: 10000000, maxBet: 15000, days: 10 },
          { name: '金尊私人（私人厅）', card: 2, turnover: 26000000, maxBet: 45000, days: 18 },
          { name: '金尊主席（主席厅）', card: 3, turnover: 62000000, maxBet: 110000, days: 26 },
          { name: '金尊至尊（超级贵宾）', card: 4, turnover: 150000000, maxBet: 280000, days: 34, top: true }
        ]
      }
    },
    melco: {
      name: '新濠皇会', brand: 'Melco Club', mopPerPoint: 400,
      conversion: '官方：白金 +80 分、钻石 +2,800 分、红玺 +18,000 分；21 点约 400 MOP = 1 分',
      tiers: [['黄金卡', 0], ['白金卡', 80], ['钻石卡', 2880], ['红玺卡', 20880], ['龙玺卡', 80000], ['天皇卡', 200000]],
      tiersNote: '黄金卡免费登记；白金/钻石/红玺为官方门槛；龙玺、天皇为邀请制，此处按线性积分模拟',
      tiersKnown: true,
      vip: {
        name: '皇玺会',
        note: '21 点贵宾归属皇玺会，与新濠皇会中场积分相互独立',
        tiers: [
          { name: '皇玺会（基础贵宾）', card: 1, turnover: 10000000, maxBet: 15000, days: 10 },
          { name: '皇玺会私享（私人厅）', card: 2, turnover: 28000000, maxBet: 48000, days: 18 },
          { name: '皇玺会主席（主席厅）', card: 3, turnover: 65000000, maxBet: 115000, days: 26 },
          { name: '皇玺会臻尊（超级贵宾）', card: 4, turnover: 155000000, maxBet: 290000, days: 34, top: true }
        ]
      }
    },
    mgm: {
      name: '金狮会', brand: 'Golden Lion Club', mopPerPoint: 25,
      conversion: '官方基准 20 MOP = 1 分，21 点桌面衰减后按 25 MOP = 1 分',
      tiers: [['蓝宝石', 0], ['珍珠', 400], ['铂金', 5900], ['黑玺', 15000], ['钻石', 45000], ['黑钻', 120000]],
      tiersNote: '6 个月累计积分（官方基准）',
      tiersKnown: true,
      vip: {
        name: 'Privé / 狮王卡',
        note: '贵宾厅邀约制，狮王卡为顶层',
        tiers: [
          { name: 'Privé（基础贵宾）', card: 1, turnover: 9000000, maxBet: 12000, days: 10 },
          { name: 'Privé 私人（私人厅）', card: 2, turnover: 24000000, maxBet: 42000, days: 18 },
          { name: 'Privé 主席（主席厅）', card: 3, turnover: 58000000, maxBet: 105000, days: 26 },
          { name: '狮王卡（超级贵宾）', card: 4, turnover: 145000000, maxBet: 270000, days: 34, top: true }
        ]
      }
    },
    wynn: {
      name: '红卡', brand: 'Red Card', mopPerPoint: 6500,
      conversion: '圈内估算 5,000–8,000 MOP = 1 分，取中值 6,500',
      tiers: [['红卡', 0], ['银卡', 3000], ['金卡', 12000], ['白金', 36000], ['黑卡', 108000], ['主席', 300000]],
      tiersNote: '档位名称为模拟序列，升级积分按线性递增',
      tiersKnown: true,
      vip: {
        name: '永利会贵宾',
        note: '主席卡为顶层邀约卡',
        tiers: [
          { name: '永利基础贵宾', card: 1, turnover: 13000000, maxBet: 20000, days: 12 },
          { name: '永利私人厅', card: 2, turnover: 32000000, maxBet: 55000, days: 18 },
          { name: '永利主席厅', card: 3, turnover: 78000000, maxBet: 130000, days: 26 },
          { name: '主席卡（超级贵宾）', card: 4, turnover: 180000000, maxBet: 320000, days: 34, top: true }
        ]
      }
    },
    sjm: {
      name: '澳娱综合至尊卡', brand: 'SJM Supreme Card', mopPerPoint: 1000,
      conversion: '官方按过去 12 个月累计净消费计级：翡翠免费 / 黄金 5 万 / 白金 15 万 / 钻石 30 万 MOP；此处 1 分 = 1,000 MOP',
      tiers: [['翡翠', 0], ['黄金', 50], ['白金', 150], ['钻石', 300]],
      tiersNote: '门槛为官方累计净消费额（MOP 50,000 / 150,000 / 300,000）折算',
      tiersKnown: true,
      vip: {
        name: '至尊贵宾',
        tiers: [
          { name: '至尊贵宾（基础）', card: 1, turnover: 8000000, maxBet: 10000, days: 8 },
          { name: '至尊私人（私人厅）', card: 2, turnover: 22000000, maxBet: 40000, days: 16 },
          { name: '至尊主席（主席厅）', card: 3, turnover: 55000000, maxBet: 100000, days: 24 },
          { name: '至尊御尊（超级贵宾）', card: 4, turnover: 140000000, maxBet: 260000, days: 32, top: true }
        ]
      }
    }
  };

  /* ---------------- 场馆目录 ---------------- */
  const casinos = [
    /* 金沙中国 */
    { id: 'venetian', name: '威尼斯人', op: '金沙中国', prog: 'sands', rooms: rooms('venetian', 'sands',
      ['general', 'main', 'high', 'vip', 'private'],
      { general: '金光大道低额台，6 副牌靴', main: '洗牌机为主，游客多', high: '隔出的高额区，8 副牌靴', vip: '八副牌靴，可早投降', private: '独立包厅，发牌逐门进行' }) },
    { id: 'parisian', name: '巴黎人', op: '金沙中国', prog: 'sands', rooms: rooms('parisian', 'sands',
      ['general', 'main', 'high', 'vip'],
      { general: '低额台密集', main: '与威尼斯人同套台规', high: '高额区可预约', vip: '八副牌靴' }) },
    { id: 'londoner', name: '伦敦人', op: '金沙中国', prog: 'sands', rooms: rooms('londoner', 'sands',
      ['main', 'high', 'vip', 'private'],
      { main: '新场，台数多', high: '高额区', vip: '高额区可预约', private: '独立包厅' }) },
    { id: 'sands', name: '金沙', op: '金沙中国', prog: 'sands', rooms: rooms('sands', 'sands',
      ['general', 'main', 'high'],
      { general: '半岛老场，台数少', main: '洗牌机为主', high: '隔出的高额区' }) },
    { id: 'plaza', name: '百利宫', op: '金沙中国', prog: 'sands', rooms: rooms('plaza', 'sands',
      ['high', 'vip', 'private', 'chairman', 'supervip'],
      { high: '四季名店旁高端区', vip: 'Paiza 贵宾厅', private: '独立包厅', chairman: 'Paiza Chairman 包厅', supervip: '御匾厅，4 门' }) },

    /* 银河娱乐 */
    { id: 'galaxy', name: '银河', op: '银河娱乐', prog: 'galaxy', rooms: rooms('galaxy', 'galaxy',
      ['main', 'high', 'vip', 'private', 'chairman'],
      { main: '6 副牌靴，分 A 不可再分', high: '8 副牌靴', vip: '8 副牌靴，限额高', private: '独立包厅', chairman: '主席厅，分 A 可再分' }) },
    { id: 'starworld', name: '星际', op: '银河娱乐', prog: 'galaxy', rooms: rooms('starworld', 'galaxy',
      ['main', 'high', 'vip'],
      { main: '半岛场，高额台较多', high: '高额区', vip: '楼层贵宾厅' }) },
    { id: 'broadway', name: '百老汇', op: '银河娱乐', prog: 'galaxy', rooms: rooms('broadway', 'galaxy',
      ['general', 'main', 'high'],
      { general: '平价场，6 副牌靴', main: '与银河同一卡系', high: '高额区' }) },

    /* 永利 */
    { id: 'wynn', name: '永利澳门', op: '永利澳门', prog: 'wynn', rooms: rooms('wynn', 'wynn',
      ['main', 'high', 'vip', 'private', 'chairman'],
      { main: '6 副牌靴，位置少', high: '8 副牌靴，可投降', vip: '白金/黑卡主要在这里打', private: '独立包厅', chairman: '主席厅' }) },
    { id: 'wynn-palace', name: '永利皇宫', op: '永利澳门', prog: 'wynn', rooms: rooms('wynn-palace', 'wynn',
      ['main', 'high', 'vip', 'private', 'chairman', 'supervip'],
      { main: '路氹中场', high: '高额区', vip: '主席卡邀约厅', private: '私人包厅', chairman: 'Chairman’s Club 包厅', supervip: '超级贵宾厅，4 门' }) },

    /* 美高梅 */
    { id: 'mgm', name: '美高梅澳门', op: '美高梅', prog: 'mgm', rooms: rooms('mgm', 'mgm',
      ['main', 'high', 'vip'],
      { main: '8 副洗牌机', high: '8 副牌靴', vip: '珍珠卡以上可进' }) },
    { id: 'mgm-cotai', name: '美高梅路氹', op: '美高梅', prog: 'mgm', rooms: rooms('mgm-cotai', 'mgm',
      ['main', 'high', 'vip', 'private', 'chairman', 'supervip'],
      { main: '路氹新场，8 副洗牌机', high: '高额区', vip: '高层贵宾厅', private: '私人包厅', chairman: '狮王卡主席厅', supervip: '超级贵宾厅，4 门' }) },

    /* 新濠 */
    { id: 'cod', name: '新濠天地', op: '新濠博亚', prog: 'melco', rooms: rooms('cod', 'melco',
      ['main', 'high', 'vip', 'private', 'chairman'],
      { main: '8 副牌靴，台数密集', high: '高额区', vip: '摩珀斯厅限额更高', private: '摩珀斯私人厅', chairman: '主席厅' }) },
    { id: 'studio', name: '新濠影汇', op: '新濠博亚', prog: 'melco', rooms: rooms('studio', 'melco',
      ['general', 'main', 'high'],
      { general: '家庭客多，洗牌机', main: '洗牌机为主', high: '高额区' }) },
    { id: 'altira', name: '新濠锋', op: '新濠博亚', prog: 'melco', rooms: rooms('altira', 'melco',
      ['high', 'vip', 'private', 'chairman', 'supervip'],
      { high: '半岛高额区', vip: '半岛精品贵宾厅', private: '独立包厅', chairman: '主席厅', supervip: '超级贵宾厅' }) },

    /* 澳娱综合 */
    { id: 'grand-lisboa', name: '新葡京', op: '澳娱综合', prog: 'sjm', rooms: rooms('grand-lisboa', 'sjm',
      ['general', 'main', 'high', 'vip', 'private'],
      { general: '低额台，BJ 只赔 6:5，庄家软 17 要牌', main: '主楼层中场，6:5', high: '高额区改 3:2', vip: '高层贵宾厅', private: '私人包厅' }) },
    { id: 'lisboa-palace', name: '上葡京', op: '澳娱综合', prog: 'sjm', rooms: rooms('lisboa-palace', 'sjm',
      ['main', 'high', 'vip', 'private', 'chairman', 'supervip'],
      { main: '路氹新场，8 副牌靴', high: '高额区', vip: '至尊卡高额厅', private: '私人厅', chairman: '主席厅', supervip: '超级贵宾厅' }) },
    { id: 'lisboa', name: '葡京', op: '澳娱综合', prog: 'sjm', rooms: rooms('lisboa', 'sjm',
      ['general', 'main', 'high'],
      { general: '老葡京，最低注门槛最低，6:5', main: '与普通场相邻，6:5', high: '高额区 3:2' }) },
    { id: 'larc', name: '凯旋门', op: '澳娱综合', prog: 'sjm', rooms: rooms('larc', 'sjm',
      ['general', 'main'],
      { general: '半岛卫星场，台规偏保守', main: '小规模中场，6:5' }) },
    { id: 'oceanus', name: '回力海立方', op: '澳娱综合', prog: 'sjm', rooms: rooms('oceanus', 'sjm',
      ['main', 'high', 'vip'],
      { main: '码头旁，洗牌机为主', high: '高额区', vip: '海景贵宾厅' }) },

    /* 卫星场 */
    { id: 'ponte16', name: '十六浦', op: '卫星场', prog: 'sjm', rooms: rooms('ponte16', 'sat',
      ['general', 'main'],
      { general: '内港卫星场，每局销两张，6:5', main: '过渡期后并入承批公司' }) }
  ];

  window.BJ_CASINOS = {
    updated: '2026-11', currency: 'MOP（与 HKD 近似 1:1，仅作模拟）',
    roomLevels: ROOM_META, programs, casinos
  };
})();