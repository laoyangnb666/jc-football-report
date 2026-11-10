/* ============================================================
   bj-core.js — 21 点纯算法层（无 DOM）
   牌值 / 点数 / 基本策略 / 单手结算 / 蒙特卡洛 EV / 积分与卡级
   页面只负责画界面与流程，所有「算」的部分都在这里。
   与 scripts/bj_model.py 保持同一套口径，可用 python 复算校验。
   ============================================================ */
(function (g) {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function cardValue(r) {
    if (r === 'A') return 11;
    if (r === '10' || r === 'J' || r === 'Q' || r === 'K') return 10;
    return +r;
  }

  function buildShoe(decks) {
    const a = [];
    for (let d = 0; d < decks; d++) {
      for (const s of SUITS) for (const r of RANKS) a.push({ r, s });
    }
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function handValue(cards) {
    let t = 0, aces = 0;
    for (const c of cards) { t += cardValue(c.r); if (c.r === 'A') aces++; }
    while (t > 21 && aces > 0) { t -= 10; aces--; }
    return t;
  }

  function isSoft(cards) {
    let t = 0, aces = 0;
    for (const c of cards) { t += cardValue(c.r); if (c.r === 'A') aces++; }
    while (t > 21 && aces > 0) { t -= 10; aces--; }
    return aces > 0;
  }

  function isBlackjack(cards, fromSplit) {
    return cards.length === 2 && handValue(cards) === 21 && !fromSplit;
  }

  const sameRank = (a, b) => a === b;

  /** Hi-Lo：2–6 记 +1，10/J/Q/K/A 记 -1 */
  function hiLo(r) {
    if ('23456'.includes(r)) return 1;
    if (r === 'A' || r === '10' || r === 'J' || r === 'Q' || r === 'K') return -1;
    return 0;
  }

  /**
   * 基本策略（6/8 副、庄家 17 停、DAS 口径）
   * @returns {'HIT'|'STAND'|'DOUBLE'|'SPLIT'|'SURR'}
   */
  function basicStrategy(cards, up, o) {
    const canDbl = !!(o && o.canDouble);
    const canSplit = !!(o && o.canSplit);
    const canSurr = !!(o && o.canSurrender);
    const tot = handValue(cards), soft = isSoft(cards);

    if (canSplit) {
      const r = cards[0].r;
      if (r === 'A' || r === '8') return 'SPLIT';
      if (['10', 'J', 'Q', 'K'].includes(r)) return 'STAND';
      if (r === '9') return (up >= 2 && up <= 9 && up !== 7) ? 'SPLIT' : 'STAND';
      if (r === '7') return up <= 7 ? 'SPLIT' : 'HIT';
      if (r === '6') return (up >= 2 && up <= 6) ? 'SPLIT' : 'HIT';
      if (r === '4') return (up === 5 || up === 6) ? 'SPLIT' : 'HIT';
      if (r === '3' || r === '2') return up <= 7 ? 'SPLIT' : 'HIT';
    }
    if (canSurr && !soft) {
      if (tot === 16 && (up === 9 || up === 10)) return 'SURR';
      if (tot === 15 && up === 10) return 'SURR';
    }
    if (soft) {
      if (tot >= 19) return 'STAND';
      if (tot === 18) {
        if (up >= 3 && up <= 6) return canDbl ? 'DOUBLE' : 'STAND';
        if (up === 2 || up === 7 || up === 8) return 'STAND';
        return 'HIT';
      }
      if (tot === 17) return (up >= 3 && up <= 6 && canDbl) ? 'DOUBLE' : 'HIT';
      if (tot >= 15) return (up >= 4 && up <= 6 && canDbl) ? 'DOUBLE' : 'HIT';
      return (up >= 5 && up <= 6 && canDbl) ? 'DOUBLE' : 'HIT';
    }
    if (tot >= 17) return 'STAND';
    if (tot === 16) return up <= 6 ? 'STAND' : 'HIT';
    if (tot === 15) return up <= 6 ? 'STAND' : 'HIT';
    if (tot >= 13) return up <= 6 ? 'STAND' : 'HIT';
    if (tot === 12) return (up >= 4 && up <= 6) ? 'STAND' : 'HIT';
    if (tot === 11) return (canDbl && up <= 10) ? 'DOUBLE' : 'HIT';
    if (tot === 10) return (canDbl && up <= 9) ? 'DOUBLE' : 'HIT';
    if (tot === 9) return (canDbl && up >= 3 && up <= 6) ? 'DOUBLE' : 'HIT';
    return 'HIT';
  }

  /**
   * 单手结算（返回给玩家的钱，含本金）
   * @param {Array} cards 该手牌
   * @param {number} bet 该手下注
   * @param {number} dv 庄家点数
   * @param {object} o { dealerBJ, bjPay, surrendered, fiveCard, special }
   * @returns {{ret:number, result:string, pl:number}}
   */
  function handReturn(cards, bet, dv, o) {
    o = o || {};
    const bjPay = o.bjPay == null ? 1.5 : o.bjPay;
    const hv = handValue(cards);

    if (o.closed) return { ret: bet * 2, result: '等额', pl: bet };
    if (o.surrendered) return { ret: bet * 0.5, result: '放弃', pl: -bet * 0.5 };
    if (o.fiveCard) return { ret: bet * 0.5, result: '五张牌', pl: -bet * 0.5 };
    if (o.special) return { ret: bet * (1 + o.special), result: '彩金', pl: bet * o.special };
    if (hv > 21) return { ret: 0, result: '爆', pl: -bet };

    if (isBlackjack(cards, o.fromSplit)) {
      if (o.dealerBJ) return { ret: bet, result: '和', pl: 0 };
      return { ret: bet * (1 + bjPay), result: 'BJ', pl: bet * bjPay };
    }
    if (o.dealerBJ) return { ret: 0, result: '负', pl: -bet };

    if (dv > 21 || hv > dv) return { ret: bet * 2, result: '胜', pl: bet };
    if (hv === dv) return { ret: bet, result: '和', pl: 0 };
    return { ret: 0, result: '负', pl: -bet };
  }

  /**
   * 蒙特卡洛：基本策略打 n 手，返回每手期望值（百分比）与抽样误差
   * @param {number} n
   * @param {object} o { decks, soft17:'s17'|'h17', bjPay }
   */
  function simulate(n, o) {
    o = o || {};
    const decks = o.decks || 6;
    const h17 = o.soft17 === 'h17';
    const bjPay = o.bjPay == null ? 1.5 : o.bjPay;
    let bank = 0, hands = 0, sumSq = 0;

    let sh = buildShoe(decks);
    const tk = () => { if (sh.length < 20) sh = buildShoe(decks); return sh.pop(); };

    for (let i = 0; i < n; i++) {
      const orig = 1;
      const upC = tk(), up = cardValue(upC.r);
      const p0 = [tk(), tk()];
      const pBJ = handValue(p0) === 21;
      const list = [{ cards: p0, bet: orig, fromSplit: false, done: pBJ, surrendered: false, five: false, dbl: false, natBJ: pBJ }];

      if (!pBJ) {
        for (let hi = 0; hi < list.length; hi++) {
          const h = list[hi];
          let guard = 0;
          while (!h.done && guard++ < 20) {
            const tot = handValue(h.cards);
            if (tot >= 21) { h.done = true; break; }
            const isPair = h.cards.length === 2 && sameRank(h.cards[0].r, h.cards[1].r);
            const canDbl = h.cards.length === 2 && !h.dbl;
            const canSplit = isPair && !h.fromSplit && !h.dbl && list.length < 4;
            const canSurr = h.cards.length === 2 && !h.fromSplit && !h.dbl && up !== 11;
            const act = basicStrategy(h.cards, up, { canDouble: canDbl, canSplit, canSurrender: canSurr });

            if (act === 'STAND') h.done = true;
            else if (act === 'HIT') h.cards.push(tk());
            else if (act === 'DOUBLE') { h.bet = orig * 2; h.dbl = true; h.cards.push(tk()); h.done = true; }
            else if (act === 'SURR') { h.surrendered = true; h.done = true; }
            else if (act === 'SPLIT') {
              const c2 = h.cards.pop();
              const ace = c2.r === 'A';
              const nh = { cards: [c2], bet: orig, fromSplit: true, done: false, surrendered: false, five: false, dbl: false, natBJ: false };
              h.cards.push(tk()); nh.cards.push(tk());
              h.fromSplit = true;
              list.splice(hi + 1, 0, nh);
              if (ace) { h.done = true; nh.done = true; }
              else if (handValue(h.cards) >= 21) h.done = true;
            }
          }
        }
      }

      const dC = [upC, tk()];
      const dBJ = handValue(dC) === 21;
      if (!dBJ) {
        const live = list.some(h => !h.surrendered && !h.five && handValue(h.cards) <= 21);
        if (live) {
          let guard = 0;
          while (guard++ < 12) {
            const v = handValue(dC);
            if (v < 17) { dC.push(tk()); continue; }
            if (v === 17 && h17 && isSoft(dC)) { dC.push(tk()); continue; }
            break;
          }
        }
      }
      const dv = handValue(dC);

      if (pBJ && dBJ) { hands++; continue; }
      if (dBJ) {
        const staked = list.reduce((a, h) => a + h.bet, 0);
        const loss = Math.min(orig, staked);
        bank -= loss; sumSq += loss * loss; hands += list.length;
        continue;
      }
      for (const h of list) {
        hands++;
        const r = handReturn(h.cards, h.bet, dv, {
          dealerBJ: false, bjPay, fromSplit: h.fromSplit, surrendered: h.surrendered, five: h.five
        }).pl;
        bank += r; sumSq += r * r;
      }
    }

    const per = bank / hands * 100;
    const mean = bank / hands;
    const sd = Math.sqrt(Math.max(0, sumSq / hands - mean * mean));
    return { ev: per, se: sd / Math.sqrt(hands) * 100, hands };
  }

  /** 积分 = 流水 × 场馆费率 */
  const pointsFor = (turnover, rate) => turnover * rate;

  /** 卡级：返回 { index, tier, next, pct } */
  function tierOf(points, program) {
    const tiers = (program && program.tiers) || [['普通卡', 0]];
    let idx = 0;
    for (let i = 0; i < tiers.length; i++) if (points >= tiers[i][1]) idx = i;
    const cur = tiers[idx], nxt = tiers[idx + 1] || null;
    const pct = nxt ? Math.min(100, (points - cur[1]) / (nxt[1] - cur[1]) * 100) : 100;
    return { index: idx, tier: cur[0], next: nxt ? nxt[0] : null, need: nxt ? Math.ceil(nxt[1] - points) : 0, pct };
  }

  g.BJCore = {
    SUITS, RANKS, cardValue, buildShoe, handValue, isSoft, isBlackjack,
    sameRank, hiLo, basicStrategy, handReturn, simulate, pointsFor, tierOf
  };
})(window);