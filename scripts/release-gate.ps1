param(
    [switch]$Live,
    [switch]$SkipArchive,
    [switch]$SkipNpmAudit,
    [string]$ArchiveOutput = ""
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ProxyDir = Join-Path $Root "proxy-service"
$ExtensionDir = Join-Path $Root "extension"

if (-not $ArchiveOutput) {
    $ArchiveOutput = Join-Path $Root "dist\release-gate-clean.zip"
}

$script:StepCount = 0

function Invoke-GateStep {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    $script:StepCount += 1
    Write-Host ""
    Write-Host "[$script:StepCount] $Name" -ForegroundColor Cyan
    & $Command
    Write-Host "OK: $Name" -ForegroundColor Green
}

function Invoke-InLocation {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Push-Location $Path
    try {
        & $Command
    } finally {
        Pop-Location
    }
}

Write-Host "=== Brows VPN Release Gate ===" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Live smoke: $(if ($Live) { 'enabled' } else { 'disabled' })"

Invoke-GateStep "Go tests" {
    Invoke-InLocation $ProxyDir { go test ./... }
}

Invoke-GateStep "Go vet" {
    Invoke-InLocation $ProxyDir { go vet ./... }
}

Invoke-GateStep "Build native host" {
    Invoke-InLocation $ProxyDir { go build -o browsvpn-proxy.exe ./cmd }
}

Invoke-GateStep "Native messaging safe smoke" {
    Invoke-InLocation $Root { go run scripts\test-local-integration.go }
}

if ($Live) {
    Invoke-GateStep "Native messaging live smoke" {
        Invoke-InLocation $Root { go run scripts\test-local-integration.go -live }
    }
}

Invoke-GateStep "Extension syntax" {
    Invoke-InLocation $Root {
        node --check extension\background.js
        node --check extension\options.js
        node --check extension\popup.js
        node --check extension\diagnostics.js
        node --check extension\onboarding.js
        node --check extension\theme.js
        node --check extension\validators.js
        node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json', 'utf8'))"
    }
}

Invoke-GateStep "Extension identity" {
    Invoke-InLocation $Root { node scripts\extension-identity.js verify }
}

Invoke-GateStep "Extension asset validation" {
    Invoke-InLocation $Root { node scripts\validate-extension-assets.js }
}

Invoke-GateStep "PAC routing tests" {
    Invoke-InLocation $Root { node scripts\test-pac-whitelist.js }
}

Invoke-GateStep "Settings import/export tests" {
    Invoke-InLocation $Root { node scripts\test-settings-import-export.js }
}

if (-not $SkipNpmAudit) {
    Invoke-GateStep "Runtime npm audit" {
        Invoke-InLocation $ExtensionDir { npm audit --omit=dev --audit-level=moderate }
    }
}

Invoke-GateStep "Environment release check" {
    Invoke-InLocation $Root {
        powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-env.ps1 -Release
    }
}

if (-not $SkipArchive) {
    Invoke-GateStep "Clean archive verification" {
        Invoke-InLocation $Root {
            powershell -NoProfile -ExecutionPolicy Bypass -File .\make-clean-archive.ps1 -Mode git -OutputPath $ArchiveOutput
        }
    }
}

Write-Host ""
Write-Host "Release gate passed." -ForegroundColor Green
if (-not $SkipArchive) {
    Write-Host "Archive: $ArchiveOutput"
}
