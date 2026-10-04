<#
.SYNOPSIS
    MeyFu loyihasi ma'lumotlar bazasini zaxiralash (Backup) skripti.
.PARAMETER Format
    Zaxira formati: auto, sql, json, sqlite. Default: auto
.PARAMETER Note
    Zaxira uchun izoh
.EXAMPLE
    .\scripts\backup.ps1
    .\scripts\backup.ps1 -Format json -Note "Relizdan oldingi zaxira"
#>
[CmdletBinding()]
param(
    [ValidateSet('auto', 'sql', 'json', 'sqlite')]
    [string]$Format = 'auto',
    [string]$Note = '',
    [switch]$Safety
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot 'backend'
$VenvPython = Join-Path $BackendDir '.venv\Scripts\python.exe'

if (-not (Test-Path $VenvPython)) {
    throw "Virtual muhit (.venv) topilmadi. Avval scripts\dev-backend.ps1 ni ishga tushiring."
}

Set-Location $BackendDir
if (-not $env:DJANGO_SETTINGS_MODULE) {
    $env:DJANGO_SETTINGS_MODULE = 'config.settings.local'
}
$env:PYTHONUTF8 = '1'

$argsList = @('manage.py', 'backup_db', "--format=$Format")
if ($Note) { $argsList += "--note=$Note" }
if ($Safety) { $argsList += '--safety' }

& $VenvPython $argsList
