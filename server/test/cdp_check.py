# -*- coding: utf-8 -*-
"""用 Chrome DevTools Protocol 验证付费数据页：登录态 -> /app.html -> 断言表格行数"""
import json
import os
import subprocess
import time
import urllib.request

import websocket

CHROME = r"C:\Users\48978\AppData\Local\Google\Chrome\Application\chrome.exe"
PROFILE = r"D:\足球数据\tmp\cdpprof"
PORT = 9223
BASE = "http://127.0.0.1:8788"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
    os.environ.pop(k, None)

proc = subprocess.Popen([
    CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    f"--remote-debugging-port={PORT}", f"--user-data-dir={PROFILE}", f"--user-agent={UA}", "about:blank",
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

for _ in range(40):
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=1)
        break
    except Exception:
        time.sleep(0.4)

req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?{BASE}/login.html", method="PUT")
page = json.loads(urllib.request.urlopen(req, timeout=5).read())
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=20)
mid = [0]


def cmd(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({"id": mid[0], "method": method, "params": params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == mid[0]:
            return msg


def ev(expr, await_promise=True):
    r = cmd("Runtime.evaluate", {"expression": expr, "awaitPromise": await_promise, "returnByValue": True})
    return r.get("result", {}).get("result", {}).get("value")


cmd("Page.enable")
cmd("Runtime.enable")
time.sleep(1.5)

login_expr = """(async () => {
  const fp = await JC.fingerprint();
  const cap = await JC.api('/api/captcha');
  const m = cap.data.question.match(/(\\d+)\\s*([+×])\\s*(\\d+)/);
  const ans = m[2] === '+' ? (+m[1] + +m[3]) : (+m[1] * +m[3]);
  const r = await JC.api('/api/login', { method: 'POST', body: {
    email: 'test02@example.com', password: 'Passw0rd!2026', captchaId: cap.data.id, captcha: String(ans) } });
  return { fp: fp.slice(0, 8), login: r.status, err: r.data.error || null };
})()"""
print("登录:", ev(login_expr))

cmd("Page.navigate", {"url": BASE + "/app.html"})
time.sleep(3.5)

check = """(() => {
  const rows = document.querySelectorAll('#jcTable tbody tr').length;
  const sfc = document.querySelectorAll('#sfcTable tbody tr').length;
  const plans = document.querySelectorAll('#planTable tbody tr').length;
  const locked = document.getElementById('locked');
  return {
    jcRows: rows, sfcRows: sfc, planRows: plans,
    lockedHidden: !!locked && locked.hidden,
    contentHidden: document.getElementById('content').hidden,
    who: document.getElementById('whoEmail').textContent.trim(),
    sub: document.getElementById('whoSub').textContent.trim(),
    snap: document.getElementById('snap').textContent.trim(),
    first: (document.querySelector('#jcTable tbody tr') || {}).innerText,
    note: document.getElementById('sfcNote').textContent.slice(0, 60),
  };
})()"""
res = ev(check)
print("数据页:", json.dumps(res, ensure_ascii=False, indent=1))

shot = cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
if shot.get("result", {}).get("data"):
    import base64
    open(r"D:\足球数据\tmp\app_page.png", "wb").write(base64.b64decode(shot["result"]["data"]))
    print("截图: D:\\足球数据\\tmp\\app_page.png")

ws.close()
proc.terminate()
try:
    proc.wait(timeout=5)
except Exception:
    proc.kill()