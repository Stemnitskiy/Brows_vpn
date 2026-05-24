#Requires -Version 5.1
<#
.SYNOPSIS
  Builds a clean source archive for git or handoff (no junk, secrets, or local paths).

.DESCRIPTION
  Default mode uses `git archive` (tracked files only).
  Worktree mode copies the working tree with .gitignore rules and extra safety exclusions.

  Always sanitizes proxy-service/com.browsvpn.host.json (paths and extension ID).
  By default excludes build outputs (*.exe, *.dll), logs, runtime xray configs, and vendor trees.

.PARAMETER Mode
  git      — archive from HEAD (default, recommended)
  worktree — copy from disk with exclusion rules

.PARAMETER OutputPath
  Destination .zip path. Default: dist/Brows_vpn-<branch>-<hash>-clean.zip

.PARAMETER IncludeBuildOutputs
  Include browsvpn-proxy.exe, xray.exe, wintun.dll, etc.

.PARAMETER SkipVerify
  Do not verify the final archive contents. Verification is enabled by default.

.EXAMPLE
  .\make-clean-archive.ps1

.EXAMPLE
  .\make-clean-archive.ps1 -Mode worktree -IncludeBuildOutputs
#>
[CmdletBinding()]
param(
    [ValidateSet('git', 'worktree')]
    [string]$Mode = 'git',

    [string]$OutputPath = '',

    [switch]$IncludeBuildOutputs,

    [switch]$SkipVerify
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$DistDir = Join-Path $Root 'dist'

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Get-DefaultExcludePatterns {
    @(
        '.git'
        '**/.git/**'
        'node_modules'
        '**/node_modules/**'
        'extension/base'
        'extension/base/**'
        'proxy-service/base'
        'proxy-service/base/**'
        'dist'
        'dist/**'
        'build'
        'build/**'
        'out'
        'out/**'
        'logs'
        'logs/**'
        'secrets'
        'secrets/**'
        'tmp'
        'tmp/**'
        'temp'
        'temp/**'
        '.vscode'
        '.vscode/**'
        '.idea'
        '.idea/**'
        '*.exe'
        '*.exe~'
        '*.dll'
        '*.dll~'
        '*.so'
        '*.dylib'
        '*.test'
        '*.out'
        '*.log'
        '*.tmp'
        '*.pem'
        'go.work'
        '.DS_Store'
        'Thumbs.db'
        'desktop.ini'
        'config.local.json'
        'prepare-github-clean*.ps1'
        'run-github-clean*.bat'
        '*_CLEAN_REPORT.md'
        'proxy-service/xray-core/xray-config.json'
        'proxy-service/xray-core/xray-config-*.json'
        'proxy-service/xray-core/access.log'
        'proxy-service/xray-core/error.log'
        'proxy-service/xray-core/wintun.dll'
        'npm-debug.log*'
        'yarn-debug.log*'
        'yarn-error.log*'
    )
}

function Read-GitIgnorePatterns {
    param([string]$GitIgnorePath)
    if (-not (Test-Path $GitIgnorePath)) { return @() }

    $patterns = @()
    foreach ($line in Get-Content $GitIgnorePath -Encoding UTF8) {
        $line = $line.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        if ($line.StartsWith('!')) { continue }
        $patterns += $line -replace '\\', '/'
    }
    return $patterns
}

function ConvertToRegex {
    param([string]$Pattern)
    $p = ($Pattern -replace '\\', '/').Trim('/')
    if (-not $p) { return $null }

    if ($p.EndsWith('/')) {
        $p = $p.TrimEnd('/')
        $body = ($p -replace '\.', '\.' -replace '\*\*/', '(?:.*/)?' -replace '\*', '[^/]*' -replace '\?', '.')
        return "^(?:$body(?:/.*)?)$"
    }

    if ($p -match '[\*\?]') {
        $body = ($p -replace '\.', '\.' -replace '\*\*/', '(?:.*/)?' -replace '\*', '[^/]*' -replace '\?', '.')
        return "(?:^|/)$body$"
    }

    $body = [regex]::Escape($p)
    return "(?:^$body$|^$body/|/$body$|/$body/)"
}

function Test-RelativePathExcluded {
    param(
        [string]$RelativePath,
        [string[]]$Regexes
    )
    $rel = ($RelativePath -replace '\\', '/').TrimStart('./')
    foreach ($rx in $Regexes) {
        if ($rel -match $rx) { return $true }
    }
    return $false
}

function Build-ExcludeRegexes {
    param([string[]]$Patterns)
    $regexes = @()
    foreach ($pattern in $Patterns) {
        $rx = ConvertToRegex $pattern
        if ($rx) { $regexes += $rx }
    }
    return $regexes
}

function Get-ExcludeRegexes {
    $patterns = Read-GitIgnorePatterns (Join-Path $Root '.gitignore')
    $patterns += Get-DefaultExcludePatterns
    if ($IncludeBuildOutputs) {
        $patterns = $patterns | Where-Object {
            $_ -notin @('*.exe', '*.exe~', '*.dll', '*.dll~', 'proxy-service/xray-core/wintun.dll')
        }
    }
    Build-ExcludeRegexes $patterns
}

# --- sanitize -------------------------------------------------------------

function Get-SanitizedHostManifest {
    $proxyExe = Join-Path $Root 'proxy-service/browsvpn-proxy.exe'
    $pathHint = if ($IncludeBuildOutputs -and (Test-Path $proxyExe)) {
        $proxyExe -replace '\\', '\\'
    } else {
        'REPLACE_WITH_ABSOLUTE_PATH_TO_proxy-service\\browsvpn-proxy.exe'
    }

    @"
{
  "name": "com.browsvpn.host",
  "description": "Brows VPN Native Messaging Host",
  "path": "$pathHint",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://REPLACE_WITH_EXTENSION_ID/"
  ]
}
"@
}

function Write-ArchiveReadme {
    param([string]$TargetDir, [hashtable]$Meta)

    $lines = @(
        'Brows VPN — clean archive'
        "Created: $($Meta.Created)"
        "Mode: $($Meta.Mode)"
        "Git: $($Meta.GitLabel)"
        ''
        'Sanitized:'
        '  - proxy-service/com.browsvpn.host.json (no local paths / extension ID)'
        '  - runtime xray configs and logs removed if present'
        ''
        'After unpack:'
        '  1. Download xray.exe into proxy-service/xray-core/ (see docs/QUICK_START.md)'
        '  2. cd proxy-service; .\install.bat'
        '  3. chrome://extensions/ - Load unpacked - folder extension/'
        '  4. Settings - VLESS URL - Enable VPN from popup'
        ''
        'Extension ID is stable for GitHub/unpacked (manifest.key, extension/EXTENSION_ID.txt).'
        'Debug override only: .\install.ps1 -ExtensionId YOUR_ID -Build'
        ''
        'Tests:'
        '  cd proxy-service && go test ./...'
        '  node scripts/test-pac-whitelist.js'
        '  node scripts/test-settings-import-export.js'
    )
    if (-not $IncludeBuildOutputs) {
        $lines += ''
        $lines += 'Note: build outputs (*.exe, wintun.dll) were excluded. Rebuild or use -IncludeBuildOutputs.'
    }

    Write-Utf8NoBom -Path (Join-Path $TargetDir 'ARCHIVE_README.txt') -Content ($lines -join [Environment]::NewLine)
}

function Invoke-SanitizeTree {
    param(
        [string]$TreeRoot,
        [hashtable]$Meta
    )

    $removed = [System.Collections.Generic.List[string]]::new()

    $hostManifest = Join-Path $TreeRoot 'proxy-service/com.browsvpn.host.json'
    if (Test-Path $hostManifest) {
        Write-Utf8NoBom -Path $hostManifest -Content (Get-SanitizedHostManifest)
    }

    $xrayCore = Join-Path $TreeRoot 'proxy-service/xray-core'
    if (Test-Path $xrayCore) {
        foreach ($file in Get-ChildItem -Path $xrayCore -File -ErrorAction SilentlyContinue) {
            if ($file.Name -match '^(xray-config.*\.json|access\.log|error\.log)$') {
                $rel = $file.FullName.Substring($TreeRoot.Length).TrimStart('\', '/')
                Remove-Item $file.FullName -Force
                $removed.Add($rel)
            }
        }
    }

    $localConfig = Join-Path $TreeRoot 'config.local.json'
    if (Test-Path $localConfig) {
        Remove-Item $localConfig -Force
        $removed.Add('config.local.json')
    }

    foreach ($dirName in @('logs', 'secrets', 'tmp', 'temp')) {
        $dir = Join-Path $TreeRoot $dirName
        if (Test-Path $dir) {
            Remove-Item $dir -Recurse -Force
            $removed.Add("$dirName/")
        }
    }

    if (-not $IncludeBuildOutputs) {
        Get-ChildItem -Path $TreeRoot -Recurse -File -Include *.exe, *.exe~, *.dll, *.dll~ -ErrorAction SilentlyContinue |
            ForEach-Object {
                $rel = $_.FullName.Substring($TreeRoot.Length).TrimStart('\', '/')
                Remove-Item $_.FullName -Force
                $removed.Add($rel)
            }
    }

    Get-ChildItem -Path $TreeRoot -Recurse -File -Include 'prepare-github-clean*.ps1', 'run-github-clean*.bat', '*_CLEAN_REPORT.md' -ErrorAction SilentlyContinue |
        ForEach-Object {
            $rel = $_.FullName.Substring($TreeRoot.Length).TrimStart('\', '/')
            Remove-Item $_.FullName -Force
            $removed.Add($rel)
        }

    Write-ArchiveReadme -TargetDir $TreeRoot -Meta $Meta
    return $removed
}

# --- archive builders -----------------------------------------------------

function Get-GitLabel {
    Push-Location $Root
    try {
        if (-not (Test-Path '.git')) { return 'no-git' }
        $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
        $hash = (git rev-parse --short HEAD 2>$null)
        $dirty = if (git status --porcelain 2>$null) { '-dirty' } else { '' }
        return "$branch-$hash$dirty"
    } finally {
        Pop-Location
    }
}

function Get-DefaultOutputPath {
    param([string]$GitLabel)
    if (-not (Test-Path $DistDir)) {
        New-Item -ItemType Directory -Path $DistDir | Out-Null
    }
    Join-Path $DistDir "Brows_vpn-$GitLabel-clean.zip"
}

function New-ZipFromDirectory {
    param(
        [string]$SourceDir,
        [string]$ZipPath
    )
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($SourceDir, $ZipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
}

function Test-CleanArchive {
    param([string]$ZipPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    $findings = [System.Collections.Generic.List[string]]::new()

    $entryBlockPatterns = @(
        '(^|/)secrets/',
        '\.pem$',
        'xray-config.*\.json$',
        '(^|/)access\.log$',
        '(^|/)error\.log$',
        'com\.browsvpn\.host\.local\.json$',
        '(^|/)prepare-github-clean.*\.ps1$',
        '(^|/)run-github-clean.*\.bat$',
        '_CLEAN_REPORT\.md$'
    )
    if (-not $IncludeBuildOutputs) {
        $entryBlockPatterns += '\.(exe|dll|so|dylib)$'
    }

    $secretPatterns = @(
        'ghp_[A-Za-z0-9_]{20,}',
        'github_pat_[A-Za-z0-9_]{20,}',
        'sk-[A-Za-z0-9]{20,}',
        'BEGIN (RSA |OPENSSH |)PRIVATE KEY',
        'vless://[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}@'
    )
    $textExts = @('.txt', '.md', '.json', '.js', '.ps1', '.bat', '.html', '.css', '.yml', '.yaml', '.xml', '.toml', '.ini')

    try {
        foreach ($entry in $zip.Entries) {
            $name = $entry.FullName -replace '\\', '/'
            foreach ($pattern in $entryBlockPatterns) {
                if ($name -match $pattern) {
                    $findings.Add("forbidden entry: $name")
                    break
                }
            }

            if ($entry.Length -gt 2097152) {
                continue
            }
            $ext = [IO.Path]::GetExtension($name).ToLowerInvariant()
            if ($textExts -notcontains $ext -and [IO.Path]::GetFileName($name).ToLowerInvariant() -ne '.gitignore') {
                continue
            }

            $reader = New-Object IO.StreamReader($entry.Open())
            try {
                $lineNo = 0
                while (($line = $reader.ReadLine()) -ne $null) {
                    $lineNo += 1
                    $isExampleLine = $line -match 'example\.(com|org)|550e8400-e29b-41d4-a716-446655440000|11111111-1111-1111-1111-111111111111|BASE64_PUBLIC_KEY'
                    foreach ($pattern in $secretPatterns) {
                        if ($line -match $pattern) {
                            if ($pattern -like 'vless://*' -and $isExampleLine) {
                                continue
                            }
                            $findings.Add("secret pattern in ${name}:${lineNo}")
                            break
                        }
                    }
                }
            } finally {
                $reader.Dispose()
            }
        }
    } finally {
        $zip.Dispose()
    }

    if ($findings.Count -gt 0) {
        throw "Clean archive verification failed:`n - $($findings -join "`n - ")"
    }

    Write-Host "Archive verification: OK" -ForegroundColor Green
}

function New-GitArchive {
    param(
        [string]$ZipPath,
        [hashtable]$Meta
    )

    Push-Location $Root
    try {
        if (-not (Test-Path '.git')) {
            throw 'Git repository not found. Use -Mode worktree or run from repo root.'
        }
        git rev-parse HEAD | Out-Null
    } finally {
        Pop-Location
    }

    $staging = Join-Path ([IO.Path]::GetTempPath()) ("browsvpn-archive-" + [Guid]::NewGuid().ToString('N'))
    $tempZip = Join-Path ([IO.Path]::GetTempPath()) ("browsvpn-git-" + [Guid]::NewGuid().ToString('N') + '.zip')
    New-Item -ItemType Directory -Path $staging | Out-Null

    try {
        Push-Location $Root
        & git archive --format=zip -o $tempZip HEAD
        if ($LASTEXITCODE -ne 0) {
            throw "git archive failed with exit code $LASTEXITCODE"
        }
        Pop-Location

        Expand-Archive -Path $tempZip -DestinationPath $staging -Force

        $removed = Invoke-SanitizeTree -TreeRoot $staging -Meta $Meta
        New-ZipFromDirectory -SourceDir $staging -ZipPath $ZipPath

        return [pscustomobject]@{
            ZipPath = $ZipPath
            Removed = @($removed)
            Skipped = @()
            FileCount = (Get-ChildItem $staging -Recurse -File).Count
        }
    } finally {
        if (Test-Path $tempZip) { Remove-Item $tempZip -Force -ErrorAction SilentlyContinue }
        if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }
    }
}

function New-WorktreeArchive {
    param(
        [string]$ZipPath,
        [hashtable]$Meta
    )

    $excludeRegexes = Get-ExcludeRegexes
    $staging = Join-Path ([IO.Path]::GetTempPath()) ("browsvpn-worktree-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging | Out-Null
    $skipped = [System.Collections.Generic.List[string]]::new()

    try {
        Get-ChildItem -Path $Root -Force | ForEach-Object {
            $name = $_.Name
            if ($name -eq 'dist' -or $name -eq '.git') { return }
            Copy-TreeFiltered -Source $_.FullName -Destination (Join-Path $staging $name) -Root $Root -ExcludeRegexes $excludeRegexes -Skipped $skipped
        }

        $removed = Invoke-SanitizeTree -TreeRoot $staging -Meta $Meta
        New-ZipFromDirectory -SourceDir $staging -ZipPath $ZipPath

        return [pscustomobject]@{
            ZipPath = $ZipPath
            Removed = @($removed)
            Skipped = @($skipped)
            FileCount = (Get-ChildItem $staging -Recurse -File).Count
        }
    } finally {
        if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }
    }
}

function Copy-TreeFiltered {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Root,
        [string[]]$ExcludeRegexes,
        [System.Collections.Generic.List[string]]$Skipped
    )

    if ($Source -match '[\\/]\.git([\\/]|$)') { return }

    $rel = $Source.Substring($Root.Length).TrimStart('\', '/') -replace '\\', '/'
    if (Test-RelativePathExcluded -RelativePath $rel -Regexes $ExcludeRegexes) {
        $Skipped.Add($rel)
        return
    }

    $item = Get-Item -LiteralPath $Source -Force
    if ($item.PSIsContainer) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
        Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
            Copy-TreeFiltered -Source $_.FullName -Destination (Join-Path $Destination $_.Name) -Root $Root -ExcludeRegexes $ExcludeRegexes -Skipped $Skipped
        }
    } else {
        $destParent = Split-Path $Destination -Parent
        if (-not (Test-Path $destParent)) {
            New-Item -ItemType Directory -Path $destParent -Force | Out-Null
        }
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
    }
}

# --- main -----------------------------------------------------------------

$gitLabel = Get-GitLabel
if (-not $OutputPath) {
    $OutputPath = Get-DefaultOutputPath -GitLabel $gitLabel
} else {
    $outDir = Split-Path $OutputPath -Parent
    if ($outDir -and -not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }
}

$meta = @{
    Created = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    Mode = $Mode
    GitLabel = $gitLabel
}

Write-Host "Brows VPN clean archive" -ForegroundColor Cyan
Write-Host "  mode:   $Mode"
Write-Host "  output: $OutputPath"
Write-Host "  builds: $(if ($IncludeBuildOutputs) { 'included' } else { 'excluded' })"
Write-Host ""

if ($Mode -eq 'git') {
    $result = New-GitArchive -ZipPath $OutputPath -Meta $meta
} else {
    $result = New-WorktreeArchive -ZipPath $OutputPath -Meta $meta
}

if (-not $SkipVerify) {
    Test-CleanArchive -ZipPath $result.ZipPath
}

$sizeMb = [math]::Round((Get-Item $result.ZipPath).Length / 1MB, 2)

Write-Host "Done." -ForegroundColor Green
Write-Host "  files:  $($result.FileCount)"
Write-Host "  size:   ${sizeMb} MB"
Write-Host "  path:   $($result.ZipPath)"

if ($result.Removed -and $result.Removed.Count -gt 0) {
    Write-Host ""
    Write-Host "Sanitized/removed inside archive:" -ForegroundColor Yellow
    $result.Removed | Select-Object -First 12 | ForEach-Object { Write-Host "  - $_" }
    if ($result.Removed.Count -gt 12) {
        Write-Host "  ... and $($result.Removed.Count - 12) more"
    }
}

if ($result.Skipped -and $result.Skipped.Count -gt 0) {
    Write-Host ""
    Write-Host "Skipped from worktree (first 12):" -ForegroundColor DarkYellow
    $result.Skipped | Select-Object -First 12 | ForEach-Object { Write-Host "  - $_" }
    if ($result.Skipped.Count -gt 12) {
        Write-Host "  ... and $($result.Skipped.Count - 12) more"
    }
}

Write-Host ""
Write-Host "See ARCHIVE_README.txt inside the zip for next steps." -ForegroundColor Cyan
