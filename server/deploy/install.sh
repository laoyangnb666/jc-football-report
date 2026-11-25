#!/usr/bin/env bash
# jc-football-report 付费墙服务 —— 服务器端安装脚本
# 用法: sudo bash install.sh
set -euo pipefail

APP_DIR=/opt/jc-paywall
SERVICE=jc-paywall
PORT=8788

echo "==> 检查 Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "    未安装 Node，使用 NodeSource 安装 20.x"
  curl -fsSL https://rpm.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh 2>/dev/null \
    || curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh
  bash /tmp/nodesource_setup.sh
  (command -v dnf >/dev/null && dnf install -y nodejs) || (command -v yum >/dev/null && yum install -y nodejs) || apt-get install -y nodejs
fi
node -v

echo "==> 检查 Python（PDF 水印用，可选）"
if ! command -v python3 >/dev/null 2>&1; then
  (command -v dnf >/dev/null && dnf install -y python3) || (command -v yum >/dev/null && yum install -y python3) || apt-get install -y python3 || true
fi
if command -v python3 >/dev/null 2>&1; then
  python3 -m pip install --quiet pymupdf 2>/dev/null || pip3 install --quiet pymupdf 2>/dev/null || echo "    pymupdf 安装失败：下载将回退为无水印原件"
else
  echo "    python3 不可用：下载将回退为无水印原件"
fi

echo "==> 部署文件"
mkdir -p "$APP_DIR"
if [ -f /tmp/jc-paywall.tar.gz ]; then
  tar -xzf /tmp/jc-paywall.tar.gz -C "$APP_DIR" --strip-components=1
fi
cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s#^PORT=.*#PORT=${PORT}#" .env
  sed -i "s#^HOST=.*#HOST=0.0.0.0#" .env
  sed -i "s#^BASE_URL=.*#BASE_URL=http://8.137.21.61#" .env
  sed -i "s#^ALIPAY_RETURN_URL=.*#ALIPAY_RETURN_URL=http://8.137.21.61/pay/return#" .env
  echo "    已生成 .env（支付宝参数仍为空，需要手工填写）"
fi

echo "==> systemd 服务"
cat > /etc/systemd/system/${SERVICE}.service <<UNIT
[Unit]
Description=jc-football-report paywall
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable ${SERVICE} >/dev/null
systemctl restart ${SERVICE}
sleep 2
systemctl is-active ${SERVICE}

echo "==> 本机自检"
curl -s -o /dev/null -w "http://127.0.0.1:${PORT} -> %{http_code}\n" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0" \
  -H "Accept-Language: zh-CN" "http://127.0.0.1:${PORT}/"

echo "==> 防火墙"
if command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port=${PORT}/tcp >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-service=http >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
fi

echo
echo "完成。记得在云厂商安全组放行 80（或 ${PORT}）。"
echo "日志: journalctl -u ${SERVICE} -f"