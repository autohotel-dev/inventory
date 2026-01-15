@echo off
setlocal enabledelayedexpansion
title Print Server + Cloudflare Tunnel
color 0A

echo.
echo  ========================================
echo   PRINT SERVER + CLOUDFLARE TUNNEL
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

REM Iniciar Cloudflare Tunnel
echo [2/2] Iniciando Cloudflare Tunnel...
echo.
echo Esperando URL del tunel...

REM Archivo para capturar la URL
set "URL_FILE=%~dp0TUNNEL_URL.txt"
set "TEMP_LOG=%~dp0logs\tunnel.log"

REM Iniciar cloudflared en segundo plano con output a archivo
start /B cmd /c ""C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3001 > "%TEMP_LOG%" 2>&1"

REM Esperar a que aparezca la URL (max 20 segundos)
set "TUNNEL_URL="
for /L %%i in (1,1,20) do (
    timeout /t 1 /nobreak >nul
    for /f "tokens=*" %%a in ('findstr /C:"trycloudflare.com" "%TEMP_LOG%" 2^>nul') do (
        set "LINE=%%a"
    )
    if defined LINE (
        for %%b in (!LINE!) do (
            echo %%b | findstr /C:"https://" >nul && set "TUNNEL_URL=%%b"
        )
    )
    if defined TUNNEL_URL goto :found
    echo|set /p="."
)
echo.

:found
if not defined TUNNEL_URL (
    color 0E
    echo.
    echo [ADVERTENCIA] No se pudo capturar la URL automaticamente.
    echo Revisa el archivo logs\tunnel.log para ver la URL.
    echo.
) else (
    REM Limpiar caracteres extra de la URL
    set "TUNNEL_URL=!TUNNEL_URL:|=!"
    
    REM Guardar URL en archivo
    echo !TUNNEL_URL!> "%URL_FILE%"
    
    echo.
    echo  ========================================
    echo   TUNEL ACTIVO
    echo  ========================================
    echo.
    echo   URL PUBLICA:
    echo   !TUNNEL_URL!
    echo.
    echo   Guardada en: TUNNEL_URL.txt
    echo  ========================================
    echo.
    echo   Para Vercel, configura:
    echo   NEXT_PUBLIC_PRINT_SERVER_URL=!TUNNEL_URL!
    echo.
)

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
