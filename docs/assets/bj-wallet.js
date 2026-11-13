/* ============================================================
   bj-wallet.js — 21 点会员钱包（跨页面共享）
   牌桌页与积分商城页共用一份状态，存在 localStorage：
     { venue: 上次场馆下标, mem: {卡系ID: 会员数据}, orders: 兑换记录 }
   ============================================================ */
(function () {
  const KEY = 'bj.wallet.v1';

  function blank() { return { venue: 0, mem: {}, orders: [] }; }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const w = JSON.parse(raw) || {};
      return { venue: +w.venue || 0, mem: w.mem || {}, orders: w.orders || [] };
    } catch (e) {
      return blank();
    }
  }

  function save(w) {
    try { localStorage.setItem(KEY, JSON.stringify(w)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function memOf(w, progId) {
    if (!w.mem[progId]) {
      w.mem[progId] = {
        points: 0, turnover: 0, maxStake: 0, dayTurnovers: [], card: 0, cardRound: 0
      };
    }
    return w.mem[progId];
  }

  /* 每局都会记一条到访，只保留最近 60 条，避免 localStorage 越存越大 */
  function trim(m) {
    if (m.dayTurnovers && m.dayTurnovers.length > 60) {
      m.dayTurnovers = m.dayTurnovers.slice(-60);
    }
    return m;
  }

  window.BJWallet = { KEY, blank, load, save, memOf, trim };
})();