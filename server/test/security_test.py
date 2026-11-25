# -*- coding: utf-8 -*-
"""反爬与越权对抗测试：直连私有文件、路径穿越、伪造会话、限流、指纹不一致"""
import re
import requests

BASE = 'http://127.0.0.1:8788'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
H = {'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', 'Origin': BASE, 'Referer': BASE + '/'}
FP = 'testfp-sec-0123456789abcdef0123'


def login_session():
    s = requests.Session()
    s.headers.update({**H, 'X-FP': FP})
    cap = s.get(BASE + '/api/captcha').json()
    m = re.match(r'(\d+)\s*([+×])\s*(\d+)', cap['question'])
    ans = int(m.group(1)) + int(m.group(3)) if m.group(2) == '+' else int(m.group(1)) * int(m.group(3))
    r = s.post(BASE + '/api/login', json={'email': 'test02@example.com', 'password': 'Passw0rd!2026',
                                          'captchaId': cap['id'], 'captcha': str(ans)})
    assert r.status_code == 200, r.text
    return s


def show(tag, r, expect):
    ok = r.status_code == expect
    print(f"{'PASS' if ok else 'FAIL'} {tag}: {r.status_code} (期望 {expect}) {r.text[:70]}")


s = login_session()
print('登录成功，开始对抗测试\n')

r = requests.get(BASE + '/assets/data.js', headers=H)
show('直连 /assets/data.js', r, 404)

r = requests.get(BASE + '/assets/../private/data.js', headers=H)
show('路径穿越 /assets/../private', r, 400)

r = requests.get(BASE + '/private/data.js', headers=H)
show('直连 /private/data.js', r, 404)

r = requests.get(BASE + '/api/data', headers={'User-Agent': UA})
show('无 Accept-Language', r, 403)

r = requests.get(BASE + '/api/data', headers={'User-Agent': 'curl/8.4.0', 'Accept-Language': 'zh-CN'})
show('curl UA', r, 403)

r = requests.get(BASE + '/api/data', headers={**H, 'Cookie': 'jcsid=abc.def'})
show('伪造签名 cookie', r, 401)

r = s.get(BASE + '/api/data', headers={**H, 'X-FP': 'another-device-fp-xxxx'})
show('换设备指纹', r, 403)

r = s.post(BASE + '/api/register', headers={**H, 'X-FP': FP},
           json={'email': 'bot@example.com', 'password': 'Passw0rd!2026', 'captchaId': 'x', 'captcha': '1', 'hp': 'http://spam'})
show('蜜罐字段', r, 400)

cap = s.get(BASE + '/api/captcha').json()
r = s.post(BASE + '/api/register', headers={**H, 'X-FP': FP},
           json={'email': 'bot2@example.com', 'password': 'Passw0rd!2026', 'captchaId': cap['id'], 'captcha': '999999'})
show('错误验证码', r, 400)

r = requests.post(BASE + '/api/order', headers=H, json={'plan': 'sub'})
show('匿名下单', r, 401)

codes = []
for i in range(40):
    codes.append(s.get(BASE + '/api/data').status_code)
print('限流 40 连击:', {c: codes.count(c) for c in set(codes)}, '| 出现 429:', 429 in codes)
print('  (30/分钟上限，前 30 次 200，其后 429 属预期)' if 429 in codes else '  FAIL 未触发限流')

r = s.get(BASE + '/api/data', headers={**H, 'Accept': 'text/html'})
print('正常读取（限流窗口内）:', r.status_code)