# Brows VPN environment check

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Brows VPN Environment Check ===" -ForegroundColor Cyan

function Test-Tool($label, $command, $args) {
    try {
        $output = & $command @args 2>&1 | Select-Object -First 1
        Write-Host "[OK] ${label}: $output" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $label not found" -ForegroundColor Red
    }
}

Test-Tool "go" "go" @("version")
Test-Tool "node" "node" @("--version")

$proxyDir = Join-Path $root "proxy-service"
$exe = Join-Path $proxyDir "browsvpn-proxy.exe"
$xray = Join-Path $proxyDir "xray-core\xray.exe"

if (Test-Path $exe) {
    Write-Host "[OK] browsvpn-proxy.exe" -ForegroundColor Green
} else {
    Write-Host "[MISSING] browsvpn-proxy.exe — run: go build -o browsvpn-proxy.exe ./cmd" -ForegroundColor Yellow
}

if (Test-Path $xray) {
    $ver = & $xray version 2>&1 | Select-Object -First 1
    Write-Host "[OK] xray.exe : $ver" -ForegroundColor Green
} else {
    Write-Host "[MISSING] xray-core/xray.exe — download from GitHub releases" -ForegroundColor Red
}

$manifest = Join-Path $proxyDir "com.browsvpn.host.json"
if (Test-Path $manifest) {
    Write-Host "[OK] com.browsvpn.host.json" -ForegroundColor Green
} else {
    Write-Host "[MISSING] native messaging manifest" -ForegroundColor Red
}

Write-Host "`nDone."
