@echo off
title Tuya Sensor Monitor - Local (Node.js)
cd /d "C:\Users\autoh\Documents\GitHub\inventory\frontend"
echo ===================================================
echo   Iniciando Monitor de Sensores Tuya (Node.js Local)
echo ===================================================
echo.
node scripts/tuya-poll-local-multi.js
echo.
echo [Presiona cualquier tecla para cerrar...]
pause > nul

