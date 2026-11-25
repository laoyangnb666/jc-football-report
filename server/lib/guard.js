'use strict';
// 反爬与风控：UA 指纹、限流、人机验证、来源校验、安全响应头
const crypto = require('crypto');

const BLOCK_UA = /(curl|wget|httpie|python-requests|python-urllib|aiohttp|httpx|scrapy|go-http-client|java\/|okhttp|axios|node-fetch|undici|postmanruntime|insomnia|libwww|headlesschrome|phantomjs|selenium|puppeteer|playwright)/i;
const BROWSER_UA = /^Mozilla\/5\.0 /;

// ---- 限流（滑动窗口计数）----
const buckets = new Map();
function hit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset <= now) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return { ok: b.count <= limit, count: b.count, reset: b.reset, remaining: Math.max(0, limit - b.count) };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
}, 60000).unref();

// ---- 人机验证（算术题，一次性，5 分钟）----
const captchas = new Map();
function newCaptcha() {
  const a = 3 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  const op = Math.random() < 0.5 ? '+' : '×';
  const ans = op === '+' ? a + b : a * b;
  const id = crypto.randomBytes(9).toString('hex');
  captchas.set(id, { ans: String(ans), exp: Date.now() + 5 * 60 * 1000 });
  return { id, question: `${a} ${op} ${b} = ?` };
}
function checkCaptcha(id, value) {
  const c = captchas.get(String(id || ''));
  if (!c) return false;
  captchas.delete(String(id));
  if (c.exp < Date.now()) return false;
  return String(value).trim() === c.ans;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of captchas) if (v.exp < now) captchas.delete(k);
}, 60000).unref();

// ---- 请求体解析 ----
function readBody(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { throw new Error('BAD_JSON'); }
}

async function readForm(req) {
  const raw = await readBody(req);
  const out = {};
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
    const v = decodeURIComponent(i < 0 ? '' : pair.slice(i + 1).replace(/\+/g, ' '));
    out[k] = v;
  }
  return out;
}

// ---- 来源校验 ----
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // 老式表单/同源 GET；真正的鉴权仍靠 session
  try {
    const o = new URL(origin);
    return o.host === req.headers.host;
  } catch (e) {
    return false;
  }
}

// ---- 基础反爬判定 ----
function looksHuman(req) {
  const ua = req.headers['user-agent'] || '';
  if (!ua) return { ok: false, reason: 'NO_UA' };
  if (BLOCK_UA.test(ua)) return { ok: false, reason: 'BOT_UA' };
  if (!BROWSER_UA.test(ua)) return { ok: false, reason: 'NOT_BROWSER_UA' };
  const al = req.headers['accept-language'] || '';
  if (!/(zh|en)/i.test(al)) return { ok: false, reason: 'NO_LANG' };
  return { ok: true };
}

// ---- 安全响应头 ----
function securityHeaders(res, opts = {}) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cache-Control', opts.cache || 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  if (opts.html) {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  }
}

module.exports = {
  hit, newCaptcha, checkCaptcha, readBody, readJson, readForm, sameOrigin, looksHuman, securityHeaders,
};