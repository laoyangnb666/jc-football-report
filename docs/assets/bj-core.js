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

  /**
   * 中场积分：有效投注 / 每分所需投注额
   * 新濠改按新濠会（Altira 会籍表）计分，400 MOP = 1 分
   */
  function pointsFor(turnover, prog) {
    if (!prog || !prog.mopPerPoint) return 0;
    return turnover / prog.mopPerPoint;
  }

  /**
   * 中场卡级：只有官方公开的数值门槛才参与升级；
   * 门槛为 null（未公开 / 邀请）时停在当前档，进度返回 null
   */
  function tierOf(points, prog) {
    const tiers = (prog && prog.tiers) || [['—', 0]];
    let idx = 0;
    for (let i = 0; i < tiers.length; i++) {
      const need = tiers[i][1];
      if (need != null && points >= need) idx = i;
    }
    const cur = tiers[idx], nxt = tiers[idx + 1] || null;
    const known = !!prog.tiersKnown;
    const nextNeed = nxt && nxt[1] != null ? nxt[1] : null;
    const pct = nextNeed != null
      ? Math.max(0, Math.min(100, (points - cur[1]) / (nextNeed - cur[1]) * 100))
      : null;
    return {
      tier: cur[0],
      next: nxt ? nxt[0] : null,
      need: nextNeed != null ? Math.ceil(nextNeed - points) : null,
      pct, known,
      idx, count: tiers.length
    };
  }

  /**
   * 随机准入（邀约概率模型）
   * 达标也可能不中，未达标也可能被抽中：
   *   · 基础概率按「累计投注 / 基础门槛」线性给（最高 55%）
   *   · 单次投注按「单次最大 / 门槛单注」线性加分，2 倍门槛封顶 28%
   *   · 流水集中突击（稳定性扣分）→ 概率减半
   *   · 顶层隐藏卡概率另算，未达标上限 20%
   *   · 已完全达标却没中：每局保底 +25pp（顶层 +10pp），直到摇中
   *   · 中场会员卡等级匹配：最高 +10pp（顶层减半计入）
   * @param {function} rand 可注入的随机源（测试用），默认 Math.random
   * @param {object} pity 保底计数 { basic, top }：自上次达标未中以来的连续局数
   * @param {number} bonus 会员等级匹配加成（0–0.10）
   */
  function vipChance(stats, vip, rand, pity, bonus) {
    const r = rand || Math.random;
    pity = pity || {};
    const mb = Math.max(0, Math.min(0.10, bonus || 0));
    const base = vipScore(stats, vip);
    const basic = base.checks[0];
    const top = base.checks[base.checks.length - 1];

    const ratio = basic && basic.turnover ? Math.min(stats.turnover / basic.turnover, 1.5) : 0;
    const metB = !!(basic && basic.met);
    let p = Math.min(0.55, ratio * 0.38);
    if (metB) p = 0.55;

    // 大额单注通道：按「单次最大投注 / 门槛单注」线性加分，2 倍门槛时到顶
    const bigP = basic && basic.maxBet
      ? Math.min(0.28, stats.maxBet / basic.maxBet * 0.18) : 0;
    const bigBet = bigP >= 0.03;
    p += bigP;
    if (base.burst) p *= 0.5;
    p += mb;
    if (metB) p += 0.25 * (pity.basic || 0);   // 达标保底不因突击扣分而打折
    p = Math.min(metB ? 1 : 0.75, p);

    let pTop = 0;
    if (top && top !== basic) {
      const rTop = top.turnover ? Math.min(stats.turnover / top.turnover, 1.2) : 0;
      pTop = Math.min(0.12, rTop * 0.09);
      if (top.met) pTop = 0.12;
      if (bigBet) pTop += Math.min(0.04, bigP * 0.15);
      if (base.burst) pTop *= 0.5;
      pTop += mb * 0.5;
      if (top.met) pTop += 0.10 * (pity.top || 0);
      pTop = Math.min(top.met ? 1 : 0.2, pTop);
    }

    const rollBasic = r();
    const rollTop = r();
    const invitedBasic = rollBasic < p;
    const invitedTop = pTop > 0 && rollTop < pTop;

    return {
      ...base, p, pTop, bigBet, invitedBasic, invitedTop,
      invited: invitedTop ? 2 : invitedBasic ? 1 : 0
    };
  }

  /**
   * 贵宾候选评分（四维）：6 个月有效投注 A / 单次最大投注 B / 到访天数 C / 稳定性 D
   * 稳定性：若 80% 以上流水集中在连续 7 天以内 → 降一档
   * 注意：只输出候选状态，绝不授予权限
   */
  function vipScore(stats, vip) {
    const turnover = stats.turnover || 0;
    const maxBet = stats.maxBet || 0;
    const days = stats.days || 0;
    const arr = stats.dayTurnovers || [];

    // 连续 7 天窗口内的最大流水占比
    let best = 0;
    for (let i = 0; i + 7 <= arr.length; i++) {
      let s = 0;
      for (let k = i; k < i + 7; k++) s += arr[k];
      if (s > best) best = s;
    }
    const share = turnover > 0 ? best / turnover : 0;
    const burst = arr.length > 7 && share >= 0.8;

    const checks = (vip.tiers || []).map(t => {
      const okTurnover = turnover >= t.turnover;
      const okMax = maxBet >= t.maxBet;
      const okDays = days >= t.days;
      return {
        name: t.name, top: !!t.top,
        turnover: t.turnover, maxBet: t.maxBet, days: t.days,
        okTurnover, okMax, okDays,
        met: okTurnover && okMax && okDays
      };
    });

    let metLevel = 0;
    checks.forEach((c, i) => { if (c.met) metLevel = i + 1; });
    // 突击流水只扣「邀约概率」，不再把已达门槛的候选档降成未达标
    let level = metLevel;
    if (burst) level = Math.max(0, level - 1);

    return { level, metLevel, burst, share, checks, turnover, maxBet, days };
  }

  g.BJCore = {
    SUITS, RANKS, cardValue, buildShoe, handValue, isSoft, isBlackjack,
    sameRank, hiLo, basicStrategy, handReturn, simulate, pointsFor, tierOf, vipScore, vipChance
  };
})(window);