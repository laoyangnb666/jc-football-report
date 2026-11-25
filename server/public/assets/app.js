'use strict';
// 共享前端：设备指纹、API 封装、时间格式化
(function () {
  const FP_KEY = 'jc_fp_v1';

  function simpleHash(str) {
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = (h1 ^ c) * 16777619 >>> 0;
      h2 = (h2 + c * (i + 1)) >>> 0;
    }
    return (h1.toString(16) + h2.toString(16)).padStart(16, '0').slice(0, 32);
  }

  function canvasSig() {
    try {
      const c = document.createElement('canvas');
      c.width = 220; c.height = 60;
      const g = c.getContext('2d');
      g.textBaseline = 'top';
      g.font = '14px "Arial"';
      g.fillStyle = '#f60';
      g.fillRect(0, 0, 120, 22);
      g.fillStyle = '#069';
      g.fillText('jc-football-report', 2, 4);
      g.fillStyle = 'rgba(102,204,0,.7)';
      g.fillText('fingerprint', 4, 30);
      return c.toDataURL().slice(-96);
    } catch (e) { return 'nocanvas'; }
  }

  async function fingerprint() {
    const cached = localStorage.getItem(FP_KEY);
    if (cached) return cached;
    const raw = [
      navigator.userAgent, navigator.language, navigator.languages && navigator.languages.join(','),
      screen.width, screen.height, screen.colorDepth,
      new Date().getTimezoneOffset(), navigator.hardwareConcurrency || 0,
      canvasSig(),
    ].join('|');
    let hex;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    } catch (e) {
      hex = simpleHash(raw);
    }
    localStorage.setItem(FP_KEY, hex);
    return hex;
  }

  async function api(path, opts) {
    const o = opts || {};
    const fp = await fingerprint();
    const r = await fetch(path, {
      method: o.method || 'GET',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-FP': fp,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: o.body ? JSON.stringify(o.body) : undefined,
      cache: 'no-store',
    });
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : { raw: await r.text() };
    return { status: r.status, ok: r.ok, data };
  }

  function money(n) { return '¥' + Number(n).toFixed(2); }

  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function daysLeft(ts) {
    if (!ts) return 0;
    return Math.max(0, Math.ceil((ts - Date.now()) / 86400000));
  }

  window.JC = { fingerprint, api, money, fmtTime, daysLeft };

  // 全局防复制/防选择（只提高随手抓取成本，不构成安全边界）
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => {
    if (!e.target.closest('input,textarea,code,pre')) e.preventDefault();
  });
})();