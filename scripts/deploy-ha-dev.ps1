param(
  [string]$Remote,
  [string]$RemotePath,
  [string]$LocalFile = "dist/weather-radar-card.js",
  [switch]$FullBuild,
  [switch]$SkipBuild,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$localConfigPath = Join-Path $PSScriptRoot "deploy-ha-dev.local.ps1"

if (Test-Path -LiteralPath $localConfigPath) {
  . $localConfigPath
}

if (-not $Remote -and $DeployRemote) {
  $Remote = $DeployRemote
}

if (-not $RemotePath -and $DeployRemotePath) {
  $RemotePath = $DeployRemotePath
}

if (-not $Remote) {
  throw "Missing deploy remote. Pass -Remote or set `$DeployRemote in scripts\deploy-ha-dev.local.ps1."
}

if (-not $RemotePath) {
  throw "Missing deploy path. Pass -RemotePath or set `$DeployRemotePath in scripts\deploy-ha-dev.local.ps1."
}

$localFilePath = Join-Path $repoRoot $LocalFile

Push-Location $repoRoot
try {
  if (-not $SkipBuild) {
    if ($FullBuild) {
      Write-Host "Building with npm run build..."
      npm run build
    } else {
      Write-Host "Linting..."
      npm run lint
      Write-Host "Building with npm run rollup..."
      npm run rollup
    }
  }

  if (-not (Test-Path -LiteralPath $localFilePath)) {
    throw "Built file not found: $localFilePath"
  }

  $target = "${Remote}:${RemotePath}"
  Write-Host "Deploying $LocalFile to $target"

  if ($DryRun) {
    Write-Host "Dry run only. Skipping scp."
    exit 0
  }

  scp $localFilePath $target
  if ($LASTEXITCODE -ne 0) {
    throw "scp failed with exit code $LASTEXITCODE"
  }
  Write-Host "Deploy complete. Bump your Lovelace resource query string, for example ?v=dev5."
} finally {
  Pop-Location
}
