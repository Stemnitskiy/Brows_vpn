param(
    [string]$ProjectPath = '.',
    [string]$OutputPath = '',
    [switch]$DropNoisyDocs,
    [switch]$InitGit,
    [switch]$Force,
    [switch]$KeepBinaries
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host ('[clean] ' + $Message) -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host ('[warn]  ' + $Message) -ForegroundColor Yellow
}

function Resolve-FullPath {
    param([string]$Path)
    $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
    return [System.IO.Path]::GetFullPath($resolved.ProviderPath)
}

function Get-RelativePathCompat {
    param(
        [Parameter(Mandatory = $true)][string]$BasePath,
        [Parameter(Mandatory = $true)][string]$TargetPath
    )

    $baseFull = [System.IO.Path]::GetFullPath($BasePath)
    if (-not $baseFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $baseFull = $baseFull + [System.IO.Path]::DirectorySeparatorChar
    }

    $targetFull = [System.IO.Path]::GetFullPath($TargetPath)
    $baseUri = New-Object System.Uri($baseFull)
    $targetUri = New-Object System.Uri($targetFull)
    $relativeUri = $baseUri.MakeRelativeUri($targetUri)
    $relative = [System.Uri]::UnescapeDataString($relativeUri.ToString())
    return $relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Test-PathIsInside {
    param(
        [Parameter(Mandatory = $true)][string]$ParentPath,
        [Parameter(Mandatory = $true)][string]$ChildPath
    )
    $parent = [System.IO.Path]::GetFullPath($ParentPath).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $child = [System.IO.Path]::GetFullPath($ChildPath).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    return $child.StartsWith($parent, [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-WildcardAny {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][string[]]$Patterns
    )
    foreach ($pattern in $Patterns) {
        if ($Value -like $pattern) {
            return $true
        }
    }
    return $false
}

function Test-ExcludedPath {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [switch]$KeepBinaries
    )

    $parts = $RelativePath -split '[\\/]'
    $blockedDirs = @(
        '.git', '.cursor', '.idea', '.vs',
        'node_modules', 'dist', 'build', 'out', 'release', 'releases',
        '.venv', 'venv', 'env', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
        '.next', '.vite', 'coverage', '.nyc_output',
        'secrets', 'secret', 'private',
        'logs', 'tmp', 'temp'
    )

    foreach ($part in $parts) {
        foreach ($blocked in $blockedDirs) {
            if ($part.Equals($blocked, [System.StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
        }
    }

    $leaf = [System.IO.Path]::GetFileName($RelativePath)
    $blockedFiles = @(
        '.env', '.env.*', '*.pem', '*.key', '*.pfx', '*.p12', '*.crt', '*.cer',
        '*.log', '*.tmp', '*.bak', '*.orig', '*.swp', '*.swo',
        '*.zip', '*.7z', '*.rar', '*.tar', '*.gz',
        'prepare-github-clean*.ps1', 'run-github-clean*.bat', '*_CLEAN_REPORT.md',
        'Thumbs.db', 'desktop.ini', '.DS_Store'
    )

    if (-not $KeepBinaries) {
        $blockedFiles = $blockedFiles + @('*.exe', '*.dll', '*.msi', '*.dmg', '*.pkg')
    }

    return (Test-WildcardAny -Value $leaf -Patterns $blockedFiles)
}

function Test-NoisyDocPath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $leaf = [System.IO.Path]::GetFileName($RelativePath)
    $ext = [System.IO.Path]::GetExtension($leaf)
    $docExts = @('.md', '.txt', '.rst')
    if ($docExts -notcontains $ext.ToLowerInvariant()) {
        return $false
    }

    $patterns = @(
        '*PROJECT_COMPLETE*', '*FINAL_INSTRUCTIONS*', '*CURRENT_STATUS*', '*CURRENT_STATE*',
        '*STAGES_TIMELINE*', '*IMPLEMENTATION_ROADMAP*', '*ROADMAP*', '*AGENT*', '*CURSOR*',
        '*AI_NOTES*', '*PHASE*', '*STAGE*'
    )

    return (Test-WildcardAny -Value $leaf.ToUpperInvariant() -Patterns $patterns)
}

function Test-TextFileCandidate {
    param([Parameter(Mandatory = $true)]$FileInfo)

    if ($FileInfo.Length -gt 2097152) {
        return $false
    }

    $textExts = @(
        '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.py', '.ps1', '.bat', '.cmd',
        '.html', '.css', '.scss', '.yml', '.yaml', '.xml', '.toml', '.ini', '.cfg', '.conf',
        '.gitignore', '.dockerignore', '.env.example'
    )

    $name = $FileInfo.Name.ToLowerInvariant()
    $ext = $FileInfo.Extension.ToLowerInvariant()

    if ($textExts -contains $ext) {
        return $true
    }

    if ($textExts -contains $name) {
        return $true
    }

    return $false
}

function Copy-CleanTree {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRoot,
        [Parameter(Mandatory = $true)][string]$CleanRoot,
        [switch]$DropNoisyDocs,
        [switch]$KeepBinaries
    )

    $dropped = New-Object System.Collections.Generic.List[string]
    $copied = 0

    $files = Get-ChildItem -LiteralPath $SourceRoot -Recurse -Force -File -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $relative = Get-RelativePathCompat -BasePath $SourceRoot -TargetPath $file.FullName

        if (Test-ExcludedPath -RelativePath $relative -KeepBinaries:$KeepBinaries) {
            [void]$dropped.Add($relative)
            continue
        }

        if ($DropNoisyDocs -and (Test-NoisyDocPath -RelativePath $relative)) {
            [void]$dropped.Add($relative)
            continue
        }

        $dest = Join-Path $CleanRoot $relative
        $destDir = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        Copy-Item -LiteralPath $file.FullName -Destination $dest -Force
        $copied++
    }

    return [pscustomobject]@{
        Copied = $copied
        Dropped = $dropped.ToArray()
    }
}

function Sanitize-KnownFiles {
    param([Parameter(Mandatory = $true)][string]$CleanRoot)

    $sanitized = New-Object System.Collections.Generic.List[string]

    $manifestCandidates = @(
        'proxy-service\com.browsvpn.host.json',
        'native-host\com.browsvpn.host.json',
        'com.browsvpn.host.json'
    )

    foreach ($rel in $manifestCandidates) {
        $path = Join-Path $CleanRoot $rel
        if (Test-Path -LiteralPath $path) {
            $text = Get-Content -LiteralPath $path -Raw -ErrorAction Stop
            $newText = $text -replace 'chrome-extension://[a-z]{32}/', 'chrome-extension://PUT_YOUR_EXTENSION_ID_HERE/'
            if ($newText -ne $text) {
                Set-Content -LiteralPath $path -Value $newText -Encoding UTF8
                [void]$sanitized.Add($rel)
            }
        }
    }

    return $sanitized.ToArray()
}

function Scan-Secrets {
    param([Parameter(Mandatory = $true)][string]$CleanRoot)

    $findings = New-Object System.Collections.Generic.List[object]
    $patterns = @(
        @{ Name = 'Private key block'; Regex = '-----BEGIN (RSA |OPENSSH |DSA |EC |PGP )?PRIVATE KEY-----' },
        @{ Name = 'Token/API key assignment'; Regex = '(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|pwd)\s*[:=]\s*[''\"]?[^''\"\s]{12,}' },
        @{ Name = 'Bearer token'; Regex = '(?i)bearer\s+[a-z0-9._\-]{20,}' },
        @{ Name = 'VLESS link'; Regex = 'vless://' },
        @{ Name = 'SS/SSR link'; Regex = '(ss|ssr)://' },
        @{ Name = 'Chrome extension id'; Regex = 'chrome-extension://[a-z]{32}/' }
    )

    $files = Get-ChildItem -LiteralPath $CleanRoot -Recurse -Force -File -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        if (-not (Test-TextFileCandidate -FileInfo $file)) {
            continue
        }

        try {
            $lines = @(Get-Content -LiteralPath $file.FullName -ErrorAction Stop)
        } catch {
            continue
        }

        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = [string]$lines[$i]
            foreach ($p in $patterns) {
                if ($line -match $p.Regex) {
                    $rel = Get-RelativePathCompat -BasePath $CleanRoot -TargetPath $file.FullName
                    [void]$findings.Add([pscustomobject]@{
                        File = $rel
                        Line = $i + 1
                        Type = $p.Name
                    })
                    break
                }
            }
        }
    }

    return $findings.ToArray()
}

function Scan-ToolTraces {
    param([Parameter(Mandatory = $true)][string]$CleanRoot)

    $findings = New-Object System.Collections.Generic.List[object]
    $patterns = @(
        @{ Name = 'ChatGPT mention'; Regex = '(?i)chatgpt' },
        @{ Name = 'Claude mention'; Regex = '(?i)claude' },
        @{ Name = 'Cursor mention'; Regex = '(?i)cursor' },
        @{ Name = 'AI agent mention'; Regex = '(?i)ai\s+agent|agentic|llm' },
        @{ Name = 'Generated-by wording'; Regex = '(?i)generated\s+by|auto-generated|created\s+by\s+ai' },
        @{ Name = 'Project complete wording'; Regex = '(?i)project\s+complete|ready\s+for\s+deployment' }
    )

    $files = Get-ChildItem -LiteralPath $CleanRoot -Recurse -Force -File -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $rel = Get-RelativePathCompat -BasePath $CleanRoot -TargetPath $file.FullName
        $name = $file.Name
        foreach ($p in $patterns) {
            if ($name -match $p.Regex) {
                [void]$findings.Add([pscustomobject]@{
                    File = $rel
                    Line = 0
                    Type = ('Filename: ' + $p.Name)
                })
                break
            }
        }

        if (-not (Test-TextFileCandidate -FileInfo $file)) {
            continue
        }

        try {
            $lines = @(Get-Content -LiteralPath $file.FullName -ErrorAction Stop)
        } catch {
            continue
        }

        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = [string]$lines[$i]
            foreach ($p in $patterns) {
                if ($line -match $p.Regex) {
                    [void]$findings.Add([pscustomobject]@{
                        File = $rel
                        Line = $i + 1
                        Type = $p.Name
                    })
                    break
                }
            }
        }
    }

    return $findings.ToArray()
}

function New-CleanReport {
    param(
        [Parameter(Mandatory = $true)][string]$ReportPath,
        [Parameter(Mandatory = $true)][string]$SourceRoot,
        [Parameter(Mandatory = $true)][string]$CleanRoot,
        [Parameter(Mandatory = $true)]$SecretFindings,
        [Parameter(Mandatory = $true)]$TraceFindings,
        [Parameter(Mandatory = $true)]$DroppedItems,
        [Parameter(Mandatory = $true)]$SanitizedItems
    )

    $SecretFindings = @($SecretFindings)
    $TraceFindings = @($TraceFindings)
    $DroppedItems = @($DroppedItems)
    $SanitizedItems = @($SanitizedItems)

    $sourceFileCount = (Get-ChildItem -LiteralPath $SourceRoot -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object).Count
    $cleanFileCount = (Get-ChildItem -LiteralPath $CleanRoot -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object).Count

    $lines = New-Object System.Collections.Generic.List[string]
    [void]$lines.Add('# Clean GitHub report')
    [void]$lines.Add('')
    [void]$lines.Add(('Created: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')))
    [void]$lines.Add(('Source: ' + $SourceRoot))
    [void]$lines.Add(('Clean copy: ' + $CleanRoot))
    [void]$lines.Add(('Source files: ' + $sourceFileCount))
    [void]$lines.Add(('Clean files: ' + $cleanFileCount))
    [void]$lines.Add('')

    [void]$lines.Add('## Removed/excluded')
    if ($DroppedItems.Count -eq 0) {
        [void]$lines.Add('- Nothing removed by exclusion rules.')
    } else {
        foreach ($item in ($DroppedItems | Sort-Object -Unique)) {
            [void]$lines.Add(('- ' + $item))
        }
    }
    [void]$lines.Add('')

    [void]$lines.Add('## Sanitized')
    if ($SanitizedItems.Count -eq 0) {
        [void]$lines.Add('- Nothing sanitized.')
    } else {
        foreach ($item in ($SanitizedItems | Sort-Object -Unique)) {
            [void]$lines.Add(('- ' + $item))
        }
    }
    [void]$lines.Add('')

    [void]$lines.Add('## Possible secrets still present')
    if ($SecretFindings.Count -eq 0) {
        [void]$lines.Add('- None found by pattern scan.')
    } else {
        foreach ($f in $SecretFindings) {
            [void]$lines.Add(('- ' + $f.File + ':' + $f.Line + ' - ' + $f.Type))
        }
    }
    [void]$lines.Add('')

    [void]$lines.Add('## Possible AI/tool traces still present')
    if ($TraceFindings.Count -eq 0) {
        [void]$lines.Add('- None found by pattern scan.')
    } else {
        foreach ($f in $TraceFindings) {
            if ($f.Line -gt 0) {
                [void]$lines.Add(('- ' + $f.File + ':' + $f.Line + ' - ' + $f.Type))
            } else {
                [void]$lines.Add(('- ' + $f.File + ' - ' + $f.Type))
            }
        }
    }
    [void]$lines.Add('')

    [void]$lines.Add('## Next steps')
    [void]$lines.Add('1. Open the clean folder and review the report findings.')
    [void]$lines.Add('2. If possible secrets are listed, fix or delete those files before pushing.')
    [void]$lines.Add('3. Push only the clean folder, not the original project folder and not an old zip archive.')

    Set-Content -LiteralPath $ReportPath -Value $lines -Encoding UTF8
}

function Initialize-CleanGit {
    param(
        [Parameter(Mandatory = $true)][string]$CleanRoot,
        [Parameter(Mandatory = $true)]$SecretFindings
    )

    $SecretFindings = @($SecretFindings)

    if ($SecretFindings.Count -gt 0) {
        throw 'Possible secrets were found. Git init/commit is blocked. Review the report first.'
    }

    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) {
        throw 'git was not found in PATH.'
    }

    Push-Location $CleanRoot
    try {
        & git init | Out-Null
        & git branch -M main | Out-Null
        & git add . | Out-Null
        & git commit -m 'Initial private release' | Out-Null
    } finally {
        Pop-Location
    }
}

$sourceRoot = Resolve-FullPath $ProjectPath
if (-not $OutputPath -or $OutputPath.Trim().Length -eq 0) {
    $parent = Split-Path -Parent $sourceRoot
    $leaf = Split-Path -Leaf $sourceRoot
    $cleanRoot = Join-Path $parent ($leaf + '_github_clean')
} else {
    $cleanRoot = [System.IO.Path]::GetFullPath($OutputPath)
}

if (Test-PathIsInside -ParentPath $sourceRoot -ChildPath $cleanRoot) {
    throw 'OutputPath must not be inside ProjectPath. Use a sibling folder instead.'
}

Write-Step ('Source: ' + $sourceRoot)
Write-Step ('Clean copy: ' + $cleanRoot)

if (Test-Path -LiteralPath $cleanRoot) {
    if (-not $Force) {
        throw ('Clean folder already exists: ' + $cleanRoot + '. Use -Force to overwrite it.')
    }
    Write-Step 'Removing existing clean folder...'
    Remove-Item -LiteralPath $cleanRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $cleanRoot -Force | Out-Null

Write-Step 'Copying project without private/tooling/build artifacts...'
$copyResult = Copy-CleanTree -SourceRoot $sourceRoot -CleanRoot $cleanRoot -DropNoisyDocs:$DropNoisyDocs -KeepBinaries:$KeepBinaries

Write-Step ('Copied files: ' + $copyResult.Copied)
Write-Step ('Excluded items: ' + $copyResult.Dropped.Count)

Write-Step 'Sanitizing known config files...'
$sanitized = @(Sanitize-KnownFiles -CleanRoot $cleanRoot)

Write-Step 'Scanning clean copy for possible secrets...'
$secretFindings = @(Scan-Secrets -CleanRoot $cleanRoot)

Write-Step 'Scanning clean copy for possible AI/tool traces...'
$traceFindings = @(Scan-ToolTraces -CleanRoot $cleanRoot)

$reportPath = $cleanRoot + '_CLEAN_REPORT.md'
New-CleanReport -ReportPath $reportPath -SourceRoot $sourceRoot -CleanRoot $cleanRoot -SecretFindings $secretFindings -TraceFindings $traceFindings -DroppedItems $copyResult.Dropped -SanitizedItems $sanitized

if ($InitGit) {
    Write-Step 'Initializing git repository in clean copy...'
    Initialize-CleanGit -CleanRoot $cleanRoot -SecretFindings $secretFindings
}

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host ('Clean copy: ' + $cleanRoot) -ForegroundColor Green
Write-Host ('Report:     ' + $reportPath) -ForegroundColor Green

if ($secretFindings.Count -gt 0) {
    Write-Warn ('Possible secrets found: ' + $secretFindings.Count + '. Review the report before pushing.')
}

if ($traceFindings.Count -gt 0) {
    Write-Warn ('Possible AI/tool traces found: ' + $traceFindings.Count + '. Review the report if you want a cleaner public repo.')
}
