/* ============================================================
   bj-mall.js — 积分商城目录
   ------------------------------------------------------------
   商品依据四家会籍的官方权益目录归纳（餐饮 / 酒店 / 表演 / 水疗 /
   交通 / 零售 / 体验），value 为该礼遇的澳门元参考价值。

   定价模型：会员回赠约为有效投注的 1.5%
     所需积分 = value ÷ (mopPerPoint × 0.015)
   由于各卡系「多少流水 = 1 分」不同，积分数字差别很大，但兑换同一
   礼遇所需流水一致，横向可比。
   need 为所需卡级比例（0 = 不限，1 = 最高档），按各卡系实际档位换算。
   ============================================================ */
(function () {
  const CATS = [
    { id: 'food',   zh: '餐饮',   en: 'Dining' },
    { id: 'hotel',  zh: '住宿',   en: 'Stay' },
    { id: 'show',   zh: '表演',   en: 'Shows' },
    { id: 'spa',    zh: '水疗',   en: 'Spa' },
    { id: 'travel', zh: '交通',   en: 'Travel' },
    { id: 'retail', zh: '零售',   en: 'Retail' },
    { id: 'exp',    zh: '体验',   en: 'Experiences' }
  ];

  const ITEMS = [
    /* ---- 餐饮 ---- */
    { id: 'coffee', cat: 'food', zh: '手冲咖啡 + 葡挞两件', en: 'Pour-over coffee + 2 egg tarts',
      value: 90, need: 0, desc: '中场咖啡吧即取，每日一杯', descEn: 'From the floor café, one per day' },
    { id: 'chacha', cat: 'food', zh: '茶餐厅双人套餐', en: 'Cha chaan teng set for two',
      value: 260, need: 0, desc: '含饮品两杯，午市或晚市通用', descEn: 'Two drinks included, lunch or dinner' },
    { id: 'buffet', cat: 'food', zh: '自助晚餐 · 双人', en: 'Buffet dinner for two',
      value: 900, need: 0, desc: '度假村自助餐厅，需提前一日订位', descEn: 'Resort buffet; book one day ahead' },
    { id: 'michelin', cat: 'food', zh: '米芝莲星级午市套餐 · 两位', en: 'Michelin-starred lunch for two',
      value: 1200, need: 0.2, desc: '指定星级餐厅，含餐酒一杯', descEn: 'Selected starred restaurant, one glass of wine' },
    { id: 'chef', cat: 'food', zh: '名厨主理晚宴 · 两位', en: "Chef's table dinner for two",
      value: 2600, need: 0.6, desc: '主厨现场解说，八道菜', descEn: 'Eight courses with the chef at the table' },
    { id: 'roomservice', cat: 'food', zh: '客房送餐双人早餐', en: 'In-room breakfast for two',
      value: 320, need: 0, desc: '入住期间 06:00–11:00 供应', descEn: 'Served 06:00–11:00 during your stay' },

    /* ---- 住宿 ---- */
    { id: 'room', cat: 'hotel', zh: '标准客房 · 一晚含双早', en: 'Standard room · 1 night + breakfast',
      value: 1800, need: 0, desc: '周日至周四入住，不含节假日', descEn: 'Sun–Thu stays, excludes public holidays' },
    { id: 'suite', cat: 'hotel', zh: '套房 · 一晚含双早', en: 'Suite · 1 night + breakfast',
      value: 4200, need: 0.4, desc: '含行政酒廊使用权', descEn: 'Executive lounge access included' },
    { id: 'twonight', cat: 'hotel', zh: '度假套票 · 两晚含双早', en: 'Getaway package · 2 nights',
      value: 5600, need: 0.6, desc: '含延迟退房至 16:00', descEn: 'Late checkout to 16:00' },
    { id: 'villa', cat: 'hotel', zh: '天际别墅 · 一晚', en: 'Sky villa · 1 night',
      value: 16000, need: 1, desc: '管家服务，专车接送', descEn: 'Butler service and private transfer' },

    /* ---- 表演 ---- */
    { id: 'cinema', cat: 'show', zh: '电影院双人票', en: 'Cinema tickets for two',
      value: 220, need: 0, desc: '度假村影院，含爆米花套餐', descEn: 'Resort cinema, popcorn combo included' },
    { id: 'stage', cat: 'show', zh: '驻场舞台演出 · 两张', en: 'Residency show · 2 tickets',
      value: 900, need: 0, desc: 'A 区座位，需提前换票', descEn: 'Section A seats, exchange in advance' },
    { id: 'aqua', cat: 'show', zh: '大型水上汇演 · 贵宾席两张', en: 'Water spectacle · 2 VIP seats',
      value: 1500, need: 0.4, desc: '贵宾席含迎宾饮品', descEn: 'VIP seats with welcome drinks' },
    { id: 'concert', cat: 'show', zh: '演唱会包厢 · 四位', en: 'Concert box · 4 seats',
      value: 9000, need: 0.8, desc: '独立包厢，含餐点与饮品', descEn: 'Private box with food and drinks' },

    /* ---- 水疗 ---- */
    { id: 'massage', cat: 'spa', zh: '香薰按摩 · 60 分钟', en: 'Aromatherapy massage · 60 min',
      value: 780, need: 0, desc: '单人或双人同行均可使用', descEn: 'Valid for one, or two sharing' },
    { id: 'spa2', cat: 'spa', zh: '双人水疗套餐 · 90 分钟', en: 'Couples spa · 90 min',
      value: 2300, need: 0.2, desc: '含蒸汽房与轻食', descEn: 'Steam room and light refreshments' },
    { id: 'hair', cat: 'spa', zh: '沙龙美发造型', en: 'Salon hair styling',
      value: 480, need: 0, desc: '洗剪吹，需预约', descEn: 'Wash, cut and blow-dry; by appointment' },

    /* ---- 交通 ---- */
    { id: 'ferry', cat: 'travel', zh: '港澳喷射飞航 · 普通位', en: 'Macau–HK ferry · standard',
      value: 180, need: 0, desc: '单程，平日适用', descEn: 'One way, weekdays' },
    { id: 'lounge', cat: 'travel', zh: '机场贵宾休息室 · 两位', en: 'Airport lounge · 2 guests',
      value: 500, need: 0, desc: '含餐饮与淋浴', descEn: 'Food, drinks and shower' },
    { id: 'car', cat: 'travel', zh: '跨境轿车接送 · 单程', en: 'Cross-border car · one way',
      value: 900, need: 0.4, desc: '港澳两地牌，需提前一日预约', descEn: 'Dual-plate car; book one day ahead' },

    /* ---- 零售 ---- */
    { id: 'tumbler', cat: 'retail', zh: '度假村联名保温杯', en: 'Resort-branded tumbler',
      value: 260, need: 0, desc: '礼宾部领取，颜色随机', descEn: 'Collect at concierge; colour varies' },
    { id: 'pastry', cat: 'retail', zh: '中式礼饼礼盒', en: 'Chinese pastry gift box',
      value: 320, need: 0, desc: '季节限定，售完即止', descEn: 'Seasonal, while stocks last' },
    { id: 'tote', cat: 'retail', zh: '联名旅行袋', en: 'Collaboration travel tote',
      value: 620, need: 0.2, desc: '限量款，每人限兑一件', descEn: 'Limited edition, one per member' },

    /* ---- 体验 ---- */
    { id: 'cooking', cat: 'exp', zh: '厨艺教室 · 双人', en: 'Cooking class for two',
      value: 1400, need: 0.2, desc: '主厨带教，成品可带走', descEn: 'Taught by a chef; take your dish home' },
    { id: 'backstage', cat: 'exp', zh: '剧院后台参观 · 两位', en: 'Backstage tour for two',
      value: 2000, need: 0.6, desc: '演出前导览，可合影', descEn: 'Pre-show tour with photo opportunity' },
    { id: 'draw', cat: 'exp', zh: '会员专属抽奖券 ×1', en: 'Members draw ticket ×1',
      value: 100, need: 0, desc: '可重复兑换，每月开奖一次', descEn: 'Repeatable; monthly draw' }
  ];

  /* 回赠率：礼遇价值 ÷ 有效投注 */
  const RETURN_RATE = 0.015;

  function priceOf(item, prog) {
    const per = (prog && prog.mopPerPoint) || 1000;
    return Math.max(1, Math.round(item.value / (per * RETURN_RATE)));
  }

  window.BJ_MALL = { CATS, ITEMS, RETURN_RATE, priceOf };
})();