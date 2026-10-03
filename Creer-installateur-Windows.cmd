@echo off
setlocal DisableDelayedExpansion
title NovaUnlock - Creer l'installateur Windows

rem Always work in the project, including when launched from Explorer or another drive.
pushd "%~dp0"
if errorlevel 1 (
  echo Impossible d'ouvrir le dossier du projet.
  pause
  exit /b 1
)

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js x64 est requis sur le PC qui fabrique l'installateur.
  echo Installez une version LTS compatible depuis https://nodejs.org
  echo Branche 22 : 22.22.2 ou plus. Branche 24 : 24.15.0 ou plus.
  echo Fermez cette fenetre, puis double-cliquez de nouveau sur ce fichier.
  popd
  pause
  exit /b 1
)

node.exe scripts\package-windows.cjs
set "NOVAUNLOCK_EXIT=%ERRORLEVEL%"
popd

echo.
rem Keep the output visible both on success and failure for non-technical users.
pause
exit /b %NOVAUNLOCK_EXIT%
