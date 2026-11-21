@echo off
cd /d "%~dp0"
title Cashbook

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install it from https://nodejs.org then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo First run: installing packages, please wait...
  call npm install
  if errorlevel 1 (
    echo Install failed.
    pause
    exit /b 1
  )
)

echo Starting the server...
start "Cashbook Server" cmd /k "npm run dev"

echo Waiting for the site to be ready...
powershell -NoProfile -ExecutionPolicy Bypass -Command "for($i=0;$i -lt 120;$i++){ try { $null = Invoke-WebRequest -Uri 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 500 } }; Start-Process 'http://localhost:3000'"
exit /b 0
