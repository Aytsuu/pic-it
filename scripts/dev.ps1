# Starts the local Pic It stack in one shot:
#   1. npm install             (stops the script if it fails)
#   2. supabase start          (blocks until containers are healthy, then returns)
#   3. ngrok http 54321        (new window, stays open)
#   4. npx expo start          (this window, stays open)
#
# Usage from the repo root:
#   npm run stack
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
#
# Skip a piece that's already running:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -SkipSupabase
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -SkipNgrok

param(
  [switch]$SkipSupabase,
  [switch]$SkipNgrok
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing '$Name'. Install it, then run this script again."
  }
}

function Test-SupabaseApi {
  $client = $null
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $connected = $client.BeginConnect('127.0.0.1', 54321, $null, $null)
    $ready = $connected.AsyncWaitHandle.WaitOne(3000, $false)
    if (-not $ready) { return $false }
    $client.EndConnect($connected)
    return $true
  } catch {
    return $false
  } finally {
    if ($client) { $client.Close() }
  }
}

function Get-DotEnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match "^\s*#") { continue }
    if ($line -match "^\s*$Key=(.*)$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

Assert-Command 'npm'
Assert-Command 'npx'
if (-not $SkipSupabase) { Assert-Command 'supabase' }
if (-not $SkipNgrok) { Assert-Command 'ngrok' }

Write-Host 'Installing dependencies...'
& npm install
if ($LASTEXITCODE -ne 0) {
  Write-Host 'npm install failed. Not starting Supabase, ngrok, or Expo.' -ForegroundColor Red
  exit 1
}

if (-not $SkipSupabase) {
  Write-Host 'Starting Supabase...'
  & supabase start
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Supabase failed to start. Not starting ngrok or Expo.' -ForegroundColor Red
    exit 1
  }
}

if (-not (Test-SupabaseApi)) {
  Write-Host 'Supabase is not running on 127.0.0.1:54321. Not starting ngrok or Expo.' -ForegroundColor Red
  exit 1
}

if (-not $SkipNgrok) {
  $publicUrl = Get-DotEnvValue (Join-Path $repoRoot '.env.local') 'EXPO_PUBLIC_SUPABASE_URL'
  $ngrokCommand = 'ngrok http 54321'
  if ($publicUrl -and $publicUrl -match 'ngrok') {
    $ngrokCommand = "ngrok http 54321 --url=$publicUrl"
    Write-Host "Starting ngrok on the URL in .env.local"
  } else {
    Write-Host 'Starting ngrok (copy the https URL into .env.local if it changed)'
  }

  Start-Process -FilePath 'powershell.exe' `
    -WorkingDirectory $repoRoot `
    -ArgumentList '-NoExit', '-NoProfile', '-Command', $ngrokCommand
}

Write-Host 'Starting Expo...'
npx expo start -c
exit $LASTEXITCODE
