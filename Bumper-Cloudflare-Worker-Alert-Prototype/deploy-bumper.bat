@echo off
setlocal

cd /d "%~dp0"

if /I "%~1"=="--help" goto usage
if /I "%~1"=="/?" goto usage
if /I "%~1"=="--check" goto check
if /I "%~1"=="--dry-run" goto check

echo.
echo Bumper Cloudflare deploy
echo.

call :run npm install || goto fail
call :run npx wrangler whoami || goto login_help
call :run npm test || goto fail
call :run npm run typecheck || goto fail
call :run npx wrangler deploy --dry-run --outdir dist || goto fail

echo.
choice /C YN /M "Set or rotate DEMO_API_KEY now"
if errorlevel 2 goto skip_secret
call :run npx wrangler secret put DEMO_API_KEY || goto fail

:skip_secret
echo.
echo For browser demo controls, also set these secrets once if they are missing:
echo   npx wrangler secret put DEMO_TRIGGER_KEY
echo   npx wrangler secret put DEMO_PAGE_PASSWORD
call :run npx wrangler d1 migrations apply bumper-db --remote || goto fail
call :run npm run deploy || goto fail

echo.
echo Deployment finished. Copy the workers.dev URL printed above.
echo Test it with:
echo   curl YOUR_WORKER_URL/api/health
echo   curl YOUR_WORKER_URL/api/dashboard/child_alex
exit /b 0

:check
echo.
echo Bumper Cloudflare deploy check
echo.
call :run npm install || goto fail
call :run npm test || goto fail
call :run npm run typecheck || goto fail
call :run npx wrangler deploy --dry-run --outdir dist || goto fail
echo.
echo Check finished. No remote migration or deploy was performed.
exit /b 0

:run
echo.
echo ^> %*
call %*
if errorlevel 1 (
  echo.
  echo Command failed: %*
  exit /b 1
)
exit /b 0

:login_help
echo.
echo Wrangler is not logged in. Run this once, then rerun deploy-bumper.bat:
echo   npx wrangler login
exit /b 1

:usage
echo.
echo Usage:
echo   deploy-bumper.bat          Validate, optionally set secret, migrate D1, and deploy
echo   deploy-bumper.bat --check  Validate locally and run Wrangler dry-run only
echo.
exit /b 0

:fail
echo.
echo Deployment stopped before making later changes.
exit /b 1
