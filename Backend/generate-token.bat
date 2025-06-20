@echo off
cd /d "%~dp0"
echo.
echo X-Cite Backend JWT Token Generator
echo ==================================
echo.
node generate-token.js %*
echo.
pause
