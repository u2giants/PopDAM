@echo off
echo ============================================
echo   PopDAM Windows Render Agent - Setup
echo ============================================
echo.

:: Check if running from the right directory
if not exist "package.json" (
    echo ERROR: Run this from the windows-agent folder.
    echo   cd C:\popdam\PopDAM\windows-agent
    echo   .\setup.bat
    pause
    exit /b 1
)

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Install it from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Check Illustrator
if exist "C:\Program Files\Adobe\Adobe Illustrator 2026\Support Files\Contents\Windows\Illustrator.exe" (
    echo [OK] Illustrator 2026 found
) else (
    echo [WARN] Illustrator not found at expected path.
    echo        If it's installed elsewhere, edit ILLUSTRATOR_PATH in .env
)

:: Check NAS access
if exist "\\edgesynology2\mac" (
    echo [OK] NAS share \\edgesynology2\mac is accessible
) else (
    echo [WARN] Cannot reach \\edgesynology2\mac -- make sure Tailscale is running
)

:: Create .env if missing
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [OK] Created .env from template
        echo [ACTION NEEDED] Edit .env with your credentials:
        echo     notepad "%~dp0.env"
    ) else (
        echo [WARN] No .env or .env.example found
    )
) else (
    echo [OK] .env file exists
)

:: Install dependencies
echo.
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)
echo [OK] Dependencies installed

:: Build
echo.
echo Building...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
echo [OK] Build complete

:: Create data directory
if not exist "data\renders" mkdir data\renders
echo [OK] Data directory ready

echo.
echo ============================================
echo   Setup complete! To start the agent, run:
echo     .\start.bat
echo   Or double-click start.bat
echo ============================================
pause
