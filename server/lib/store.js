'use strict';
// JSON 文件存储：users / sessions / orders / tickets / audit
// 单进程小站，写入量小，直接原子落盘（tmp + rename），不做并发锁。
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = { users: [], sessions: {}, orders: [], tickets: [], audit: [] };

let db = null;
let writeTimer = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    db = JSON.parse(JSON.stringify(EMPTY));
    flush();
    return db;
  }
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    // 文件损坏：保留副本后重建，避免服务启动失败
    try { fs.copyFileSync(DB_FILE, DB_FILE + '.broken-' + Date.now()); } catch (_) {}
    db = JSON.parse(JSON.stringify(EMPTY));
  }
  for (const k of Object.keys(EMPTY)) if (!db[k]) db[k] = JSON.parse(JSON.stringify(EMPTY[k]));
  return db;
}

function flush() {
  ensureDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

// 合并短时间内的多次写入
function save() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try { flush(); } catch (e) { console.error('[store] 写入失败', e.message); }
  }, 120);
}

function get() {
  if (!db) load();
  return db;
}

function audit(type, meta) {
  const d = get();
  d.audit.push({ t: Date.now(), type, ...meta });
  if (d.audit.length > 800) d.audit.splice(0, d.audit.length - 800);
  save();
}

module.exports = { get, save, flush, load, audit, DB_FILE, DATA_DIR };