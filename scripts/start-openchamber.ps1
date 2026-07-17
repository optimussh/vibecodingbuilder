# Start OpenChamber web server on port 3001 (Windows)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$oc = Join-Path $root "vendor\openchamber"
if (-not (Test-Path $oc)) {
  Write-Host "Fetching OpenChamber..."
  & (Join-Path $PSScriptRoot "fetch-openchamber.ps1")
}
$env:OPENCHAMBER_PORT = "3001"
# Avoid colliding with platform on 3000
$env:PORT = "3001"
Set-Location $oc
if (-not (Test-Path "node_modules")) {
  Write-Host "bun install --ignore-scripts ..."
  bun install --ignore-scripts
}
Write-Host "Starting OpenChamber on 127.0.0.1:3001 ..."
# packages/web defaults to OPENCHAMBER_PORT
bun run --cwd packages/web dev:server
