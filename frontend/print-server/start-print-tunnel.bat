@echo off
setlocal enabledelayedexpansion
title Print Server + Cloudflare Tunnel
color 0A

echo.
echo  ========================================
echo   PRINT SERVER + CLOUDFLARE TUNNEL
echo   print.autohoteluxor.com
echo  ========================================
echo.

REM Crear directorio de logs si no existe
if not exist "%~dp0logs" mkdir "%~dp0logs"

REM Matar procesos anteriores si existen
echo [*] Limpiando procesos anteriores...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Iniciar print-server en segundo plano
echo [1/2] Iniciando Print Server...
cd /d "%~dp0"
start /B cmd /c "node index.js > logs\print-server.log 2>&1"

REM Esperar a que el servidor inicie
timeout /t 3 /nobreak >nul

REM Verificar que el servidor este corriendo
curl -s http://localhost:3001/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] El print-server no inicio correctamente
    echo Revisa el archivo logs\print-server.log
    pause
    exit /b 1
)
echo [OK] Print Server corriendo en puerto 3001

REM Iniciar Cloudflare Named Tunnel
echo [2/2] Iniciando Cloudflare Tunnel (Named)...
echo.

REM Iniciar cloudflared con config.yml
start /B cmd /c ""C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --config "%~dp0config.yml" run > logs\tunnel.log 2>&1"

REM Esperar a que el tunel se conecte
timeout /t 5 /nobreak >nul

echo.
echo  ========================================
echo   TUNEL ACTIVO (URL FIJA)
echo  ========================================
echo.
echo   URL PUBLICA:
echo   https://print.autohoteluxor.com
echo.
echo   Esta URL es permanente, no cambia
echo   al reiniciar la PC.
echo.
echo   Variable en Vercel:
echo   NEXT_PUBLIC_PRINT_SERVER_URL=https://print.autohoteluxor.com
echo  ========================================
echo.

echo Los servicios estan corriendo en segundo plano.
echo Presiona cualquier tecla para DETENER todo...
pause >nul

REM Limpiar
echo.
echo Deteniendo servicios...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1
echo Servicios detenidos. Adios!
