#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nodeScript = Join-Path $PSScriptRoot 'extension-identity.js'

& node $nodeScript verify
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$trackedPem = git -C $root ls-files -- '*.pem' 'secrets/*.pem' 2>$null
if ($trackedPem) {
    Write-Error "Tracked PEM files are not allowed:`n$trackedPem"
    exit 1
}

Write-Host 'Extension identity verification passed.' -ForegroundColor Green
