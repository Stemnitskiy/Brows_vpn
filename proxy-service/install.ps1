param(
    [string]$ExtensionId,
    [ValidateSet('github', 'webstore')]
    [string]$Channel = 'github',
    [switch]$Build,
    [switch]$RequireXrayHash,
    [switch]$Release,
    [switch]$OpenExtensionsPage
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'native-manifest.ps1')

$Root = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $PSScriptRoot 'com.browsvpn.host.local.json'
$exePath = Join-Path $PSScriptRoot 'browsvpn-proxy.exe'
$xrayPath = Join-Path $PSScriptRoot 'xray-core\xray.exe'
$extensionDir = Join-Path $Root 'extension'
$keyPath = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host'
$identityScript = Join-Path $Root 'scripts\extension-identity.js'

Write-Host 'Brows VPN - Native Messaging Host Install' -ForegroundColor Cyan
Write-Host ''

function Test-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$Name)

    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Resolve-GitHubExtensionId {
    if (-not (Test-Path $identityScript)) {
        return $null
    }
    if (-not (Test-CommandAvailable 'node')) {
        return $null
    }
    $output = & node $identityScript resolve 2>&1
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    return ($output | Out-String).Trim()
}

function Test-XrayIntegritySidecar {
    param(
        [Parameter(Mandatory = $true)][string]$XrayPath,
        [switch]$Required
    )

    $hashPath = "$XrayPath.sha256"
    if (-not (Test-Path $hashPath)) {
        if ($Required) {
            throw "Missing Xray SHA256 sidecar: $hashPath"
        }
        Write-Host 'WARNING: xray.exe.sha256 not found - integrity check is skipped for dev install.' -ForegroundColor Yellow
        return
    }

    $expectedLine = (Get-Content -LiteralPath $hashPath -Raw).Trim()
    if ($expectedLine -match '\s') {
        $expectedLine = ($expectedLine -split '\s+')[0]
    }
    $expected = $expectedLine.ToLowerInvariant()
    if ($expected -notmatch '^[0-9a-f]{64}$') {
        throw "Invalid SHA256 value in $hashPath"
    }

    $actual = (Get-FileHash -LiteralPath $XrayPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "xray.exe SHA256 mismatch. Expected $expected, got $actual"
    }

    Write-Host 'Xray integrity: SHA256 OK' -ForegroundColor Green
}

if ($Release) {
    $RequireXrayHash = $true
}

if ($ExtensionId) {
    $ExtensionId = $ExtensionId.Trim().ToLower()
} elseif ($Channel -eq 'github') {
    if (-not (Test-CommandAvailable 'node')) {
        Write-Host 'ERROR: Node.js is required to resolve Extension ID from manifest.key.' -ForegroundColor Red
        Write-Host 'Install Node.js or pass -ExtensionId explicitly.' -ForegroundColor Yellow
        exit 1
    }
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
    if (-not (Test-CommandAvailable 'go')) {
        Write-Host 'ERROR: Go is required for -Build.' -ForegroundColor Red
        Write-Host 'Install Go or place browsvpn-proxy.exe next to install.ps1.' -ForegroundColor Yellow
        exit 1
    }
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
} else {
    Test-XrayIntegritySidecar -XrayPath $xrayPath -Required:$RequireXrayHash
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
Write-Host 'Next steps:' -ForegroundColor Cyan
Write-Host '  1. Load unpacked extension folder in chrome://extensions/.'
Write-Host '  2. Restart Chrome after native host registration.'
Write-Host '  3. Open extension settings/onboarding, run preflight, save VLESS profile.'
Write-Host '  4. Enable VPN from popup.'

if ($OpenExtensionsPage) {
    if (-not (Test-Path $extensionDir)) {
        Write-Host ''
        Write-Host "WARNING: extension folder not found: $extensionDir" -ForegroundColor Yellow
        exit 0
    }
    $resolvedExtensionDir = (Resolve-Path $extensionDir).Path
    Write-Host ''
    Write-Host 'Load unpacked folder:' -ForegroundColor Cyan
    Write-Host "  $resolvedExtensionDir"
    Write-Host 'Expected Extension ID:' -ForegroundColor Cyan
    Write-Host "  $ExtensionId"
    Start-Process 'chrome://extensions/'
}
