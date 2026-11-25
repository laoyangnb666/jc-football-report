'use strict';
// 支付宝开放平台（RSA2）：电脑网站支付 / 当面付预下单 / 主动查单 / 异步通知验签
// 不依赖官方 SDK，用 Node 内置 crypto + https。
const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

const CFG = {
  appId: process.env.ALIPAY_APP_ID || '',
  privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
  publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
  gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
  notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
  returnUrl: process.env.ALIPAY_RETURN_URL || '',
  sellerId: process.env.ALIPAY_SELLER_ID || '',
};

function pemWrap(key, type) {
  const k = String(key || '').trim();
  if (!k) return '';
  if (k.includes('-----BEGIN')) return k.replace(/\\n/g, '\n');
  const body = k.replace(/[\r\n\s]/g, '');
  const lines = body.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`;
}

const PRIVATE_PEM = pemWrap(CFG.privateKey, 'PRIVATE KEY');
const PUBLIC_PEM = pemWrap(CFG.publicKey, 'PUBLIC KEY');

function configured() {
  return !!(CFG.appId && PRIVATE_PEM);
}

function timestamp() {
  const d = new Date(Date.now() + 8 * 3600 * 1000); // 支付宝要求北京时间
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function signContent(params) {
  return Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

function sign(params) {
  const content = signContent(params);
  const s = crypto.createSign('RSA-SHA256');
  s.update(content, 'utf8');
  return s.sign(PRIVATE_PEM, 'base64');
}

function verify(params, signature) {
  if (!PUBLIC_PEM || !signature) return false;
  const content = signContent(params);
  const v = crypto.createVerify('RSA-SHA256');
  v.update(content, 'utf8');
  return v.verify(PUBLIC_PEM, signature, 'base64');
}

function commonParams(method, bizContent, extra = {}) {
  return {
    app_id: CFG.appId,
    method,
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: timestamp(),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
    ...extra,
  };
}

// 电脑网站支付：返回可直接跳转的 URL
function pagePayUrl({ outTradeNo, subject, totalAmount, returnUrl, notifyUrl }) {
  if (!configured()) throw new Error('ALIPAY_NOT_CONFIGURED');
  const p = commonParams('alipay.trade.page.pay', {
    out_trade_no: outTradeNo,
    product_code: 'FAST_INSTANT_TRADE_PAY',
    total_amount: Number(totalAmount).toFixed(2),
    subject,
    timeout_express: '30m',
  }, {
    return_url: returnUrl || CFG.returnUrl,
    notify_url: notifyUrl || CFG.notifyUrl,
  });
  p.sign = sign(p);
  const qs = Object.keys(p).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join('&');
  return `${CFG.gateway}?${qs}`;
}

// 当面付预下单：返回 qr_code（可选路径）
function precreate({ outTradeNo, subject, totalAmount }) {
  return callGateway('alipay.trade.precreate', {
    out_trade_no: outTradeNo,
    total_amount: Number(totalAmount).toFixed(2),
    subject,
    timeout_express: '30m',
  }).then((r) => r.qr_code || null);
}

// 主动查单：本地无公网回调时，用它在支付返回后确认
async function query(outTradeNo) {
  const r = await callGateway('alipay.trade.query', { out_trade_no: outTradeNo });
  return {
    tradeStatus: r.trade_status || '',
    totalAmount: r.total_amount || '',
    tradeNo: r.trade_no || '',
    outTradeNo: r.out_trade_no || '',
    buyerId: r.buyer_user_id || '',
    raw: r,
  };
}

// 从原始响应体里截取 "<method>_response" 的 JSON 子串（验签用原文，避免重新序列化）
function sliceResponseNode(text, key) {
  const marker = `"${key}"`;
  const i = text.indexOf(marker);
  if (i < 0) return null;
  const start = text.indexOf('{', i);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = start; k < text.length; k++) {
    const ch = text[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, k + 1);
    }
  }
  return null;
}

function callGateway(method, bizContent) {
  return new Promise((resolve, reject) => {
    if (!configured()) return reject(new Error('ALIPAY_NOT_CONFIGURED'));
    const p = commonParams(method, bizContent);
    p.sign = sign(p);
    const body = Object.keys(p).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join('&');
    const u = new URL(CFG.gateway);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 20000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json;
        try { json = JSON.parse(text); } catch (e) { return reject(new Error('BAD_GATEWAY_JSON')); }
        const nodeKey = method.replace(/\./g, '_') + '_response';
        const node = json[nodeKey];
        if (!node) return reject(new Error('BAD_GATEWAY_NODE:' + nodeKey));
        // 验签响应（有公钥时强制）
        if (PUBLIC_PEM && json.sign) {
          const raw = sliceResponseNode(text, nodeKey) || JSON.stringify(node);
          const v = crypto.createVerify('RSA-SHA256');
          v.update(raw, 'utf8');
          if (!v.verify(PUBLIC_PEM, json.sign, 'base64')) return reject(new Error('BAD_RESPONSE_SIGN'));
        }
        if (node.code !== '10000') return reject(new Error(`ALIPAY_${node.code}:${node.sub_msg || node.msg || ''}`));
        resolve(node);
      });
    });
    req.on('timeout', () => req.destroy(new Error('GATEWAY_TIMEOUT')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 异步通知验签：params 为已 URL 解码的 form 字段
function verifyNotify(params) {
  const sign = params.sign;
  const copy = { ...params };
  delete copy.sign;
  delete copy.sign_type;
  if (!verify(copy, sign)) return { ok: false, reason: 'BAD_SIGN' };
  if (CFG.appId && params.app_id !== CFG.appId) return { ok: false, reason: 'APP_ID_MISMATCH' };
  if (CFG.sellerId && params.seller_id && params.seller_id !== CFG.sellerId) return { ok: false, reason: 'SELLER_MISMATCH' };
  return { ok: true, status: params.trade_status };
}

module.exports = { configured, pagePayUrl, precreate, query, verifyNotify, CFG };