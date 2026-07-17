# Full local stack: postgres + platform(:3000, OpenCode:4096) + web(:5173) + chamber(:3001 → OC:4096)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> db:up (pgvector :5433)"
docker compose up -d postgres 2>&1 | Out-Host

Write-Host "==> ensuring .env OpenChamber wiring"
$envPath = Join-Path $root ".env"
if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path $root ".env.example") $envPath
}
$c = Get-Content $envPath -Raw
if ($c -notmatch "OPENCHAMBER_ENABLED") {
  Add-Content $envPath "`nOPENCHAMBER_ENABLED=true`nOPENCHAMBER_URL=http://127.0.0.1:3001`n"
} else {
  $c = $c -replace "OPENCHAMBER_ENABLED=\w+", "OPENCHAMBER_ENABLED=true"
  if ($c -match "OPENCHAMBER_URL=") {
    $c = $c -replace "OPENCHAMBER_URL=.*", "OPENCHAMBER_URL=http://127.0.0.1:3001"
  } else {
    $c += "`nOPENCHAMBER_URL=http://127.0.0.1:3001`n"
  }
  Set-Content $envPath $c -NoNewline
}

Write-Host "==> starting platform + web + chamber (linked ports)"
Write-Host "    platform  http://127.0.0.1:3000"
Write-Host "    chamber   http://127.0.0.1:3000/chamber  → :3001 → OpenCode :4096"
Write-Host "    legacy    http://localhost:5173"
Write-Host "    stack     http://127.0.0.1:3000/api/stack"

npx --yes concurrently -n platform,web,chamber -c blue,green,magenta `
  "npm run dev:server" `
  "npm run dev:web" `
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-openchamber.ps1"
