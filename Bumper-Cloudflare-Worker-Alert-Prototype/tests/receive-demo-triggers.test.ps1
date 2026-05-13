$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$receiver = Join-Path $repoRoot "receive-demo-triggers.bat"
$runId = [Guid]::NewGuid().ToString("N")
$stdoutPath = Join-Path ([IO.Path]::GetTempPath()) "bumper-receiver-$runId.out"
$stderrPath = Join-Path ([IO.Path]::GetTempPath()) "bumper-receiver-$runId.err"

try {
  $process = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList @("/d", "/c", "`"$receiver`" http://127.0.0.1:1 1") `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -WindowStyle Hidden `
    -PassThru

  Start-Sleep -Seconds 3

  $stdout = if (Test-Path $stdoutPath) { Get-Content -Raw $stdoutPath } else { "" }
  $stderr = if (Test-Path $stderrPath) { Get-Content -Raw $stderrPath } else { "" }
  $combined = "$stdout`n$stderr"

  if ($process.HasExited) {
    throw "receive-demo-triggers.bat exited early with code $($process.ExitCode). Output:`n$combined"
  }

  if ($combined -match "ParserError|Missing closing|not recognized as an internal or external command") {
    throw "receive-demo-triggers.bat emitted shell parser errors:`n$combined"
  }

  if ($combined -notmatch "\[waiting\]") {
    throw "receive-demo-triggers.bat did not reach its polling loop. Output:`n$combined"
  }

  if ($combined -notmatch "No Worker is reachable at http://127.0.0.1:1") {
    throw "receive-demo-triggers.bat did not explain the missing Worker server. Output:`n$combined"
  }
} finally {
  if ($process -and -not $process.HasExited) {
    & taskkill /PID $process.Id /T /F | Out-Null
  }
  Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
}
