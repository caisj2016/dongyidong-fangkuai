@echo off
setlocal
cd /d "%~dp0"

set "PORT=8080"
set "URL=http://localhost:%PORT%"

echo Project folder: %cd%
echo URL: %URL%
echo.

where py >nul 2>nul
if not errorlevel 1 goto use_py

where python >nul 2>nul
if not errorlevel 1 goto use_python

echo Python was not found.
echo Please install Python, then try again.
pause
exit /b 1

:use_py
echo Starting local server with py...
start "DongYiDong Server" cmd /k "cd /d ""%~dp0"" && py -m http.server %PORT%"
goto open_browser

:use_python
echo Starting local server with python...
start "DongYiDong Server" cmd /k "cd /d ""%~dp0"" && python -m http.server %PORT%"

:open_browser
timeout /t 2 >nul
start "" %URL%
echo.
echo The server is running in a new command window.
echo Close that server window when you want to stop it.
pause
