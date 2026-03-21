@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0metaagent-pc-gui.ps1"
endlocal
