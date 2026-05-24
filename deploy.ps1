$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "scripts\deploy-ha-dev.ps1"

if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "Deployment script not found: $scriptPath"
}

& $scriptPath @args
