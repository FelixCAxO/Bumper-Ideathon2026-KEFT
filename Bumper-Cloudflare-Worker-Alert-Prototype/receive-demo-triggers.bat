@echo off
setlocal

cd /d "%~dp0"

if /I "%~1"=="--help" goto usage
if /I "%~1"=="/?" goto usage

set "BASE_URL=%~1"
if "%BASE_URL%"=="" set "BASE_URL=%BUMPER_DEMO_URL%"
if "%BASE_URL%"=="" set "BASE_URL=http://127.0.0.1:8787"

set "INTERVAL_SECONDS=%~2"
if "%INTERVAL_SECONDS%"=="" set "INTERVAL_SECONDS=%BUMPER_DEMO_INTERVAL_SECONDS%"
if "%INTERVAL_SECONDS%"=="" set "INTERVAL_SECONDS=2"

set "BUMPER_RECEIVER_BASE_URL=%BASE_URL%"
set "BUMPER_RECEIVER_INTERVAL_SECONDS=%INTERVAL_SECONDS%"

echo.
echo Bumper demo terminal receiver
echo.
echo Base URL: %BASE_URL%
echo Poll interval: %INTERVAL_SECONDS%s
echo.
echo Open %BASE_URL%/demo and press game or trigger buttons.
echo Press Ctrl+C to stop.
echo.

if not exist "%~dp0receive-demo-triggers.ps1" goto missing_script

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0receive-demo-triggers.ps1"
if errorlevel 1 goto fail
exit /b 0

:usage
echo.
echo Usage:
echo   receive-demo-triggers.bat [base-url] [poll-seconds]
echo.
echo Examples:
echo   receive-demo-triggers.bat
echo   receive-demo-triggers.bat http://127.0.0.1:8787 2
echo   receive-demo-triggers.bat https://bumper-api.example.workers.dev 3
echo.
echo Environment fallbacks:
echo   BUMPER_DEMO_URL
echo   BUMPER_DEMO_INTERVAL_SECONDS
echo.
exit /b 0

:missing_script
echo.
echo Missing receiver helper: %~dp0receive-demo-triggers.ps1
exit /b 1

:fail
echo.
echo Receiver stopped because PowerShell returned an error.
exit /b 1
