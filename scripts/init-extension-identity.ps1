#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nodeScript = Join-Path $PSScriptRoot 'extension-identity.js'

Write-Host 'Brows VPN — init extension identity (GitHub/unpacked channel)' -ForegroundColor Cyan

& node $nodeScript init
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

if (Test-Path (Join-Path $root 'secrets\chrome-extension-github.pem')) {
    $tracked = git -C $root ls-files -- 'secrets/*.pem' '*.pem' 2>$null
    if ($tracked) {
        Write-Error 'Private PEM must not be tracked by git.'
        exit 1
    }
}

Write-Host ''
Write-Host 'Done. Commit manifest.json + EXTENSION_ID.txt only (never the private PEM).' -ForegroundColor Green
