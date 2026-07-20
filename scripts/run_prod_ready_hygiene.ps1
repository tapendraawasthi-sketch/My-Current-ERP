# PR-B6 / ADR_0089 — launch-critical hygiene substitute (Windows).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "== PR-B6 honesty pytest pack =="
npm run test:prod-ready-honesty
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "== PR-B6 Orbix vitest pack =="
npm run test:prod-ready-orbix
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($env:RUN_PLAYWRIGHT_LAUNCH_SLICE -eq "1") {
  Write-Host ""
  Write-Host "== Playwright launch slice (optional) =="
  npm run test:e2e:orbix-launch-slice
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host ""
  Write-Host "== Playwright launch slice SKIPPED (set RUN_PLAYWRIGHT_LAUNCH_SLICE=1 to enable) =="
}

Write-Host ""
Write-Host "PR-B6 hygiene pack: PASSED"
