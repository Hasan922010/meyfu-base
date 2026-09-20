@echo off
REM MeyFu — butun loyihani (backend + frontend) ikki marta bosib ishga tushirish uchun.
REM Asl logika: scripts\start.ps1
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
echo.
echo Server(lar) to'xtadi. Yopish uchun biror tugmani bosing.
pause >nul
