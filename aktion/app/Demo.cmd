@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Users\jaros\Tools\nodejs\node.exe" (
    "C:\Users\jaros\Tools\nodejs\node.exe" server.mjs --demo
  ) else (
    echo Node.js 22+ nebyl nalezen.
  )
) else (
  node server.mjs --demo
)
pause
