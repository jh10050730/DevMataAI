@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo DevMata AI - MySQL 백업
node scripts\backup-db.mjs
echo.
pause
