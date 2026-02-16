param(
  [switch]$IncludeExtension,
  [switch]$IncludePack,
  [switch]$SkipInstall,
  [switch]$SkipBuild,
  [switch]$SkipWorkspaceTests
)

$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Step $Name
  $start = Get-Date
  try {
    & $Action | Out-Null
    $elapsed = (Get-Date) - $start
    Write-Host "PASS: $Name ($([math]::Round($elapsed.TotalSeconds, 1))s)" -ForegroundColor Green
    return [pscustomobject]@{ Name = $Name; Status = 'PASS'; Seconds = [math]::Round($elapsed.TotalSeconds, 1) }
  } catch {
    $elapsed = (Get-Date) - $start
    Write-Host "FAIL: $Name ($([math]::Round($elapsed.TotalSeconds, 1))s)" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor DarkRed
    return [pscustomobject]@{ Name = $Name; Status = 'FAIL'; Seconds = [math]::Round($elapsed.TotalSeconds, 1) }
  }
}

function Run-Cmd {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [string]$WorkingDirectory
  )

  if ($WorkingDirectory) {
    Push-Location $WorkingDirectory
  }

  try {
    Write-Host "> $Command" -ForegroundColor DarkGray
    & cmd.exe /d /s /c $Command
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code ${LASTEXITCODE}: $Command"
    }
  } finally {
    if ($WorkingDirectory) {
      Pop-Location
    }
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$results = @()

Write-Host "Aspect Code test checklist" -ForegroundColor White
Write-Host "Repo: $repoRoot" -ForegroundColor Gray

if (-not $SkipInstall) {
  $results += Invoke-Step -Name 'Install dependencies' -Action {
    Run-Cmd -Command 'npm install' -WorkingDirectory $repoRoot
  }
}

if (-not $SkipBuild) {
  $results += Invoke-Step -Name 'Build all workspaces' -Action {
    Run-Cmd -Command 'npm run build --workspaces' -WorkingDirectory $repoRoot
  }
}

if (-not $SkipWorkspaceTests) {
  $results += Invoke-Step -Name 'Test core package' -Action {
    Run-Cmd -Command 'npm test' -WorkingDirectory (Join-Path $repoRoot 'packages/core')
  }

  $results += Invoke-Step -Name 'Test emitters package' -Action {
    Run-Cmd -Command 'npm test' -WorkingDirectory (Join-Path $repoRoot 'packages/emitters')
  }

  $results += Invoke-Step -Name 'Test CLI package' -Action {
    Run-Cmd -Command 'npm test' -WorkingDirectory (Join-Path $repoRoot 'packages/cli')
  }
}

$results += Invoke-Step -Name 'CLI smoke: help' -Action {
  Run-Cmd -Command 'node packages/cli/bin/aspectcode.js --help' -WorkingDirectory $repoRoot
}

$results += Invoke-Step -Name 'CLI smoke: generate alias (gen)' -Action {
  Run-Cmd -Command 'node packages/cli/bin/aspectcode.js gen --quiet' -WorkingDirectory $repoRoot
}

$results += Invoke-Step -Name 'CLI smoke: impact' -Action {
  Run-Cmd -Command 'node packages/cli/bin/aspectcode.js impact --file packages/cli/src/main.ts --quiet' -WorkingDirectory $repoRoot
}

$results += Invoke-Step -Name 'CLI smoke: deps list' -Action {
  Run-Cmd -Command 'node packages/cli/bin/aspectcode.js deps list --file packages/cli/src/main.ts --quiet' -WorkingDirectory $repoRoot
}

$results += Invoke-Step -Name 'JSON purity check' -Action {
  $tmpJson = Join-Path $env:TEMP 'aspectcode-smoke.json'
  $tmpErr = Join-Path $env:TEMP 'aspectcode-smoke.err.log'
  if (Test-Path $tmpJson) { Remove-Item $tmpJson -Force }
  if (Test-Path $tmpErr) { Remove-Item $tmpErr -Force }

  $cmd = "node packages/cli/bin/aspectcode.js g --json 1> `"$tmpJson`" 2> `"$tmpErr`""
  Run-Cmd -Command $cmd -WorkingDirectory $repoRoot

  $raw = Get-Content $tmpJson -Raw
  $null = $raw | ConvertFrom-Json
  if (-not $raw.TrimStart().StartsWith('{')) {
    throw 'JSON output file does not look like a JSON object.'
  }
}

$results += Invoke-Step -Name 'Unknown flag warning path' -Action {
  Run-Cmd -Command 'node packages/cli/bin/aspectcode.js gen --bogus-flag --quiet' -WorkingDirectory $repoRoot
}

$results += Invoke-Step -Name 'No-color path' -Action {
  Run-Cmd -Command 'node packages/cli/bin/aspectcode.js gen --no-color --quiet' -WorkingDirectory $repoRoot
}

if ($IncludePack) {
  $results += Invoke-Step -Name 'CLI npm pack dry run' -Action {
    Run-Cmd -Command 'npm pack --dry-run' -WorkingDirectory (Join-Path $repoRoot 'packages/cli')
  }
}

if ($IncludeExtension) {
  $results += Invoke-Step -Name 'Extension compile' -Action {
    Run-Cmd -Command 'npm run compile' -WorkingDirectory (Join-Path $repoRoot 'extension')
  }

  Write-Host "`nManual extension host verification:" -ForegroundColor Yellow
  Write-Host '1) Press F5 to launch Extension Development Host' -ForegroundColor Yellow
  Write-Host '2) Run Generate KB and Impact commands in the host window' -ForegroundColor Yellow
  Write-Host '3) Confirm .aspect files and instruction files are generated' -ForegroundColor Yellow
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$results | ForEach-Object {
  if ($_.Status -eq 'PASS') {
    Write-Host "PASS  $($_.Name)" -ForegroundColor Green
  } else {
    Write-Host "FAIL  $($_.Name)" -ForegroundColor Red
  }
}

$failed = @($results | Where-Object { $_.Status -eq 'FAIL' }).Count
if ($failed -gt 0) {
  Write-Host "`n$failed step(s) failed." -ForegroundColor Red
  exit 1
}

Write-Host "`nAll checklist steps passed." -ForegroundColor Green
exit 0