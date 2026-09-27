@echo off
cd /d "%~dp0"
node settings.mjs
if errorlevel 1 pause
