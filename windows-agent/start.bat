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

echo Starting PopDAM Render Agent...
node dist/index.js
pause
