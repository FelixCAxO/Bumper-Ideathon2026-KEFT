$ErrorActionPreference = "Stop"

$baseUrl = $env:BUMPER_RECEIVER_BASE_URL
if ([string]::IsNullOrWhiteSpace($baseUrl)) {
  $baseUrl = "http://127.0.0.1:8787"
}
$baseUrl = $baseUrl.TrimEnd("/")

$interval = 2
$intervalText = $env:BUMPER_RECEIVER_INTERVAL_SECONDS
$parsedInterval = 0
if (
  -not [string]::IsNullOrWhiteSpace($intervalText) -and
  [int]::TryParse($intervalText, [ref]$parsedInterval) -and
  $parsedInterval -ge 1
) {
  $interval = $parsedInterval
}

$seenAlerts = @{}
$lastGames = @{}
$initialized = $false
$lastWaitingMessage = $null

function Write-WaitingMessage {
  param(
    [string]$Message
  )

  if ($script:lastWaitingMessage -eq $Message) {
    return
  }

  Write-Host ("[waiting] " + $Message) -ForegroundColor DarkYellow
  $script:lastWaitingMessage = $Message
}

function Get-ConnectionMessage {
  param(
    [Exception]$Exception
  )

  $webException = $Exception
  if ($Exception.InnerException) {
    $webException = $Exception.InnerException
  }

  if ($webException -is [System.Net.WebException]) {
    $status = $webException.Status
    if ($null -eq $webException.Response) {
      return "No Worker is reachable at $baseUrl. Start local dev with 'npm run dev' in another terminal, or run this script with your deployed Worker URL."
    }
    if (
      $status -eq [System.Net.WebExceptionStatus]::ConnectFailure -or
      $status -eq [System.Net.WebExceptionStatus]::NameResolutionFailure -or
      $status -eq [System.Net.WebExceptionStatus]::ProxyNameResolutionFailure
    ) {
      return "No Worker is reachable at $baseUrl. Start local dev with 'npm run dev' in another terminal, or run this script with your deployed Worker URL."
    }
  }

  if ($Exception.Message -match "ansluta|connect|timed out|remote server|fjärrserver|fj.rrserver|actively refused|NameResolution|could not be resolved") {
    return "No Worker is reachable at $baseUrl. Start local dev with 'npm run dev' in another terminal, or run this script with your deployed Worker URL."
  }

  return $Exception.Message
}

while ($true) {
  try {
    $state = Invoke-RestMethod `
      -Method Get `
      -Uri ($baseUrl + "/api/demo/terminal-events") `
      -Headers @{ Accept = "application/json" } `
      -TimeoutSec 15

    foreach ($child in @($state.children)) {
      $childId = [string]$child.childId
      $displayName = [string]$child.displayName
      $game = $child.gameStatus.currentGame
      $gameId = [string]$game.id
      $gameLabel = [string]$game.label

      if (-not $lastGames.ContainsKey($childId)) {
        $lastGames[$childId] = $gameId
      } elseif ($lastGames[$childId] -ne $gameId) {
        $lastGames[$childId] = $gameId
        Write-Host ("[game] " + $displayName + " -> " + $gameLabel + " (" + $gameId + ")") -ForegroundColor Cyan
      }
    }

    foreach ($alert in (@($state.alerts) | Sort-Object -Property createdAt)) {
      $alertKey = if ($alert.eventId) {
        [string]$alert.childId + ":" + [string]$alert.eventId
      } else {
        [string]$alert.id
      }

      if (-not $seenAlerts.ContainsKey($alertKey)) {
        $seenAlerts[$alertKey] = $true
        if ($initialized) {
          Write-Host ("[trigger] " + $alert.label + " [" + $alert.riskLevel + "] " + $alert.platform + "/" + $alert.eventType) -ForegroundColor Yellow
          Write-Host ("          " + $alert.parentAction)
        }
      }
    }

    if (-not $initialized) {
      Write-Host ("[ready] Tracking " + @($state.children).Count + " children; " + @($state.alerts).Count + " existing alerts known.") -ForegroundColor Green
      $initialized = $true
      $lastWaitingMessage = $null
    }
  } catch {
    Write-WaitingMessage -Message (Get-ConnectionMessage -Exception $_.Exception)
  }

  Start-Sleep -Seconds $interval
}
