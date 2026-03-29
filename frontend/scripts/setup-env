<#
.SYNOPSIS
    Instala Oh My Posh y configura la terminal sin instalar fuentes
.DESCRIPTION
    Este script automatiza la instalación de Oh My Posh y configura
    el perfil de PowerShell. Las fuentes deben instalarse manualmente.
.NOTES
    Versión: 1.3 (Sin fuentes)
    Autor: @SoyITPro
#>

# Elevar permisos si es necesario (solo para instalación de Oh My Posh)
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Solicitando permisos de administrador para instalar Oh My Posh..." -ForegroundColor Yellow
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "=== Script de instalación de Oh My Posh (Sin fuentes) ===" -ForegroundColor Cyan
Write-Host "Fecha: $(Get-Date)"`n

# 1. VERIFICACIÓN DE WINGET
Write-Host "1. Verificando Winget..." -ForegroundColor Cyan
if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "   ✓ Winget encontrado" -ForegroundColor Green
} else {
    Write-Host "   ✗ Winget no encontrado" -ForegroundColor Red
    Write-Host "   Solución:" -ForegroundColor Yellow
    Write-Host "   1. Abre Microsoft Store" -ForegroundColor Cyan
    Write-Host "   2. Busca 'App Installer'" -ForegroundColor Cyan
    Write-Host "   3. Instálalo o actualízalo" -ForegroundColor Cyan
    Write-Host "   4. Reinicia PowerShell y ejecuta este script nuevamente" -ForegroundColor Cyan
    exit
}

# 2. INSTALACIÓN DE OH MY POSH
Write-Host "`n2. Instalando Oh My Posh..." -ForegroundColor Cyan
try {
    winget install JanDeDobbeleer.OhMyPosh -s winget --accept-package-agreements --accept-source-agreements
    Write-Host "   ✓ Oh My Posh instalado correctamente" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Error instalando Oh My Posh: $_" -ForegroundColor Red
    Write-Host "   Intentando método alternativo..." -ForegroundColor Yellow
    
    # Método alternativo con PowerShell
    try {
        Install-Module oh-my-posh -Scope CurrentUser -Force
        Import-Module oh-my-posh
        Write-Host "   ✓ Oh My Posh instalado vía PowerShell Gallery" -ForegroundColor Green
    } catch {
        Write-Host "   ✗ Error crítico. Instalación manual requerida." -ForegroundColor Red
        Write-Host "   Visita: https://ohmyposh.dev/docs/installation" -ForegroundColor Cyan
        exit
    }
}

# 3. CONFIGURACIÓN DEL PERFIL DE POWERSHELL (Simplificada)
Write-Host "`n3. Configurando perfil de PowerShell..." -ForegroundColor Cyan

# Obtener ruta del perfil
$profilePath = $PROFILE.CurrentUserAllHosts  # Para todos los hosts de PowerShell
$profileDir = Split-Path $profilePath -Parent

# Crear directorio si no existe
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Configuración mínima de Oh My Posh
$poshConfig = @'
# === Configuración Oh My Posh ===
try {
    # Inicializar Oh My Posh con tema simple
    oh-my-posh init pwsh --config "$env:POSH_THEMES_PATH\jandedobbeleer.omp.json" | Invoke-Expression
} catch {
    Write-Warning "Oh My Posh no se pudo cargar. Verifica la instalación."
}

# Aliases útiles
function ll { Get-ChildItem -Force }
function grep($pattern) { Select-String -Pattern $pattern }

# Prompt más rápido (opcional)
$ENV:POSH_GIT_ENABLED = $true
'@

# Guardar configuración
$poshConfig | Out-File -FilePath $profilePath -Encoding UTF8
Write-Host "   ✓ Perfil configurado en:" -ForegroundColor Green
Write-Host "     $profilePath" -ForegroundColor Gray

# 4. VERIFICACIÓN DE INSTALACIÓN
Write-Host "`n4. Verificando instalación..." -ForegroundColor Cyan

$checks = @()
try {
    $ohmpVersion = oh-my-posh --version 2>$null
    $checks += [PSCustomObject]@{
        Component = "Oh My Posh"
        Estado = "✓ Instalado"
        Versión = $ohmpVersion
    }
} catch {
    $checks += [PSCustomObject]@{
        Component = "Oh My Posh"
        Estado = "✗ No instalado"
        Versión = ""
    }
}

$checks += [PSCustomObject]@{
    Component = "Perfil PowerShell"
    Estado = if (Test-Path $profilePath) { "✓ Configurado" } else { "✗ No configurado" }
    Versión = ""
}

# Mostrar resultados
$checks | Format-Table -AutoSize

# 5. GUÍA DE CONFIGURACIÓN MANUAL
Write-Host "`n=== GUÍA DE CONFIGURACIÓN MANUAL ===" -ForegroundColor Green
Write-Host "`nIMPORTANTE: Necesitas instalar una fuente Nerd Font manualmente" -ForegroundColor Yellow
Write-Host "`nOpción 1 - Instalar manualmente:" -ForegroundColor Cyan
Write-Host "1. Descarga una fuente Nerd Font desde:" -ForegroundColor White
Write-Host "   https://www.nerdfonts.com/font-downloads" -ForegroundColor Gray
Write-Host "2. Recomendadas: MesloLGS NF, FiraCode NF, Cascadia Code NF" -ForegroundColor Gray
Write-Host "3. Instala la fuente (haz doble click y 'Instalar')" -ForegroundColor Gray

Write-Host "`nOpción 2 - Usar oh-my-posh para instalar fuentes:" -ForegroundColor Cyan
Write-Host "   oh-my-posh font install" -ForegroundColor White
Write-Host "   oh-my-posh font install meslo" -ForegroundColor White

Write-Host "`nConfigurar la fuente en tu terminal:" -ForegroundColor Cyan
Write-Host "1. Abre Windows Terminal (o tu terminal preferida)" -ForegroundColor White
Write-Host "2. Presiona Ctrl + , para abrir Configuración" -ForegroundColor White
Write-Host "3. Ve a tu perfil de PowerShell" -ForegroundColor White
Write-Host "4. En 'Apariencia', busca 'Familia de fuentes'" -ForegroundColor White
Write-Host "5. Selecciona la fuente que instalaste (ej: 'MesloLGS NF')" -ForegroundColor White

Write-Host "`nComandos de prueba:" -ForegroundColor Cyan
Write-Host "   oh-my-posh --version" -ForegroundColor White
Write-Host "   ll" -ForegroundColor White
Write-Host "   Get-PoshThemes" -ForegroundColor White

Write-Host "`nSolución de problemas:" -ForegroundColor Yellow
Write-Host "• Si ves caracteres extraños: instala una fuente Nerd Font" -ForegroundColor Gray
Write-Host "• Para cambiar tema: Get-PoshThemes | Select-Object nombre" -ForegroundColor Gray
Write-Host "• Más temas: https://ohmyposh.dev/docs/themes" -ForegroundColor Gray

Write-Host "`n=== INSTALACIÓN COMPLETADA ===" -ForegroundColor Green
Write-Host "Reinicia tu terminal para aplicar los cambios." -ForegroundColor Cyan