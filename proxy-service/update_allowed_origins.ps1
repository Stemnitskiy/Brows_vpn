param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionId
)

$manifestPath = Join-Path $PSScriptRoot "com.browsvpn.host.json"
if (-not (Test-Path $manifestPath)) {
    Write-Error "Manifest not found: $manifestPath"
    exit 1
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifest.allowed_origins = @("chrome-extension://$ExtensionId/")
$manifest | ConvertTo-Json -Depth 5 | Set-Content $manifestPath -Encoding UTF8

Write-Host "Updated allowed_origins for extension: $ExtensionId"
Write-Host "Restart Chrome for changes to take effect."
