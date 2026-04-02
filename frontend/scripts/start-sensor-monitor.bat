@echo off
TITLE Tuya Local Sensor Monitor (DO NOT CLOSE)
cd /d "C:\Users\hackm\OneDrive\Documentos\Desarrollos Frontend\Inventory\inventory"
echo Starting Tuya Local Monitor...
python scripts/tuya-poll-local.py
pause
