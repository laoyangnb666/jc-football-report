# -*- coding: utf-8 -*-
"""付费墙冒烟测试：注册 -> 401/402 -> 开通 -> 读数据 -> 买报告 -> 下载 -> 反爬拦截"""
import re
import sys
import requests

BASE = 'http://127.0.0.1:8788'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

s = requests.Session()
s.headers.update({
    'User-Agent': UA,
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Origin': BASE,
    'Referer': BASE + '/login.html',
    'X-FP': 'testfp0123456789abcdef0123456789',
})


def show(tag, r, extra=''):
    body = r.text[:120].replace('\n', ' ')
    print(f'{tag}: {r.status_code} {extra} {body}')


print('== 1. 未登录读数据 ==')
show('GET /api/data', s.get(BASE + '/api/data'))

print('\n== 2. 反爬：爬虫 UA ==')
bot = requests.get(BASE + '/api/config', headers={'User-Agent': 'python-requests/2.31.0'})
show('bot /api/config', bot)

print('\n== 3. 注册 ==')
cap = s.get(BASE + '/api/captcha').json()
print('captcha:', cap['question'])
m = re.match(r'(\d+)\s*([+×])\s*(\d+)', cap['question'])
a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
ans = a + b if op == '+' else a * b
email = f'test{sys.argv[1] if len(sys.argv) > 1 else "01"}@example.com'
r = s.post(BASE + '/api/register', json={
    'email': email, 'password': 'Passw0rd!2026', 'captchaId': cap['id'], 'captcha': str(ans), 'hp': ''
})
show('POST /api/register', r, f'cookie={bool(s.cookies.get("jcsid"))}')

print('\n== 4. 已登录未订阅 ==')
show('GET /api/data', s.get(BASE + '/api/data'))
show('GET /api/me', s.get(BASE + '/api/me'))

print('\n== 5. 本地联调开通会员 ==')
h = {'X-Dev-Key': 'local-dev-key-2026'}
show('POST /api/dev/grant sub', s.post(BASE + '/api/dev/grant', json={'plan': 'sub'}, headers=h))
r = s.get(BASE + '/api/data')
show('GET /api/data(sub)', r, f'len={len(r.text)}')
if r.ok:
    d = r.json()['data']
    print('  场次', len(d['matches']), '| 传足', d['sfc']['issue'], len(d['sfc']['matches']), '| 方案档', [p['tickets'] for p in d['sfc']['plans']])

print('\n== 6. 报告额度与下载 ==')
show('POST /api/pdf/ticket(无额度)', s.post(BASE + '/api/pdf/ticket'))
s.post(BASE + '/api/dev/grant', json={'plan': 'pdf'}, headers=h)
t = s.post(BASE + '/api/pdf/ticket')
show('POST /api/pdf/ticket', t)
if t.ok:
    url = BASE + t.json()['url']
    dl = s.get(url)
    print(f'GET 下载: {dl.status_code} type={dl.headers.get("content-type")} bytes={len(dl.content)}')
    again = s.get(url)
    print(f'重复使用同一凭证: {again.status_code} (期望 410)')

print('\n== 7. 会话伪造 ==')
fake = requests.get(BASE + '/api/data', headers={'User-Agent': UA, 'Accept-Language': 'zh-CN', 'Cookie': 'jcsid=deadbeef.badsig'})
show('伪造 cookie', fake)

print('\n== 8. 未登录下单 ==')
anon = requests.post(BASE + '/api/order', json={'plan': 'sub'}, headers={'User-Agent': UA, 'Accept-Language': 'zh-CN', 'Origin': BASE})
show('POST /api/order(anon)', anon)