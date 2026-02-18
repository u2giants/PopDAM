@echo off
cd /d "%~dp0"

:: Check .env exists
if not exist ".env" (
    echo [ERROR] .env file is missing!
    echo.
    echo Creating .env from .env.example...
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [OK] .env created. Please edit it with your credentials:
        echo     notepad "%~dp0.env"
        echo.
        echo Then run this script again.
        pause
        exit /b 1
    ) else (
        echo [ERROR] .env.example is also missing. Re-run: git pull
        pause
        exit /b 1
    )
)

:: Mount NAS share if not already accessible
if not exist "\\edgesynology2\mac" (
    echo Mounting NAS share...
    net use \\edgesynology2\mac /user:popdam "D@Mp0p123" /persistent:no >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Could not mount NAS share. Check credentials or Tailscale.
    ) else (
        echo [OK] NAS share mounted
    )
) else (
    echo [OK] NAS share already accessible
)

echo Starting PopDAM Render Agent...
node dist/index.js
pause
