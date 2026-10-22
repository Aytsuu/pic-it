# Stops the local Pic It stack:
#   1. Expo dev server         (this repo's expo start / @expo/cli, plus Metro children)
#   2. ngrok                   (ngrok.exe and the extra PowerShell window)
#   3. supabase stop           (continues if the stack is already stopped)
#   4. Docker Desktop          (only with --docker-quit or -dq, after Supabase stops)
#
# Usage from the repo root:
#   npm run stop
#   npm run stop --docker-quit
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1 --docker-quit
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1 -dq
#
# npm keeps --docker-quit for itself and sets npm_config_docker_quit=true.
# The short flag is not an npm option, so it still needs a separator:
#   npm run stop -- -dq

function Get-QuitDockerRequested {
  param([string[]]$Arguments)

  $quitDocker = $env:npm_config_docker_quit -eq 'true'
  foreach ($arg in @($Arguments)) {
    switch ($arg) {
      '--docker-quit' { $quitDocker = $true }
      '-dq' { $quitDocker = $true }
      default { Write-Host "Unknown argument: $arg" -ForegroundColor Yellow }
    }
  }
  return $quitDocker
}

function Test-ExpoDevServerCommand([string]$Name, [string]$CommandLine) {
  if ($Name -notin @('node.exe', 'powershell.exe', 'pwsh.exe', 'cmd.exe')) { return $false }
  if (-not $CommandLine) { return $false }
  if ($CommandLine -match 'npm(-cli\.js|\.cmd)?\s+run\s+stop') { return $false }
  if ($CommandLine -match '@expo[\\/]cli') { return $true }
  if ($CommandLine -match '(?i)\bexpo(\.cmd|\.ps1|\.exe)?\s+start\b') { return $true }
  if ($CommandLine -match '(?i)[\\/]expo[\\/].*\bstart\b') { return $true }
  return $false
}

function Test-NgrokCommand([string]$Name, [string]$CommandLine) {
  if ($Name -eq 'ngrok.exe') { return $true }
  if (-not $CommandLine) { return $false }
  return $CommandLine -match '(?i)\bngrok\b.*\b54321\b'
}

function Get-ProtectedProcessIds {
  $ids = New-Object 'System.Collections.Generic.HashSet[int]'
  $procId = [int]$PID
  while ($procId -gt 0 -and $ids.Add($procId)) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue
    if (-not $proc) { break }
    $procId = [int]$proc.ParentProcessId
  }
  return $ids
}

function Stop-ProcessTree([int]$ProcessId) {
  & taskkill.exe /PID $ProcessId /T /F 2>&1 | Out-Null
  return $LASTEXITCODE -eq 0
}

function Stop-ProcessesWhere {
  param(
    [scriptblock]$Predicate,
    [System.Collections.Generic.HashSet[int]]$Protected
  )

  $stopped = @()
  $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
  foreach ($proc in $processes) {
    if (-not $proc) { continue }
    $processId = [int]$proc.ProcessId
    if ($Protected.Contains($processId)) { continue }
    if (-not (& $Predicate $proc)) { continue }
    if (Stop-ProcessTree -ProcessId $processId) {
      $stopped += $processId
    }
  }
  return $stopped
}

function Write-StopResult([string]$Label, [int[]]$ProcessIds) {
  if (-not $ProcessIds -or $ProcessIds.Count -eq 0) {
    Write-Host "No running $Label process found."
    return
  }

  $unique = @($ProcessIds | Select-Object -Unique)
  Write-Host "Stopped $Label (pid $($unique -join ', '))."
}

if ($MyInvocation.InvocationName -ne '.') {
  $ErrorActionPreference = 'Continue'
  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
  Set-Location $repoRoot

  $quitDocker = Get-QuitDockerRequested -Arguments @($args)
  $protected = Get-ProtectedProcessIds

  Write-Host 'Stopping Expo...'
  $expoIds = @(Stop-ProcessesWhere -Protected $protected -Predicate {
      param($proc)
      Test-ExpoDevServerCommand -Name $proc.Name -CommandLine $proc.CommandLine
    })
  Write-StopResult -Label 'Expo' -ProcessIds $expoIds

  Write-Host 'Stopping ngrok...'
  $ngrokIds = @(Stop-ProcessesWhere -Protected $protected -Predicate {
      param($proc)
      Test-NgrokCommand -Name $proc.Name -CommandLine $proc.CommandLine
    })
  Write-StopResult -Label 'ngrok' -ProcessIds $ngrokIds

  Write-Host 'Stopping Supabase...'
  if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "Missing 'supabase'. Skipping Supabase stop." -ForegroundColor Yellow
  } else {
    & supabase stop
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'Supabase was not running or failed to stop. Continuing.' -ForegroundColor Yellow
    }
  }

  if ($quitDocker) {
    Write-Host 'Quitting Docker Desktop...'
    $dockerCli = $null
    if ($env:ProgramFiles) {
      $dockerCli = Join-Path $env:ProgramFiles 'Docker\Docker\DockerCli.exe'
    }
    if (-not $dockerCli -or -not (Test-Path -LiteralPath $dockerCli)) {
      Write-Host 'Docker CLI was not found. Skipping Docker quit.' -ForegroundColor Yellow
    } else {
      try {
        & $dockerCli -Shutdown
        if ($LASTEXITCODE -ne 0) {
          Write-Host 'Docker Desktop was already quit or did not shut down. Continuing.' -ForegroundColor Yellow
        }
      } catch {
        Write-Host "Docker Desktop quit failed ($($_.Exception.Message)). Continuing." -ForegroundColor Yellow
      }
    }
  }

  exit 0
}
