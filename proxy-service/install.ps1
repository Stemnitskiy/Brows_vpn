param(
    [string]$ExtensionId,
    [ValidateSet('github', 'webstore')]
    [string]$Channel = 'github',
    [switch]$Build,
    [switch]$OpenExtensionsPage
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'native-manifest.ps1')

$Root = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $PSScriptRoot 'com.browsvpn.host.json'
$exePath = Join-Path $PSScriptRoot 'browsvpn-proxy.exe'
$xrayPath = Join-Path $PSScriptRoot 'xray-core\xray.exe'
$extensionDir = Join-Path $Root 'extension'
$keyPath = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host'
$identityScript = Join-Path $Root 'scripts\extension-identity.js'

Write-Host 'Brows VPN - Native Messaging Host Install' -ForegroundColor Cyan
Write-Host ''

function Resolve-GitHubExtensionId {
    if (-not (Test-Path $identityScript)) {
        return $null
    }
    $output = & node $identityScript resolve 2>&1
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    return ($output | Out-String).Trim()
}

if ($ExtensionId) {
    $ExtensionId = $ExtensionId.Trim().ToLower()
} elseif ($Channel -eq 'github') {
    $ExtensionId = Resolve-GitHubExtensionId
    if (-not $ExtensionId) {
        Write-Host 'ERROR: Extension ID not found.' -ForegroundColor Red
        Write-Host 'Run scripts/init-extension-identity.ps1 or pass -ExtensionId.' -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Using GitHub/unpacked Extension ID: $ExtensionId"
} else {
    Write-Host 'ERROR: -ExtensionId is required for webstore channel.' -ForegroundColor Red
    exit 1
}

if ($ExtensionId -notmatch '^[a-p]{32}$') {
    Write-Host 'ERROR: Invalid Extension ID. Expected exactly 32 characters [a-p].' -ForegroundColor Red
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
    Write-Host 'Run:  .\install.ps1 -Build'
    exit 1
}

if (-not (Test-Path $xrayPath)) {
    Write-Host 'WARNING: xray-core\xray.exe not found — native host will register, but VPN enable needs Xray.' -ForegroundColor Yellow
    Write-Host 'Download from https://github.com/XTLS/Xray-core/releases'
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
Write-Host 'Next: Load unpacked extension folder, restart Chrome, enable VPN from popup.'

if ($OpenExtensionsPage) {
    $resolvedExtensionDir = (Resolve-Path $extensionDir).Path
    Write-Host ''
    Write-Host 'Load unpacked folder:' -ForegroundColor Cyan
    Write-Host "  $resolvedExtensionDir"
    Write-Host 'Expected Extension ID:' -ForegroundColor Cyan
    Write-Host "  $ExtensionId"
    Start-Process 'chrome://extensions/'
}
