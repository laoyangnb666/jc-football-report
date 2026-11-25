'use strict';
// 账号与会话：scrypt 口令哈希、HMAC 签名的 session cookie
const crypto = require('crypto');
const store = require('./store');

const COOKIE = 'jcsid';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 天

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${key.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [, salt, hex] = String(stored).split('$');
    const key = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
    const a = Buffer.from(hex, 'hex');
    const b = Buffer.from(key.toString('hex'), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

function signSid(sid) {
  const secret = process.env.SESSION_SECRET || 'dev-secret-change-me';
  return b64url(crypto.createHmac('sha256', secret).update(sid).digest());
}

function createSession(uid, fp, ip) {
  const db = store.get();
  const sid = crypto.randomBytes(32).toString('hex');
  db.sessions[sid] = { uid, fp: fp || null, ip: ip || null, exp: Date.now() + SESSION_TTL };
  store.save();
  return `${sid}.${signSid(sid)}`;
}

function readSid(cookieHeader) {
  if (!cookieHeader) return null;
  const m = cookieHeader.split(/;\s*/).find((x) => x.startsWith(COOKIE + '='));
  if (!m) return null;
  const raw = decodeURIComponent(m.slice(COOKIE.length + 1));
  const [sid, sig] = raw.split('.');
  if (!sid || !sig) return null;
  const expect = signSid(sid);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return sid;
}

function getSession(req) {
  const sid = readSid(req.headers.cookie);
  if (!sid) return null;
  const db = store.get();
  const s = db.sessions[sid];
  if (!s) return null;
  if (s.exp < Date.now()) {
    delete db.sessions[sid];
    store.save();
    return null;
  }
  const user = db.users.find((u) => u.id === s.uid);
  if (!user || user.banned) return null;
  return { sid, ...s, user };
}

function destroySession(req) {
  const sid = readSid(req.headers.cookie);
  if (!sid) return;
  const db = store.get();
  delete db.sessions[sid];
  store.save();
}

function cookieHeader(value, maxAgeSec) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (process.env.COOKIE_SECURE === '1') parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function subActive(user) {
  return !!(user && user.subUntil && user.subUntil > Date.now());
}

module.exports = {
  COOKIE, hashPassword, verifyPassword, createSession, getSession, destroySession,
  cookieHeader, clearCookieHeader, subActive, SESSION_TTL,
};