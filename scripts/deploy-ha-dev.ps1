param(
  [string]$Remote,
  [string]$RemotePath,
  [string]$LocalFile = "dist/weather-radar-card.js",
  [switch]$FullBuild,
  [switch]$SkipBuild,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function ConvertTo-ShellSingleQuoted {
  param([string]$Value)
  return "'" + ($Value -replace "'", "'\''") + "'"
}

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

$remoteDirectoryEnd = $RemotePath.LastIndexOf("/")
if ($remoteDirectoryEnd -le 0) {
  throw "RemotePath must include an absolute destination directory and filename."
}

$remoteDirectory = $RemotePath.Substring(0, $remoteDirectoryEnd)
$quotedRemoteDirectory = ConvertTo-ShellSingleQuoted $remoteDirectory
$localFilePath = Join-Path $repoRoot $LocalFile

Push-Location $repoRoot
try {
  if (-not $SkipBuild) {
    if ($FullBuild) {
      Write-Host "Building with npm run build..."
      & npm.cmd run build
      if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed with exit code $LASTEXITCODE"
      }
    } else {
      Write-Host "Linting..."
      & npm.cmd run lint
      if ($LASTEXITCODE -ne 0) {
        throw "npm run lint failed with exit code $LASTEXITCODE"
      }
      Write-Host "Building with npm run rollup..."
      & npm.cmd run rollup
      if ($LASTEXITCODE -ne 0) {
        throw "npm run rollup failed with exit code $LASTEXITCODE"
      }
    }
  }

  if (-not (Test-Path -LiteralPath $localFilePath)) {
    throw "Built file not found: $localFilePath"
  }

  $target = "${Remote}:${RemotePath}"
  Write-Host "Deploying $LocalFile to $target"

  if ($DryRun) {
    Write-Host "Dry run only. Would ensure the remote destination directory exists, then copy the built file."
    exit 0
  }

  Write-Host "Ensuring remote destination directory exists..."
  & ssh $Remote "mkdir -p $quotedRemoteDirectory"
  if ($LASTEXITCODE -ne 0) {
    throw "Remote directory creation failed with exit code $LASTEXITCODE"
  }

  & scp $localFilePath $target
  if ($LASTEXITCODE -ne 0) {
    throw "scp failed with exit code $LASTEXITCODE"
  }
  Write-Host "Deploy complete. Bump your Lovelace resource query string, for example ?v=dev5."
} finally {
  Pop-Location
}
