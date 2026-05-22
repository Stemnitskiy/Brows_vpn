param(
    [string]$ExtensionId,
    [switch]$Build
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'native-manifest.ps1')

$manifestPath = Join-Path $PSScriptRoot 'com.browsvpn.host.json'
$exePath = Join-Path $PSScriptRoot 'browsvpn-proxy.exe'
$xrayPath = Join-Path $PSScriptRoot 'xray-core\xray.exe'
$keyPath = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host'

Write-Host 'Brows VPN - Native Messaging Host Install' -ForegroundColor Cyan
Write-Host ''

if (-not $ExtensionId) {
    $ExtensionId = Read-Host 'Enter Chrome Extension ID (32 characters, a-p)'
}

$ExtensionId = $ExtensionId.Trim().ToLower()
if ($ExtensionId -notmatch '^[a-p]{32}$') {
    Write-Host 'ERROR: Invalid Extension ID. Expected exactly 32 characters [a-p].' -ForegroundColor Red
    Write-Host 'Find it at chrome://extensions (Developer mode → Extension ID).'
    exit 1
}

if ($Build) {
    Write-Host 'Building browsvpn-proxy.exe...'
    Push-Location $PSScriptRoot
    try {
        & go build -o browsvpn-proxy.exe ./cmd
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'ERROR: go build failed.' -ForegroundColor Red
            exit $LASTEXITCODE
        }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $exePath)) {
    Write-Host 'ERROR: browsvpn-proxy.exe not found.' -ForegroundColor Red
    Write-Host 'Run:  .\install.ps1 -ExtensionId YOUR_ID -Build'
    exit 1
}

if (-not (Test-Path $xrayPath)) {
    Write-Host 'ERROR: xray-core\xray.exe not found.' -ForegroundColor Red
    Write-Host 'Download Xray-core and place xray.exe in proxy-service\xray-core\'
    exit 1
}

$resolvedExe = (Resolve-Path $exePath).Path
$origin = "chrome-extension://$ExtensionId/"

$manifest = [ordered]@{
    name             = 'com.browsvpn.host'
    description      = 'Brows VPN Native Messaging Host'
    path             = $resolvedExe
    type             = 'stdio'
    allowed_origins  = @($origin)
}

$json = ($manifest | ConvertTo-Json -Depth 5)
Write-NativeHostManifestText -Path $manifestPath -JsonText $json
Test-NativeHostManifestValid -Path $manifestPath

$written = Read-NativeHostManifest -Path $manifestPath
if ($written.path -ne $resolvedExe) {
    throw "Manifest path mismatch after write: $($written.path)"
}
if (@($written.allowed_origins) -notcontains $origin) {
    throw "Manifest allowed_origins mismatch after write"
}
if (@($written.allowed_origins | Where-Object { $_ -match 'REPLACE' }).Count -gt 0) {
    throw 'Manifest still contains REPLACE placeholder'
}
if (-not (Test-Path $written.path)) {
    throw "Manifest path does not exist: $($written.path)"
}

New-Item -Path $keyPath -Force | Out-Null
Set-ItemProperty -Path $keyPath -Name '(default)' -Value $manifestPath

Write-Host ''
Write-Host 'Install complete.' -ForegroundColor Green
Write-Host "  Extension ID: $ExtensionId"
Write-Host "  Host binary:  $resolvedExe"
Write-Host "  Manifest:     $manifestPath"
Write-Host "  Registry:     $keyPath"
Write-Host ''
Write-Host 'Next: restart Chrome, then enable VPN from the extension popup.'
