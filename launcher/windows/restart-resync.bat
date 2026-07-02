@echo off
cd /d "%~dp0..\..\launcher"
npx tsx src/index.ts restart
pause
