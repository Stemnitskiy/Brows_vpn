param(
    [ValidateSet('dev', 'prod')]
    [string]$Mode = 'dev'
)

$ErrorActionPreference = 'Stop'
$extensionDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'extension'
Push-Location $extensionDir
try {
    $env:NODE_ENV = if ($Mode -eq 'prod') { 'production' } else { 'development' }
    $env:BROWSER = 'chrome'
    npx webpack --progress --config webpack.config.js
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}
