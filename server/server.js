'use strict';
// jc-football-report 付费墙服务
// 登录 + 8.8 元/月订阅看数据 + 9.9 元/次下载报告 + 支付宝网关 + 反爬
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const { execFile } = require('child_process');

// ---------- 环境变量（必须在 require lib 之前加载） ----------
function loadEnv() {
  const p = path.join(__dirname, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const store = require('./lib/store');
const auth = require('./lib/auth');
const alipay = require('./lib/alipay');
const guard = require('./lib/guard');

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '127.0.0.1';
const BASE_URL = (process.env.BASE_URL || `http://${HOST}:${PORT}`).replace(/\/$/, '');
const PRICE_PDF = Number(process.env.PRICE_PDF || 9.9);
const PRICE_SUB = Number(process.env.PRICE_SUB || 8.8);
const SUB_DAYS = 30;
const PUBLIC_DIR = path.join(__dirname, 'public');
const PRIVATE_DIR = path.join(__dirname, 'private');
const REPORT_PDF = process.env.REPORT_PDF || path.join(PRIVATE_DIR, 'report-2026-11-22.pdf');
const REPORT_NAME = process.env.REPORT_NAME || '竞彩足球与传足分析报告_2026-11-22.pdf';
const PYTHON = process.env.PYTHON || 'python';

// ---------- 基础工具 ----------
function ipOf(req) {
  if (process.env.TRUST_PROXY === '1') {
    const xf = req.headers['x-forwarded-for'];
    if (xf) return String(xf).split(',')[0].trim();
  }
  return req.socket.remoteAddress || '0.0.0.0';
}

function send(res, code, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'Content-Type': type, ...extra });
  res.end(body);
}
function sendJson(res, code, obj, extra = {}) {
  send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8', extra);
}
function redirect(res, to) {
  res.writeHead(302, { Location: to, 'Cache-Control': 'no-store' });
  res.end();
}
function nowIso() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

function userPublic(u) {
  return {
    email: u.email,
    subUntil: u.subUntil || 0,
    subActive: auth.subActive(u),
    pdfCredits: u.pdfCredits || 0,
    createdAt: u.createdAt,
  };
}

function findUserByEmail(email) {
  const d = store.get();
  const e = String(email || '').trim().toLowerCase();
  return d.users.find((u) => u.email === e) || null;
}

// ---------- 支付落账（幂等） ----------
function markPaid(orderId, tradeNo, paidAmount) {
  const db = store.get();
  const o = db.orders.find((x) => x.id === orderId);
  if (!o) return { ok: false, reason: 'ORDER_NOT_FOUND' };
  if (o.status === 'paid') return { ok: true, already: true };
  const amt = Number(paidAmount || o.amount);
  if (Math.abs(amt - o.amount) > 0.005) {
    store.audit('AMOUNT_MISMATCH', { orderId, expect: o.amount, got: amt });
    return { ok: false, reason: 'AMOUNT_MISMATCH' };
  }
  const u = db.users.find((x) => x.id === o.uid);
  if (!u) return { ok: false, reason: 'USER_NOT_FOUND' };
  o.status = 'paid';
  o.paidAt = Date.now();
  o.tradeNo = tradeNo || null;
  o.paidAmount = amt;
  if (o.plan === 'sub') {
    const base = Math.max(Date.now(), u.subUntil || 0);
    u.subUntil = base + SUB_DAYS * 24 * 3600 * 1000;
  } else if (o.plan === 'pdf') {
    u.pdfCredits = (u.pdfCredits || 0) + 1;
  }
  store.save();
  store.audit('ORDER_PAID', { orderId, uid: u.id, plan: o.plan, amount: amt });
  return { ok: true };
}

async function confirmOrder(orderId) {
  const db = store.get();
  const o = db.orders.find((x) => x.id === orderId);
  if (!o) return { ok: false, reason: 'ORDER_NOT_FOUND' };
  if (o.status === 'paid') return { ok: true, paid: true };
  if (!alipay.configured()) return { ok: false, reason: 'ALIPAY_NOT_CONFIGURED' };
  try {
    const q = await alipay.query(orderId);
    if (q.tradeStatus === 'TRADE_SUCCESS' || q.tradeStatus === 'TRADE_FINISHED') {
      const r = markPaid(orderId, q.tradeNo, q.totalAmount);
      return { ok: r.ok, paid: r.ok, status: q.tradeStatus };
    }
    return { ok: true, paid: false, status: q.tradeStatus };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ---------- 静态文件 ----------
const STATIC_EXT = new Set(['.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff2', '.webp']);

function serveStatic(req, res, pathname) {
  const rel = pathname.replace(/^\/+/, '');
  if (rel.includes('..') || rel.includes('\\')) return send(res, 400, 'bad path');
  const abs = path.resolve(PUBLIC_DIR, rel);
  if (!abs.startsWith(path.resolve(PUBLIC_DIR))) return send(res, 403, 'forbidden');
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return false;
  const ext = path.extname(abs).toLowerCase();
  if (!STATIC_EXT.has(ext) && ext !== '.html' && ext !== '.txt') return false;
  const isHtml = ext === '.html';
  guard.securityHeaders(res, { html: isHtml, cache: isHtml ? 'no-store' : 'public, max-age=300' });
  send(res, 200, fs.readFileSync(abs), isHtml ? 'text/html; charset=utf-8' : contentType(ext));
  return true;
}

function contentType(ext) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
    '.txt': 'text/plain; charset=utf-8',
  }[ext] || 'application/octet-stream';
}

// ---------- 业务路由 ----------
async function handleApi(req, res, url) {
  const p = url.pathname;
  const ip = ipOf(req);
  const fp = String(req.headers['x-fp'] || '');
  const session = auth.getSession(req);

  guard.securityHeaders(res, { cache: 'no-store' });

  // 全局限流：每 IP 每分钟 240 次
  const g = guard.hit(`ip:${ip}`, 240, 60000);
  if (!g.ok) return sendJson(res, 429, { error: 'RATE_LIMIT' });

  // 反爬：API 必须是浏览器 UA + 语言头
  const human = guard.looksHuman(req);
  if (!human.ok) {
    store.audit('BOT_BLOCK', { ip, ua: req.headers['user-agent'] || '', reason: human.reason, path: p });
    return sendJson(res, 403, { error: 'BLOCKED', reason: human.reason });
  }

  if (req.method === 'GET' && p === '/api/config') {
    return sendJson(res, 200, {
      alipay: alipay.configured(),
      price: { pdf: PRICE_PDF, sub: PRICE_SUB },
      base: BASE_URL,
      report: { name: REPORT_NAME, date: '2026-11-22' },
    });
  }

  if (req.method === 'GET' && p === '/api/captcha') {
    const c = guard.newCaptcha();
    return sendJson(res, 200, c);
  }

  // ---- 注册 ----
  if (req.method === 'POST' && p === '/api/register') {
    if (!guard.sameOrigin(req)) return sendJson(res, 403, { error: 'BAD_ORIGIN' });
    const rl = guard.hit(`reg:${ip}`, 8, 15 * 60 * 1000);
    if (!rl.ok) return sendJson(res, 429, { error: 'RATE_LIMIT' });
    const body = await guard.readJson(req);
    if (body.hp) return sendJson(res, 400, { error: 'BOT' }); // 蜜罐
    if (!guard.checkCaptcha(body.captchaId, body.captcha)) return sendJson(res, 400, { error: 'CAPTCHA' });
    const email = String(body.email || '').trim().toLowerCase();
    const pw = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return sendJson(res, 400, { error: 'EMAIL' });
    if (pw.length < 8 || pw.length > 72) return sendJson(res, 400, { error: 'PASSWORD' });
    if (findUserByEmail(email)) return sendJson(res, 409, { error: 'EXISTS' });
    const db = store.get();
    const u = {
      id: 'u' + crypto.randomBytes(8).toString('hex'),
      email,
      pw: auth.hashPassword(pw),
      createdAt: Date.now(),
      fp: fp || null,
      subUntil: 0,
      pdfCredits: 0,
      lastIp: ip,
    };
    db.users.push(u);
    store.save();
    store.audit('REGISTER', { uid: u.id, ip });
    const cookie = auth.createSession(u.id, fp, ip);
    return sendJson(res, 200, { ok: true, user: userPublic(u) }, { 'Set-Cookie': auth.cookieHeader(cookie, auth.SESSION_TTL / 1000) });
  }

  // ---- 登录 ----
  if (req.method === 'POST' && p === '/api/login') {
    if (!guard.sameOrigin(req)) return sendJson(res, 403, { error: 'BAD_ORIGIN' });
    const body = await guard.readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const pw = String(body.password || '');
    const ipRl = guard.hit(`login:${ip}`, 10, 15 * 60 * 1000);
    const accRl = guard.hit(`login:u:${email}`, 12, 60 * 60 * 1000);
    if (!ipRl.ok || !accRl.ok) return sendJson(res, 429, { error: 'RATE_LIMIT' });
    if (!guard.checkCaptcha(body.captchaId, body.captcha)) return sendJson(res, 400, { error: 'CAPTCHA' });
    const u = findUserByEmail(email);
    if (!u || !auth.verifyPassword(pw, u.pw)) {
      store.audit('LOGIN_FAIL', { email, ip });
      return sendJson(res, 401, { error: 'CREDENTIALS' });
    }
    if (u.banned) return sendJson(res, 403, { error: 'BANNED' });
    if (u.fp && fp && u.fp !== fp) store.audit('FP_CHANGED', { uid: u.id, ip });
    if (!u.fp && fp) u.fp = fp;
    u.lastIp = ip;
    u.lastLogin = Date.now();
    store.save();
    store.audit('LOGIN_OK', { uid: u.id, ip });
    const cookie = auth.createSession(u.id, fp, ip);
    return sendJson(res, 200, { ok: true, user: userPublic(u) }, { 'Set-Cookie': auth.cookieHeader(cookie, auth.SESSION_TTL / 1000) });
  }

  if (req.method === 'POST' && p === '/api/logout') {
    auth.destroySession(req);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.clearCookieHeader() });
  }

  // 以下全部需要登录
  if (!session) return sendJson(res, 401, { error: 'NEED_LOGIN' });
  const u = session.user;

  // 本地联调：仅 DEV_GRANT=1 且提供 DEV_GRANT_KEY 时生效，默认关闭；公网请勿开启
  if (req.method === 'POST' && p === '/api/dev/grant') {
    if (process.env.DEV_GRANT !== '1') return sendJson(res, 404, { error: 'NOT_FOUND' });
    if ((req.headers['x-dev-key'] || '') !== (process.env.DEV_GRANT_KEY || '')) {
      return sendJson(res, 403, { error: 'DEV_KEY' });
    }
    const body = await guard.readJson(req).catch(() => ({}));
    if (body.plan === 'sub') {
      u.subUntil = Math.max(Date.now(), u.subUntil || 0) + SUB_DAYS * 24 * 3600 * 1000;
    } else if (body.plan === 'pdf') {
      u.pdfCredits = (u.pdfCredits || 0) + Math.max(1, Number(body.count || 1));
    } else {
      return sendJson(res, 400, { error: 'PLAN' });
    }
    store.save();
    store.audit('DEV_GRANT', { uid: u.id, plan: body.plan, ip });
    return sendJson(res, 200, { ok: true, user: userPublic(u) });
  }

  if (req.method === 'GET' && p === '/api/me') {
    const db = store.get();
    const orders = db.orders
      .filter((o) => o.uid === u.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map((o) => ({ id: o.id, plan: o.plan, amount: o.amount, status: o.status, createdAt: o.createdAt }));
    return sendJson(res, 200, { user: userPublic(u), orders });
  }

  // ---- 数据（订阅才可读）----
  if (req.method === 'GET' && p === '/api/data') {
    const rl = guard.hit(`data:${u.id}`, 30, 60 * 1000);
    if (!rl.ok) return sendJson(res, 429, { error: 'RATE_LIMIT' });
    if (!auth.subActive(u)) return sendJson(res, 402, { error: 'NEED_SUB', price: PRICE_SUB });
    // 设备指纹：换设备复用 cookie 会被拒
    if (session.fp && fp && session.fp !== fp) {
      store.audit('FP_MISMATCH_DATA', { uid: u.id, ip });
      return sendJson(res, 403, { error: 'FP_MISMATCH' });
    }
    const raw = fs.readFileSync(path.join(PRIVATE_DIR, 'data.js'), 'utf8');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    let data;
    try { data = JSON.parse(raw.slice(start, end + 1)); } catch (e) { return sendJson(res, 500, { error: 'DATA_BROKEN' }); }
    return sendJson(res, 200, { data, issuedAt: nowIso() });
  }

  // ---- 下单 ----
  if (req.method === 'POST' && p === '/api/order') {
    if (!guard.sameOrigin(req)) return sendJson(res, 403, { error: 'BAD_ORIGIN' });
    const body = await guard.readJson(req);
    const plan = body.plan === 'sub' ? 'sub' : body.plan === 'pdf' ? 'pdf' : null;
    if (!plan) return sendJson(res, 400, { error: 'PLAN' });
    const rl = guard.hit(`order:${u.id}`, 6, 10 * 60 * 1000);
    if (!rl.ok) return sendJson(res, 429, { error: 'RATE_LIMIT' });
    if (!alipay.configured()) return sendJson(res, 503, { error: 'ALIPAY_NOT_CONFIGURED' });
    const db = store.get();
    const amount = plan === 'pdf' ? PRICE_PDF : PRICE_SUB;
    const id = 'JC' + Date.now() + crypto.randomBytes(2).toString('hex').toUpperCase();
    const subject = plan === 'pdf' ? '竞彩/传足分析报告 单次下载' : 'jc-football-report 会员（30 天）';
    const order = { id, uid: u.id, plan, amount, status: 'created', createdAt: Date.now(), tradeNo: null };
    db.orders.push(order);
    store.save();
    let payUrl;
    try {
      payUrl = alipay.pagePayUrl({
        outTradeNo: id,
        subject,
        totalAmount: amount,
        returnUrl: `${BASE_URL}/pay/return`,
        notifyUrl: process.env.ALIPAY_NOTIFY_URL || undefined,
      });
    } catch (e) {
      return sendJson(res, 503, { error: 'ALIPAY_' + e.message });
    }
    store.audit('ORDER_CREATED', { orderId: id, uid: u.id, plan, amount, ip });
    return sendJson(res, 200, { ok: true, orderId: id, payUrl, amount });
  }

  if (req.method === 'GET' && p === '/api/order/status') {
    const id = url.searchParams.get('id') || '';
    const db = store.get();
    const o = db.orders.find((x) => x.id === id && x.uid === u.id);
    if (!o) return sendJson(res, 404, { error: 'NOT_FOUND' });
    if (o.status !== 'paid') {
      const r = await confirmOrder(id);
      return sendJson(res, 200, { status: r.paid ? 'paid' : o.status, alipay: r.status || r.reason || '' });
    }
    return sendJson(res, 200, { status: 'paid' });
  }

  // ---- PDF 下载凭证（每次下载消耗 1 次额度）----
  if (req.method === 'POST' && p === '/api/pdf/ticket') {
    if (!guard.sameOrigin(req)) return sendJson(res, 403, { error: 'BAD_ORIGIN' });
    const rl = guard.hit(`pdf:${u.id}`, 10, 60 * 60 * 1000);
    if (!rl.ok) return sendJson(res, 429, { error: 'RATE_LIMIT' });
    if (session.fp && fp && session.fp !== fp) return sendJson(res, 403, { error: 'FP_MISMATCH' });
    if ((u.pdfCredits || 0) <= 0) return sendJson(res, 402, { error: 'NEED_PDF', price: PRICE_PDF });
    u.pdfCredits -= 1;
    const db = store.get();
    const token = crypto.randomBytes(24).toString('hex');
    db.tickets.push({ token, uid: u.id, exp: Date.now() + 10 * 60 * 1000, used: false, createdAt: Date.now() });
    store.save();
    store.audit('PDF_TICKET', { uid: u.id, ip });
    return sendJson(res, 200, { ok: true, url: `/download/${token}`, expiresIn: 600 });
  }

  return sendJson(res, 404, { error: 'NOT_FOUND' });
}

// ---------- PDF 下载 ----------
function handleDownload(req, res, url) {
  guard.securityHeaders(res, { cache: 'no-store' });
  const token = url.pathname.split('/').pop();
  const session = auth.getSession(req);
  if (!session) return send(res, 401, '请先登录');
  const db = store.get();
  const t = db.tickets.find((x) => x.token === token);
  if (!t || t.uid !== session.user.id) return send(res, 403, '无效的下载凭证');
  if (t.used) return send(res, 410, '凭证已使用');
  if (t.exp < Date.now()) return send(res, 410, '凭证已过期');
  t.used = true;
  t.usedAt = Date.now();
  store.save();
  store.audit('PDF_DOWNLOAD', { uid: session.user.id, ip: ipOf(req) });

  if (!fs.existsSync(REPORT_PDF)) {
    return send(res, 404, '本期报告尚未上传，请联系管理员', 'text/plain; charset=utf-8');
  }

  const stamp = nowIso().slice(0, 16);
  const mark = `${session.user.email} | ${stamp}`;
  const tmpOut = path.join(os.tmpdir(), 'jc-lic-' + crypto.randomBytes(6).toString('hex') + '.pdf');
  execFile(PYTHON, [path.join(__dirname, 'lib', 'watermark.py'), REPORT_PDF, tmpOut, mark], { timeout: 30000 }, (err) => {
    const file = err || !fs.existsSync(tmpOut) ? REPORT_PDF : tmpOut;
    if (err) console.error('[pdf] 水印失败，回退原文件:', err.message);
    const stat = fs.statSync(file);
    const encoded = encodeURIComponent(REPORT_NAME);
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="report.pdf"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    });
    const rs = fs.createReadStream(file);
    rs.pipe(res);
    rs.on('end', () => { if (file !== REPORT_PDF) try { fs.unlinkSync(file); } catch (_) {} });
    rs.on('error', () => res.destroy());
  });
}

// ---------- 支付返回 / 异步通知 ----------
async function handlePayReturn(req, res, url) {
  const session = auth.getSession(req);
  const id = url.searchParams.get('out_trade_no') || '';
  if (!session) return redirect(res, '/login.html?next=pay');
  if (!id) return redirect(res, '/app.html?pay=fail');
  const r = await confirmOrder(id);
  if (r.paid) return redirect(res, '/app.html?paid=1');
  return redirect(res, '/pay.html?order=' + encodeURIComponent(id) + '&state=' + encodeURIComponent(r.status || r.reason || 'unknown'));
}

async function handleNotify(req, res) {
  guard.securityHeaders(res, { cache: 'no-store' });
  if (req.method !== 'POST') return send(res, 405, 'method');
  let form;
  try { form = await guard.readForm(req); } catch (e) { return send(res, 400, 'bad body'); }
  const v = alipay.verifyNotify(form);
  store.audit('ALIPAY_NOTIFY', { ok: v.ok, reason: v.reason || '', orderId: form.out_trade_no || '' });
  if (!v.ok) return send(res, 400, 'fail');
  if (v.status !== 'TRADE_SUCCESS' && v.status !== 'TRADE_FINISHED') return send(res, 200, 'success');
  const r = markPaid(form.out_trade_no, form.trade_no, form.total_amount);
  return send(res, 200, r.ok ? 'success' : 'fail');
}

// ---------- 路由分发 ----------
const PAGE_ROUTES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/login': 'login.html',
  '/login.html': 'login.html',
  '/app': 'app.html',
  '/app.html': 'app.html',
  '/pay': 'pay.html',
  '/pay.html': 'pay.html',
};

async function router(req, res) {
  let url;
  try { url = new URL(req.url, 'http://' + (req.headers.host || 'localhost')); }
  catch (e) { return send(res, 400, 'bad url'); }

  const p = url.pathname;

  try {
    if (p.startsWith('/api/alipay/notify')) return await handleNotify(req, res);
    if (p === '/pay/return') return await handlePayReturn(req, res, url);
    if (p.startsWith('/download/')) return handleDownload(req, res, url);
    if (p.startsWith('/api/')) return await handleApi(req, res, url);

    if (req.method === 'GET' && PAGE_ROUTES[p]) {
      const abs = path.join(PUBLIC_DIR, PAGE_ROUTES[p]);
      guard.securityHeaders(res, { html: true });
      return send(res, 200, fs.readFileSync(abs), 'text/html; charset=utf-8');
    }

    if (req.method === 'GET') {
      const ok = serveStatic(req, res, p);
      if (ok !== false) return;
    }

    guard.securityHeaders(res, { html: true });
    send(res, 404, '<!doctype html><meta charset="utf-8"><title>404</title><p style="font-family:sans-serif;padding:40px">页面不存在</p>', 'text/html; charset=utf-8');
  } catch (e) {
    console.error('[500]', req.method, p, e.message);
    try { sendJson(res, 500, { error: 'SERVER', message: e.message }); } catch (_) {}
  }
}

// ---------- 启动 ----------
store.load();
const server = http.createServer((req, res) => { router(req, res); });
server.listen(PORT, HOST, () => {
  console.log(`jc-football-report 付费墙已启动: http://${HOST}:${PORT}`);
  console.log(`支付宝: ${alipay.configured() ? '已配置（真实收款）' : '未配置（.env 里填 ALIPAY_APP_ID / 私钥 / 支付宝公钥）'}`);
  console.log(`定价: 报告 ${PRICE_PDF} 元/次 · 会员 ${PRICE_SUB} 元/30 天`);
  console.log(`数据: private/data.js · 报告: ${REPORT_PDF}`);
});
server.on('error', (e) => {
  console.error('启动失败:', e.code === 'EADDRINUSE' ? `端口 ${PORT} 被占用` : e.message);
  process.exit(1);
});
process.on('SIGINT', () => { try { store.flush(); } catch (_) {} process.exit(0); });