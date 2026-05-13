@echo off
setlocal

cd /d "%~dp0"

if /I "%~1"=="--help" goto usage
if /I "%~1"=="/?" goto usage

set "CHECK_ONLY=0"
if /I "%~1"=="--check" set "CHECK_ONLY=1"
if /I "%~1"=="--dry-run" set "CHECK_ONLY=1"

echo.
echo Bumper Worker update
echo.

echo.
echo ^> npx wrangler --version
call npx wrangler --version
if errorlevel 1 goto fail

echo.
echo ^> npx wrangler whoami
call npx wrangler whoami
if errorlevel 1 goto login_help

echo.
echo ^> npm test
call npm test
if errorlevel 1 goto fail

echo.
echo ^> npm run typecheck
call npm run typecheck
if errorlevel 1 goto fail

echo.
echo ^> npx wrangler deploy --dry-run --outdir dist
call npx wrangler deploy --dry-run --outdir dist
if errorlevel 1 goto fail

if "%CHECK_ONLY%"=="1" goto check_done

echo.
echo ^> npx wrangler d1 migrations apply bumper-db --remote
call npx wrangler d1 migrations apply bumper-db --remote
if errorlevel 1 goto fail

echo.
echo ^> npm run deploy
call npm run deploy
if errorlevel 1 goto fail

echo.
echo Worker update finished.
echo If demo buttons or demo page auth return 401, set the remote demo secrets once:
echo   npx wrangler secret put DEMO_TRIGGER_KEY
echo   npx wrangler secret put DEMO_PAGE_PASSWORD
exit /b 0

:check_done
echo.
echo Check finished. No deploy was performed.
exit /b 0

:login_help
echo.
echo Wrangler is not logged in. Run this once, then rerun update-worker.bat:
echo   npx wrangler login
exit /b 1

:usage
echo.
echo Usage:
echo   update-worker.bat          Test, typecheck, dry-run, migrate D1, then deploy
echo   update-worker.bat --check  Test, typecheck, and dry-run only
echo.
exit /b 0

:fail
echo.
echo Worker update stopped before completing deploy.
exit /b 1
