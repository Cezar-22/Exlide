@echo off
rem "exlide" command: starts the Exlide dev server and opens it in Edge.
rem bin\ is on the user PATH, so this works from any cmd or PowerShell window.
rem Set EXLIDE_NO_BROWSER=1 to skip opening the browser.
setlocal
cd /d "%~dp0.."
if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm install || exit /b 1
)
if not "%EXLIDE_NO_BROWSER%"=="1" (
  start "" /min cmd /c "timeout /t 3 >nul & start msedge http://localhost:5173/"
)
call npm run dev
