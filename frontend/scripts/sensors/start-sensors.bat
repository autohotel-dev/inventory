@echo off
title Luxor - Sensores de puertas (NO CERRAR)
REM Arranca el daemon de sensores sin PM2. Con PM2 usar: pm2 start ecosystem.config.js
cd /d "%~dp0..\.."
echo Iniciando daemon de sensores Tuya (LAN)...
node scripts\sensors\daemon.js
echo.
echo [El daemon se detuvo. Presiona cualquier tecla para cerrar...]
pause > nul
