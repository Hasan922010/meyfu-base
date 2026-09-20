<#
.SYNOPSIS
    MeyFu loyihasini (backend + frontend) BITTA buyruq bilan ishga tushiradi.

.DESCRIPTION
    dev-backend.ps1 dagi backend tayyorlash bosqichlarini (venv, migratsiya, seed,
    admin parol) o'z ichiga oladi, so'ng:
      1. Backend runserver'ni ALOHIDA konsol oynasida ko'taradi
      2. Frontend'ning bog'liqliklarini (agar kerak bo'lsa) o'rnatadi
      3. Frontend dev serverni (Vite) shu oynada oldinga chiqarib ishga tushiradi

    Shu oynada Ctrl+C bosilsa — frontend to'xtaydi va backend oynasi ham avtomatik yopiladi.

.PARAMETER Port
    Backend API porti. Default: 8000.

.PARAMETER FrontendPort
    Frontend (Vite) porti. Default: 5173.

.PARAMETER Fresh
    seed_demo --fresh: demo foydalanuvchi va ma'lumotlarni qayta yaratadi.

.PARAMETER SkipInstall
    Backend uchun pip install bosqichini o'tkazib yuboradi (.venv tayyor bo'lsa tezroq).

.PARAMETER SkipFrontendInstall
    Frontend uchun npm install bosqichini o'tkazib yuboradi (node_modules tayyor bo'lsa tezroq).

.PARAMETER AdminPassword
    SUPER_ADMIN (+998900000000) uchun kafolatlanadigan parol. Default: Hasanali.0220.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\start.ps1

.EXAMPLE
    scripts\start.ps1 -Fresh -Port 8001 -FrontendPort 5174
#>
[CmdletBinding()]
param(
    [int]$Port = 8000,
    [int]$FrontendPort = 5173,
    [switch]$Fresh,
    [switch]$SkipInstall,
    [switch]$SkipFrontendInstall,
    [string]$AdminPassword = 'Hasanali.0220'
)

$ErrorActionPreference = 'Stop'

# --- Yollar --------------------------------------------------------------
$RepoRoot    = Split-Path -Parent $PSScriptRoot
$BackendDir  = Join-Path $RepoRoot 'backend'
$FrontendDir = Join-Path $RepoRoot 'frontend'
$VenvPython  = Join-Path $BackendDir '.venv\Scripts\python.exe'
$DevReqs     = Join-Path $BackendDir 'requirements\dev.txt'

if (-not (Test-Path $BackendDir))  { throw "backend papkasi topilmadi: $BackendDir" }
if (-not (Test-Path $FrontendDir)) { throw "frontend papkasi topilmadi: $FrontendDir" }

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# ==========================================================================
# 1. BACKEND — venv, bog'liqliklar, migratsiya, demo ma'lumot, admin parol
# ==========================================================================
Set-Location $BackendDir
$env:DJANGO_SETTINGS_MODULE = 'config.settings.local'
$env:PYTHONUTF8 = '1'

if (-not (Test-Path $VenvPython)) {
    Write-Step 'Backend: virtual muhit (.venv) yaratilmoqda...'
    $py = Get-Command py -ErrorAction SilentlyContinue
    if (-not $py) { $py = Get-Command python -ErrorAction SilentlyContinue }
    if (-not $py) { throw 'Python topilmadi. python.org dan Python 3.12+ ornating.' }
    & $py.Source -m venv .venv
    $SkipInstall = $false
}

if (-not $SkipInstall) {
    Write-Step 'Backend: bog''liqliklar o''rnatilmoqda (requirements/dev.txt)...'
    & $VenvPython -m pip install --upgrade pip --quiet
    & $VenvPython -m pip install -r $DevReqs --quiet
}

Write-Step 'Backend: migratsiyalar qo''llanmoqda...'
& $VenvPython manage.py migrate --noinput

$userCount = (& $VenvPython manage.py shell -c 'from django.contrib.auth import get_user_model; print(get_user_model().objects.count())' | Select-Object -Last 1)
$userCount = "$userCount".Trim()

if ($Fresh) {
    Write-Step 'Backend: seed_demo --fresh (demo ma''lumot qayta yaratilmoqda)...'
    & $VenvPython manage.py seed_demo --fresh
} elseif ($userCount -eq '0') {
    Write-Step 'Backend: baza bo''sh - seed_demo ishga tushirilmoqda...'
    & $VenvPython manage.py seed_demo
} else {
    Write-Host "    Backend: foydalanuvchilar mavjud ($userCount ta) - seed o'tkazib yuborildi." -ForegroundColor DarkGray
}

Write-Step "Backend: SUPER_ADMIN paroli tekshirilmoqda..."
$env:MEYFU_ADMIN_PW = $AdminPassword
# Python kodida faqat bitta tirnoq ('') ishlatiladi - PowerShell native arg da " ni yeb qoladi.
$pyOneLiner = 'import os; from django.contrib.auth import get_user_model, authenticate; p=os.environ[''MEYFU_ADMIN_PW'']; U=get_user_model(); u=U.objects.filter(phone=''+998900000000'').first(); print(''YOQ'') if not u else (print(''OK'') if authenticate(username=''+998900000000'', password=p) else (u.set_password(p), setattr(u,''is_active'',True), u.save(), print(''TIKLANDI'')))'
$adminState = (& $VenvPython manage.py shell -c $pyOneLiner | Select-Object -Last 1)
if ($adminState) { $adminState = "$adminState".Trim() } else { $adminState = '?' }
Write-Host "    Admin holati: $adminState" -ForegroundColor DarkGray

# ==========================================================================
# 2. FRONTEND — .env, npm install
# ==========================================================================
Set-Location $FrontendDir

if (-not (Test-Path '.env') -and (Test-Path '.env.example')) {
    Write-Step 'Frontend: .env yaratilmoqda (.env.example dan)...'
    Copy-Item '.env.example' '.env'
}

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) { throw 'npm topilmadi. Node.js 18+ ornating (nodejs.org).' }

if (-not $SkipFrontendInstall -and -not (Test-Path (Join-Path $FrontendDir 'node_modules'))) {
    Write-Step 'Frontend: bog''liqliklar o''rnatilmoqda (npm install)...'
    & npm install
}

# ==========================================================================
# 3. Ikkala serverni ishga tushirish
#    Backend - alohida konsol oynasida (fon jarayoni)
#    Frontend - shu oynada, oldinga chiqarilgan (Ctrl+C bilan boshqariladi)
# ==========================================================================
Write-Host ''
Write-Host '  === MeyFu ishga tushmoqda ===' -ForegroundColor Yellow
Write-Host "  Backend API:  http://localhost:$Port/api/v1/" -ForegroundColor Green
Write-Host "  Swagger:      http://localhost:$Port/api/docs/" -ForegroundColor Green
Write-Host "  Frontend:     http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "  Admin:        +998900000000 / $AdminPassword" -ForegroundColor Green
Write-Host '  Boshqa rollar (seed_demo): +99890100/200/300 0000 / demo12345' -ForegroundColor DarkGray
Write-Host '  To''xtatish:   shu oynada Ctrl+C (ikkalasi ham to''xtaydi)' -ForegroundColor DarkGray
Write-Host ''

$backendProc = Start-Process -FilePath $VenvPython `
    -ArgumentList @('manage.py', 'runserver', "0.0.0.0:$Port") `
    -WorkingDirectory $BackendDir `
    -WindowStyle Normal `
    -PassThru

try {
    Set-Location $FrontendDir
    Write-Step "Frontend: npm run dev (port $FrontendPort)"
    & npm run dev -- --port $FrontendPort --strictPort
}
finally {
    if ($backendProc -and -not $backendProc.HasExited) {
        Write-Host ''
        Write-Step 'Backend server to''xtatilmoqda...'
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
}
