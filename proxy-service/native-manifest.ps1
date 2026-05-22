# Shared helpers for com.browsvpn.host.json (UTF-8 without BOM).

function Read-NativeHostManifestText {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Manifest not found: $Path"
    }

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    }
    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Read-NativeHostManifest {
    param([Parameter(Mandatory = $true)][string]$Path)
    $text = Read-NativeHostManifestText -Path $Path
    return $text | ConvertFrom-Json
}

function Write-NativeHostManifestText {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$JsonText
    )

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $JsonText, $utf8NoBom)
}

function Write-NativeHostManifest {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Manifest
    )

    $json = ($Manifest | ConvertTo-Json -Depth 5)
    Write-NativeHostManifestText -Path $Path -JsonText $json
}

function Test-NativeHostManifestValid {
    param([Parameter(Mandatory = $true)][string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        throw "Manifest must be UTF-8 without BOM: $Path"
    }

    $null = Read-NativeHostManifest -Path $Path
}

function Test-NativeHostManifestExtensionConfigured {
    param([Parameter(Mandatory = $true)]$Manifest)

    $origins = @($Manifest.allowed_origins)
    if ($origins.Count -eq 0) {
        return $false
    }
    foreach ($origin in $origins) {
        if ($origin -match 'REPLACE_WITH_EXTENSION_ID') {
            return $false
        }
    }
    return $true
}
