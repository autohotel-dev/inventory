@echo off
title Tuya Sensor Monitor - Local
cd /d "C:\Users\autoh\Documents\GitHub\inventory"
echo ========================================
echo   Iniciando Monitor de Sensores Tuya
echo ========================================
echo.
python scripts/tuya-poll-local.py
echo.
echo [Presiona cualquier tecla para cerrar...]
pause > nul
