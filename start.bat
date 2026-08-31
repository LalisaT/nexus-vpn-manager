@echo off
title NexusVPN All-in-One Multi-Protocol VPN Manager
cls
echo ========================================================
echo   🛡️  Starting NexusVPN All-in-One Bypass Manager...
echo ========================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

if not exist node_modules (
    echo [INFO] Installing required dependencies...
    call npm.cmd install
)

echo [INFO] Starting NexusVPN Core Engine at http://localhost:3030...
start http://localhost:3030
node server/server.js
pause
