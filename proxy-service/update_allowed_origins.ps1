param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionId
)

& (Join-Path $PSScriptRoot 'install.ps1') -ExtensionId $ExtensionId
