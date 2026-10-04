<#
.SYNOPSIS
    MeyFu loyihasi ma'lumotlar bazasini zaxiradan tiklash (Restore) skripti.
.PARAMETER Filename
    Tiklanadigan zaxira fayli nomi. Agar berilmasa, eng oxirgi zaxiradan tiklanadi (-Latest).
.PARAMETER Latest
    Eng oxirgi mavjud zaxiradan tiklash.
.PARAMETER NoInput
    Tasdiq so'ramasdan darhol bajarish.
.EXAMPLE
    .\scripts\restore.ps1 -Latest
    .\scripts\restore.ps1 db_20261004_120000.json.gz
#>
[CmdletBinding()]
param(
    [string]$Filename,
    [switch]$Latest,
    [switch]$NoInput,
    [switch]$NoSafety
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot 'backend'
$VenvPython = Join-Path $BackendDir '.venv\Scripts\python.exe'

if (-not (Test-Path $VenvPython)) {
    throw "Virtual muhit (.venv) topilmadi."
}

Set-Location $BackendDir
if (-not $env:DJANGO_SETTINGS_MODULE) {
    $env:DJANGO_SETTINGS_MODULE = 'config.settings.local'
}
$env:PYTHONUTF8 = '1'

$argsList = @('manage.py', 'restore_db')
if ($Filename) {
    $argsList += $Filename
} elseif ($Latest -or -not $Filename) {
    $argsList += '--latest'
}
if ($NoInput) { $argsList += '--noinput' }
if ($NoSafety) { $argsList += '--no-safety' }

& $VenvPython $argsList
