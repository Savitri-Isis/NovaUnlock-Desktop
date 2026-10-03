@echo off
setlocal DisableDelayedExpansion
title NovaUnlock - Construire les outils iOS Windows

rem The upstream toolchain is built locally with MSYS2; this does not download
rem precompiled libimobiledevice executables.
if not defined MSYS2_ROOT set "MSYS2_ROOT=C:\msys64"
if not exist "%MSYS2_ROOT%\usr\bin\bash.exe" (
  echo MSYS2 x64 est introuvable dans "%MSYS2_ROOT%".
  echo Installez MSYS2 depuis https://www.msys2.org/ ou definissez MSYS2_ROOT.
  echo Puis ouvrez l'environnement UCRT64 et mettez MSYS2 a jour avec pacman -Syu.
  echo Relancez ensuite ce fichier.
  pause
  exit /b 1
)

rem Select the x64 UCRT environment while retaining Node.js and Git if present.
set "MSYSTEM=UCRT64"
set "MSYS2_PATH_TYPE=inherit"
set "CHERE_INVOKING=1"
set "PATH=%MSYS2_ROOT%\ucrt64\bin;%MSYS2_ROOT%\usr\bin;%PATH%"

"%MSYS2_ROOT%\usr\bin\bash.exe" --login "%~dp0scripts\build-native-msys2.sh"
set "NOVAUNLOCK_EXIT=%ERRORLEVEL%"

echo.
if "%NOVAUNLOCK_EXIT%"=="0" (
  echo Les outils sont prets. Lancez maintenant Creer-installateur-Windows.cmd.
) else (
  echo La compilation native a echoue. Consultez les messages et .native-build\logs.
)
pause
exit /b %NOVAUNLOCK_EXIT%
