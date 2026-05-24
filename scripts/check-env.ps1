param(
    [switch]$Release,
    [switch]$Ci,
    [switch]$Fix,
    [switch]$OpenExtensionsPage
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ProxyDir = Join-Path $Root "proxy-service"
$ExtensionDir = Join-Path $Root "extension"
$ManifestPath = Join-Path $ProxyDir "com.browsvpn.host.local.json"
$TemplateManifestPath = Join-Path $ProxyDir "com.browsvpn.host.json"
$ProxyExePath = Join-Path $ProxyDir "browsvpn-proxy.exe"
$XrayPath = Join-Path $ProxyDir "xray-core\xray.exe"
$IdentityScript = Join-Path $Root "scripts\extension-identity.js"
$RegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host"
$DefaultSocksPort = 10808

$script:FailCount = 0
$script:WarnCount = 0

function Write-Check {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("OK", "WARN", "FAIL")]
        [string]$Status,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if ($Status -eq "FAIL") {
        $script:FailCount += 1
    }
    if ($Status -eq "WARN") {
        $script:WarnCount += 1
    }

    $color = "Green"
    if ($Status -eq "WARN") {
        $color = "Yellow"
    }
    if ($Status -eq "FAIL") {
        $color = "Red"
    }
    Write-Host "[$Status] $Message" -ForegroundColor $color
}

function Test-Tool {
    param(
        [string]$Label,
        [string]$Command,
        [string[]]$ToolArgs
    )

    try {
        $output = & $Command @ToolArgs 2>&1 | Select-Object -First 1
        Write-Check OK "${Label}: $output"
        return $true
    } catch {
        Write-Check FAIL "$Label not found"
        return $false
    }
}

function Test-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-LocalManifestHealthy {
    if (-not (Test-Path $ManifestPath)) {
        return $false
    }
    try {
        $data = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        $origins = @($data.allowed_origins)
        return $data.path -and (Test-Path $data.path) -and
            $origins.Count -gt 0 -and
            @($origins | Where-Object { $_ -match "^chrome-extension://[a-p]{32}/$" }).Count -eq $origins.Count
    } catch {
        return $false
    }
}

function Test-NativeRegistryHealthy {
    if (-not (Test-Path $RegistryPath)) {
        return $false
    }
    $regValue = (Get-ItemProperty -Path $RegistryPath -Name "(default)" -ErrorAction SilentlyContinue)."(default)"
    return $regValue -and (Test-Path $regValue)
}

function Invoke-SafeFixes {
    Write-Host "=== Brows VPN Environment Fix ===" -ForegroundColor Cyan

    if ((Test-Path $XrayPath) -and -not (Test-Path ($XrayPath + ".sha256"))) {
        $hash = (Get-FileHash -LiteralPath $XrayPath -Algorithm SHA256).Hash.ToLowerInvariant()
        Set-Content -LiteralPath ($XrayPath + ".sha256") -Value $hash -Encoding ASCII
        Write-Host "[FIX] Generated xray.exe.sha256" -ForegroundColor Green
    }

    $needsInstall = (-not (Test-Path $ProxyExePath)) -or
        (-not (Test-LocalManifestHealthy)) -or
        (-not (Test-NativeRegistryHealthy))

    if ($needsInstall) {
        if (-not (Test-CommandAvailable "go")) {
            Write-Host "[SKIP] Cannot rebuild/register native host: Go not found" -ForegroundColor Yellow
        } else {
            $args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $ProxyDir "install.ps1"), "-Build")
            if ($OpenExtensionsPage) {
                $args += "-OpenExtensionsPage"
            }
            Write-Host "[FIX] Running install.ps1 -Build" -ForegroundColor Green
            & powershell @args
            if ($LASTEXITCODE -ne 0) {
                throw "install.ps1 -Build failed with exit code $LASTEXITCODE"
            }
        }
    } else {
        Write-Host "[OK] Native host exe, manifest, and registry already look healthy" -ForegroundColor Green
    }

    Write-Host ""
}

function Test-ProxyExe {
    if (Test-Path $ProxyExePath) {
        Write-Check OK "browsvpn-proxy.exe exists"
        return
    }
    Write-Check WARN "browsvpn-proxy.exe missing; run: cd proxy-service; .\install.ps1 -Build"
}

function Test-Xray {
    if (-not (Test-Path $XrayPath)) {
        if ($Release) {
            Write-Check FAIL "xray-core\xray.exe missing; download Xray-core release"
        } else {
            Write-Check WARN "xray-core\xray.exe missing; download Xray-core release before local install"
        }
        return
    }

    $version = & $XrayPath version 2>&1 | Select-Object -First 1
    Write-Check OK "xray.exe: $version"

    $hashPath = $XrayPath + ".sha256"
    if (-not (Test-Path $hashPath)) {
        if ($Release) {
            Write-Check FAIL "xray.exe.sha256 missing"
        } else {
            Write-Check WARN "xray.exe.sha256 missing; dev mode allows this"
        }
        return
    }

    $expectedLine = (Get-Content -LiteralPath $hashPath -Raw).Trim()
    if ($expectedLine -match "\s") {
        $expectedLine = ($expectedLine -split "\s+")[0]
    }
    $expected = $expectedLine.ToLowerInvariant()
    if ($expected -notmatch "^[0-9a-f]{64}$") {
        Write-Check FAIL "invalid SHA256 in xray.exe.sha256"
        return
    }

    $actual = (Get-FileHash -LiteralPath $XrayPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -eq $expected) {
        Write-Check OK "xray.exe SHA256 matches sidecar"
    } else {
        Write-Check FAIL "xray.exe SHA256 mismatch"
    }
}

function Test-NativeManifest {
    if (Test-Path $TemplateManifestPath) {
        Write-Check OK "native manifest template exists: com.browsvpn.host.json"
    } else {
        Write-Check FAIL "native manifest template missing"
    }

    if (-not (Test-Path $ManifestPath)) {
        Write-Check WARN "local native manifest missing; run: cd proxy-service; .\install.ps1 -Build"
        return
    }

    try {
        $data = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        if ($data.path -and (Test-Path $data.path)) {
            Write-Check OK "native manifest path exists: $($data.path)"
        } else {
            Write-Check FAIL "native manifest path is invalid: $($data.path)"
        }

        $origins = @($data.allowed_origins)
        $validOrigins = @($origins | Where-Object { $_ -match "^chrome-extension://[a-p]{32}/$" })
        if ($origins.Count -gt 0 -and $validOrigins.Count -eq $origins.Count) {
            Write-Check OK "native manifest allowed_origins configured"
        } else {
            Write-Check FAIL "native manifest allowed_origins invalid"
        }
    } catch {
        Write-Check FAIL "native manifest JSON invalid: $($_.Exception.Message)"
    }
}

function Test-NativeRegistry {
    if (-not (Test-Path $RegistryPath)) {
        Write-Check WARN "Chrome registry native host not registered"
        return
    }

    $regValue = (Get-ItemProperty -Path $RegistryPath -Name "(default)" -ErrorAction SilentlyContinue)."(default)"
    if ($regValue -and (Test-Path $regValue)) {
        Write-Check OK "Chrome registry native host points to: $regValue"
    } else {
        Write-Check FAIL "Chrome registry native host path invalid"
    }
}

function Test-PortAvailability {
    param([int]$Port)

    if ($Port -lt 1 -or $Port -gt 65535) {
        Write-Check FAIL "SOCKS port is out of range: $Port"
        return
    }
    if ($Port -ge 1068 -and $Port -le 1167) {
        Write-Check FAIL "SOCKS port $Port is in Windows excluded range 1068-1167"
        return
    }

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        if ($connect.AsyncWaitHandle.WaitOne(300, $false)) {
            try {
                $client.EndConnect($connect)
                Write-Check OK "SOCKS port $Port is already listening on 127.0.0.1"
                return
            } catch {
                # Fall through to bind check.
            }
        }
    } finally {
        $client.Close()
    }

    $listener = $null
    try {
        $ip = [System.Net.IPAddress]::Parse("127.0.0.1")
        $listener = New-Object System.Net.Sockets.TcpListener($ip, $Port)
        $listener.Start()
        Write-Check OK "SOCKS port $Port is available on 127.0.0.1"
    } catch {
        Write-Check FAIL "SOCKS port $Port is not bindable: $($_.Exception.Message)"
    } finally {
        if ($listener -ne $null) {
            $listener.Stop()
        }
    }
}

function Test-ExtensionIdentity {
    param([bool]$NodeAvailable)

    if (-not $NodeAvailable) {
        return
    }
    if (-not (Test-Path $IdentityScript)) {
        Write-Check FAIL "extension identity script missing"
        return
    }

    $id = & node $IdentityScript resolve 2>$null
    if ($LASTEXITCODE -eq 0 -and $id -match "^[a-p]{32}$") {
        Write-Check OK "extension ID: $id"
    } else {
        Write-Check FAIL "extension ID cannot be resolved"
    }
}

function Test-GitIgnores {
    foreach ($path in @(
        "secrets\chrome-extension-github.pem",
        "proxy-service\com.browsvpn.host.local.json",
        "proxy-service\xray-core\xray-config.json",
        "proxy-service\xray-core\access.log",
        "proxy-service\xray-core\error.log",
        "proxy-service\xray-core\xray",
        "proxy-service\xray-core\xray.exe",
        "proxy-service\browsvpn-proxy.exe"
    )) {
        $full = Join-Path $Root $path
        if (-not (Test-Path $full)) {
            continue
        }
        & git -C $Root check-ignore -q -- $path
        if ($LASTEXITCODE -eq 0) {
            Write-Check OK "git ignores $path"
        } else {
            Write-Check FAIL "git does not ignore $path"
        }
    }
}

function Test-TrackedSecrets {
    $patterns = @(
        "ghp_[A-Za-z0-9_]{20,}",
        "github_pat_[A-Za-z0-9_]{20,}",
        "sk-[A-Za-z0-9]{20,}",
        "BEGIN (RSA |OPENSSH |)PRIVATE KEY",
        "vless://[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}@"
    )

    $trackedPem = & git -C $Root ls-files "*.pem" "secrets/*.pem"
    if ($trackedPem) {
        Write-Check FAIL "tracked PEM files found: $($trackedPem -join ', ')"
    } else {
        Write-Check OK "no tracked PEM files"
    }

    $trackedRuntime = & git -C $Root ls-files "*.exe" "proxy-service/xray-core/xray-config*.json" "proxy-service/xray-core/*.log"
    if ($trackedRuntime) {
        Write-Check FAIL "tracked runtime artifacts found: $($trackedRuntime -join ', ')"
    } else {
        Write-Check OK "no tracked runtime binaries/logs/configs"
    }

    $scanFiles = & git -C $Root ls-files
    $hits = @()
    foreach ($file in $scanFiles) {
        if ($file -match "^(proxy-service/xray-core/(geoip|geosite)\.dat|extension/package-lock\.json)$") {
            continue
        }
        $full = Join-Path $Root ($file -replace "/", "\")
        if (-not (Test-Path $full -PathType Leaf)) {
            continue
        }
        try {
            $lines = Get-Content -LiteralPath $full -ErrorAction Stop
        } catch {
            continue
        }
        foreach ($line in $lines) {
            $isExampleLine = $line -match "example\.(com|org)|550e8400-e29b-41d4-a716-446655440000|11111111-1111-1111-1111-111111111111|BASE64_PUBLIC_KEY"
            foreach ($pattern in $patterns) {
                if ($line -match $pattern) {
                    if ($pattern -like "vless://*" -and $isExampleLine) {
                        continue
                    }
                    $hits += "${file}: ${pattern}"
                    break
                }
            }
        }
    }

    if ($hits.Count -gt 0) {
        Write-Check FAIL "potential secret patterns in tracked files: $($hits -join '; ')"
    } else {
        Write-Check OK "tracked files secret scan clean"
    }
}

if ($Fix) {
    Invoke-SafeFixes
}

Write-Host "=== Brows VPN Environment Check ===" -ForegroundColor Cyan

$goOk = Test-Tool "go" "go" @("version")
$nodeOk = Test-Tool "node" "node" @("--version")
Test-ProxyExe
Test-Xray
Test-PortAvailability -Port $DefaultSocksPort
Test-NativeManifest
Test-NativeRegistry
Test-ExtensionIdentity -NodeAvailable:$nodeOk
Test-GitIgnores
Test-TrackedSecrets

if (-not (Test-Path $ExtensionDir)) {
    Write-Check FAIL "extension directory missing"
}

if ($Release) {
    Write-Host "`nRelease mode: missing SHA256 sidecar is a failure." -ForegroundColor Cyan
}

if ($Fix) {
    Write-Host "`nFix mode: generated SHA256 sidecar if missing and ran install.ps1 -Build only when local native host state was incomplete." -ForegroundColor Cyan
}

if ($Ci) {
    Write-Host "`nCI mode: repository checks fail the job; local runtime artifacts may be warnings." -ForegroundColor Cyan
}

Write-Host "`nDone. Failures: $script:FailCount; warnings: $script:WarnCount."
if (($Release -or $Ci) -and $script:FailCount -gt 0) {
    exit 1
}
