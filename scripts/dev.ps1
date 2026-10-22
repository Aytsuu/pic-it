# Starts the local Pic It stack in one shot:
#   1. npm install             (stops the script if it fails)
#   2. Docker Desktop          (starts the engine; the dashboard window is not left open)
#   3. supabase start          (blocks until containers are healthy, then returns)
#   4. ngrok http 54321        (new window, stays open)
#   5. npx expo start          (this window, stays open)
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

function Test-DockerEngine {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & docker info 1>$null 2>$null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Get-DockerDesktopExe {
  $candidates = @()
  if ($env:ProgramFiles) {
    $candidates += Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  }
  if (${env:ProgramFiles(x86)}) {
    $candidates += Join-Path ${env:ProgramFiles(x86)} 'Docker\Docker\Docker Desktop.exe'
  }
  if ($env:LocalAppData) {
    $candidates += Join-Path $env:LocalAppData 'Docker\Docker Desktop.exe'
  }

  foreach ($path in $candidates) {
    if (Test-Path -LiteralPath $path) { return $path }
  }
  return $null
}

function Close-DockerDesktopWindow {
  if (-not ('PicItDockerWindow' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class PicItDockerWindow {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumProc callback, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")]
  public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
  public const uint WM_CLOSE = 0x0010;
}
'@
  }

  $closed = New-Object System.Collections.Generic.List[string]
  $enum = [PicItDockerWindow+EnumProc]{
    param($hWnd, $lParam)
    if (-not [PicItDockerWindow]::IsWindowVisible($hWnd)) { return $true }
    $title = New-Object System.Text.StringBuilder 512
    [void][PicItDockerWindow]::GetWindowText($hWnd, $title, $title.Capacity)
    if ($title.ToString() -notlike '*Docker Desktop*') { return $true }
    $processId = [uint32]0
    [void][PicItDockerWindow]::GetWindowThreadProcessId($hWnd, [ref]$processId)
    $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $proc -or $proc.ProcessName -ne 'Docker Desktop') { return $true }
    [void][PicItDockerWindow]::PostMessage($hWnd, [PicItDockerWindow]::WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero)
    $closed.Add($title.ToString())
    return $true
  }

  $script:PicItDockerWindowEnum = $enum
  [void][PicItDockerWindow]::EnumWindows($enum, [IntPtr]::Zero)
  if ($closed.Count -gt 0) {
    Write-Host 'Closed the Docker Desktop window. The engine is still running.'
  }
}

function Start-DockerDesktop {
  if (Test-DockerEngine) {
    Write-Host 'Docker is already running.'
    return
  }

  $exe = Get-DockerDesktopExe
  if (-not $exe) {
    throw "Missing 'Docker Desktop'. Install it, then run this script again."
  }

  Write-Host 'Starting Docker Desktop...'
  $launched = $false
  try {
    # -Autostart is the login shortcut: engine up, dashboard stays closed.
    Start-Process -FilePath $exe -ArgumentList '-Autostart' -ErrorAction Stop
    $launched = $true
  } catch {
    Write-Host "Docker Desktop is already running or could not be launched again ($($_.Exception.Message)). Continuing." -ForegroundColor Yellow
  }

  if (-not (Test-DockerEngine)) {
    Write-Host 'Waiting for Docker engine...'
    $deadline = (Get-Date).AddMinutes(3)
    do {
      Start-Sleep -Seconds 3
    } while (-not (Test-DockerEngine) -and (Get-Date) -lt $deadline)
  }

  if (-not (Test-DockerEngine)) {
    Write-Host 'Docker Desktop did not become ready in time. Not starting Supabase, ngrok, or Expo.' -ForegroundColor Red
    exit 1
  }

  Write-Host 'Docker is ready.'
  if ($launched) {
    Close-DockerDesktopWindow
    if (-not (Test-DockerEngine)) {
      Write-Host 'Docker stopped when the window closed. Not starting Supabase, ngrok, or Expo.' -ForegroundColor Red
      exit 1
    }
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

if ($MyInvocation.InvocationName -ne '.') {
  Assert-Command 'npm'
  Assert-Command 'npx'
  if (-not $SkipSupabase) {
    Assert-Command 'docker'
    Assert-Command 'supabase'
  }
  if (-not $SkipNgrok) { Assert-Command 'ngrok' }

  Write-Host 'Installing dependencies...'
  & npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'npm install failed. Not starting Supabase, ngrok, or Expo.' -ForegroundColor Red
    exit 1
  }

  if (-not $SkipSupabase) {
    Start-DockerDesktop
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
}
