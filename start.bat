@echo off
chcp 65001 >nul
title BobGarden - serwer z panelem
cd /d "%~dp0"

rem --- Czy Node.js jest zainstalowany? ---
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Brak Node.js na tym komputerze.
  echo  Otwieram strone nodejs.org - pobierz wersje LTS, zainstaluj,
  echo  a potem uruchom ten plik jeszcze raz.
  echo.
  start "" https://nodejs.org
  pause
  exit /b
)

rem --- Pierwsze uruchomienie: instalacja Expressa ---
if not exist "node_modules\express" (
  echo  Pierwsze uruchomienie - instaluje potrzebne pliki, chwile to potrwa...
  call npm install
)

rem --- Po 2 sekundach otworz panel w przegladarce ---
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000/admin"

echo.
echo  Nie zamykaj tego okna, dopoki pracujesz w panelu.
echo  Aby zatrzymac serwer: Ctrl + C albo zamknij okno.
echo.
node server.js
pause
