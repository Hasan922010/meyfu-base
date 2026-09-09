<#
.SYNOPSIS
    MeyFu backendni lokal dev rejimida ishga tushiradi (Dockersiz, sqlite).

.DESCRIPTION
    Bitta buyruq bilan hammasini tayyorlaydi:
      1. .venv yoq bolsa yaratadi va requirements/dev.txt ni ornatadi
      2. migratsiyalarni qollaydi
      3. baza bosh bolsa (foydalanuvchi yoq) seed_demo ni ishga tushiradi
      4. SUPER_ADMIN parolini kafolatlaydi (-AdminPassword)
      5. runserver bilan API ni kotaradi

    config.settings.local => sqlite + xotiradagi kesh/navbat. Postgres/Redis shart emas.

.PARAMETER Port
    API porti. Default: 8000 (frontend Vite proxy shu portga qaraydi).

.PARAMETER Fresh
    seed_demo --fresh: demo foydalanuvchi va malumotlarni qayta yaratadi.

.PARAMETER SkipInstall
    pip install bosqichini otkazib yuboradi (venv tayyor bolsa tezroq).

.PARAMETER AdminPassword
    SUPER_ADMIN (+998900000000) uchun kafolatlanadigan parol.
    Default: Hasanali.0220 (README bilan bir xil).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\dev-backend.ps1

.EXAMPLE
    scripts\dev-backend.ps1 -Fresh -Port 8001
#>
[CmdletBinding()]
param(
    [int]$Port = 8000,
    [switch]$Fresh,
    [switch]$SkipInstall,
    [string]$AdminPassword = 'Hasanali.0220'
)

$ErrorActionPreference = 'Stop'

# --- Yollar --------------------------------------------------------------
$RepoRoot   = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot 'backend'
$VenvPython = Join-Path $BackendDir '.venv\Scripts\python.exe'
$DevReqs    = Join-Path $BackendDir 'requirements\dev.txt'

if (-not (Test-Path $BackendDir)) {
    throw "backend papkasi topilmadi: $BackendDir"
}

Set-Location $BackendDir
$env:DJANGO_SETTINGS_MODULE = 'config.settings.local'
$env:PYTHONUTF8 = '1'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# --- 1. Virtual muhit --------------------------------------------------
if (-not (Test-Path $VenvPython)) {
    Write-Step 'Virtual muhit (.venv) yaratilmoqda...'
    $py = Get-Command py -ErrorAction SilentlyContinue
    if (-not $py) { $py = Get-Command python -ErrorAction SilentlyContinue }
    if (-not $py) { throw 'Python topilmadi. python.org dan Python 3.12+ ornating.' }
    & $py.Source -m venv .venv
    $SkipInstall = $false
}

if (-not $SkipInstall) {
    Write-Step 'Bogliqliklar ornatilmoqda (requirements/dev.txt)...'
    & $VenvPython -m pip install --upgrade pip --quiet
    & $VenvPython -m pip install -r $DevReqs --quiet
}

# --- 2. Migratsiyalar ------------------------------------------------
Write-Step 'Migratsiyalar qollanmoqda...'
& $VenvPython manage.py migrate --noinput

# --- 3. Demo malumot ----------------------------------------------
$userCount = (& $VenvPython manage.py shell -c 'from django.contrib.auth import get_user_model; print(get_user_model().objects.count())' | Select-Object -Last 1)
$userCount = "$userCount".Trim()

if ($Fresh) {
    Write-Step 'seed_demo --fresh (demo malumot qayta yaratilmoqda)...'
    & $VenvPython manage.py seed_demo --fresh
} elseif ($userCount -eq '0') {
    Write-Step 'Baza bosh - seed_demo ishga tushirilmoqda...'
    & $VenvPython manage.py seed_demo
} else {
    Write-Host "    Foydalanuvchilar mavjud ($userCount ta) - seed otkazib yuborildi." -ForegroundColor DarkGray
}

# --- 4. Admin parolini kafolatlash --------------------------------
Write-Step "SUPER_ADMIN paroli tekshirilmoqda ($AdminPassword)..."
$env:MEYFU_ADMIN_PW = $AdminPassword
# Python kodida faqat bitta tirnoq ('') ishlatiladi - PowerShell native arg da " ni yeb qoladi.
$pyOneLiner = 'import os; from django.contrib.auth import get_user_model, authenticate; p=os.environ[''MEYFU_ADMIN_PW'']; U=get_user_model(); u=U.objects.filter(phone=''+998900000000'').first(); print(''YOQ'') if not u else (print(''OK'') if authenticate(username=''+998900000000'', password=p) else (u.set_password(p), setattr(u,''is_active'',True), u.save(), print(''TIKLANDI'')))'
$adminState = (& $VenvPython manage.py shell -c $pyOneLiner | Select-Object -Last 1)
if ($adminState) { $adminState = "$adminState".Trim() } else { $adminState = '?' }
Write-Host "    Admin holati: $adminState" -ForegroundColor DarkGray

# --- 5. Server ----------------------------------------------------
Write-Host ''
Write-Host '  Kirish:  http://localhost:5173  (frontend)' -ForegroundColor Green
Write-Host "  API:     http://localhost:$Port/api/v1/" -ForegroundColor Green
Write-Host "  Admin:   +998900000000  /  $AdminPassword" -ForegroundColor Green
Write-Host '  Boshqa rollar (seed_demo): +99890100/200/300 0000  /  demo12345' -ForegroundColor DarkGray
Write-Host '  Toxtatish: Ctrl+C' -ForegroundColor DarkGray
Write-Host ''

Write-Step "runserver 0.0.0.0:$Port"
& $VenvPython manage.py runserver "0.0.0.0:$Port"
