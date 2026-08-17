@echo off
chcp 65001 >nul
title 灵墟论道 - 论坛服务
cd /d "%~dp0server"
"%LOCALAPPDATA%\nodejs\node-v22.11.0-win-x64\node.exe" src/server.js
pause
