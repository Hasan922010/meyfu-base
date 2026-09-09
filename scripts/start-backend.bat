@echo off
REM MeyFu backend — ikki marta bosib ishga tushirish uchun.
REM Asl logika: scripts\dev-backend.ps1
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-backend.ps1" %*
echo.
echo Server to'xtadi. Yopish uchun biror tugmani bosing.
pause >nul
