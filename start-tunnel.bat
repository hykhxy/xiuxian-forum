@echo off
chcp 65001 >nul
title 灵墟论道 - Cloudflare Tunnel
:loop
"%LOCALAPPDATA%\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000 --protocol http2 --no-autoupdate
echo 隧道断开，10 秒后自动重连...
timeout /t 10 /nobreak >nul
goto loop
