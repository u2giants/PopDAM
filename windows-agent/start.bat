@echo off
echo Starting PopDAM Render Agent...
cd /d "%~dp0"
node dist/index.js
pause
