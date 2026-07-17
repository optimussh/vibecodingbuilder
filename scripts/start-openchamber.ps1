# Start OpenChamber on :3001, attach to platform-managed OpenCode on :4096
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$oc = Join-Path $root "vendor\openchamber"
$web = Join-Path $oc "packages\web"

if (-not (Test-Path $oc)) {
  Write-Host "[chamber] fetching vendor..."
  & (Join-Path $PSScriptRoot "fetch-openchamber.ps1")
}

# Use platform OpenCode (started by apps/server) — do not spawn a second instance
$env:OPENCODE_SKIP_START = "true"
$env:OPENCHAMBER_SKIP_OPENCODE_START = "true"
$env:OPENCODE_PORT = if ($env:OPENCODE_PORT) { $env:OPENCODE_PORT } else { "4096" }
$env:OPENCODE_HOST = if ($env:OPENCODE_HOST) { $env:OPENCODE_HOST } else { "http://127.0.0.1:$($env:OPENCODE_PORT)" }
$env:OPENCHAMBER_PORT = "3001"
$env:PORT = "3001"

function Wait-HttpOk([string]$Url, [int]$TimeoutSec = 90) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
    } catch {
      Start-Sleep -Milliseconds 800
    }
  }
  return $false
}

Write-Host "[chamber] waiting for OpenCode at $($env:OPENCODE_HOST)/global/health ..."
if (-not (Wait-HttpOk "$($env:OPENCODE_HOST)/global/health" 120)) {
  Write-Warning "[chamber] OpenCode not ready — starting anyway (chamber may attach later)"
} else {
  Write-Host "[chamber] OpenCode is up"
}

if (-not (Test-Path (Join-Path $oc "node_modules"))) {
  Write-Host "[chamber] bun install --ignore-scripts..."
  Push-Location $oc
  bun install --ignore-scripts
  Pop-Location
}

$dist = Join-Path $web "dist\index.html"
if (-not (Test-Path $dist)) {
  Write-Host "[chamber] building UI (one-time)..."
  Push-Location $oc
  bun run build:ui
  bun run build:web
  Pop-Location
}

Write-Host "[chamber] listening http://127.0.0.1:3001  (OpenCode → $($env:OPENCODE_HOST))"
Set-Location $web
bun server/index.js --port 3001
