@echo off
REM MeyFu loyihasini (backend + frontend) BITTA fayl bilan ishga tushirish.
REM Shu faylni ikki marta bosing. To'xtatish: ochilgan oynada Ctrl+C.
REM Asl logika: scripts\start.ps1 (venv, migratsiya, demo ma'lumot, admin parol,
REM ikkala server) - bu fayl shunchaki uni loyiha ildizidan chaqiradi.
setlocal
cd /d "%~dp0"
call scripts\start.bat %*
