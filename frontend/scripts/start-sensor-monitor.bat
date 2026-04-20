@echo off
TITLE Tuya Local Sensor Monitor (DO NOT CLOSE)
cd /d "C:\Users\autoh\Documents\GitHub\inventory\frontend"
echo Starting Tuya Local Monitor...
python scripts/tuya-poll-local.py
pause
