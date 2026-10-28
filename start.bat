@echo off
TITLE CYBERAIL - Dynamic Train Ticket and Waitlist System
color 0B
echo ==============================================================================
echo                CYBERAIL // DYNAMIC ORACLE TRANSIT ENGINE
echo ==============================================================================
echo.
echo [1/3] Checking Node.js environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on PATH. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo      Node.js is detected!

echo.
echo [2/3] Checking optional Express & OracleDB packages...
echo      (Running natively in zero-dependency ultra-fast mode)

echo.
echo [3/3] Launching CYBERAIL Server on http://localhost:3000 ...
echo ==============================================================================
echo.
start http://localhost:3000
node server.js
pause
