@echo off
chcp 65001 >nul
cd /d "%~dp0"
title jc-football-report 会员服务

if not exist ".env" (
  echo [错误] 未找到 .env
  echo 请先把 .env.example 复制为 .env，并按需填写支付宝参数。
  pause
  exit /b 1
)

echo 正在启动会员服务...
echo 访问地址: http://127.0.0.1:8788
echo 关闭此窗口即停止服务。
echo.
node server.js
echo.
echo 服务已退出（代码 %errorlevel%）。
pause