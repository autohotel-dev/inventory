# === Oh My Posh Setup ===
# Opción RECOMENDADA:
oh-my-posh init pwsh | Invoke-Expression

# Alternativa si la anterior falla:
# oh-my-posh init pwsh | Invoke-Expression

# === Aliases Mejorados ===
function ll { Get-ChildItem -Force }
Set-Alias -Name ls -Value Get-ChildItem
Set-Alias -Name grep -Value Select-String

# === Colores Personalizados ===
$Host.PrivateData.ErrorForegroundColor = "Red"
$Host.PrivateData.ErrorBackgroundColor = "Black"
$Host.PrivateData.WarningForegroundColor = "Yellow"
$Host.PrivateData.WarningBackgroundColor = "Black"
$Host.PrivateData.DebugForegroundColor = "Cyan"
$Host.PrivateData.DebugBackgroundColor = "Black"

# === Función de Actualización Mejorada ===
function Update-Posh {
    try {
        # Actualizar Oh My Posh
        winget upgrade JanDeDobbeleer.OhMyPosh -s winget --accept-package-agreements --accept-source-agreements
        Write-Host "✓ Oh My Posh actualizado" -ForegroundColor Green
        
        # Solo instalar fuente si se solicita
        $installFont = Read-Host "¿Instalar fuentes? (S/N)"
        if ($installFont -eq 'S' -or $installFont -eq 's') {
            oh-my-posh font install
            Write-Host "✓ Fuentes actualizadas" -ForegroundColor Green
        }
        
        # Recargar configuración
        oh-my-posh init pwsh --config "$env:POSH_THEMES_PATH\jandedobbeleer.omp.json" | Invoke-Expression
        Write-Host "✓ Configuración recargada" -ForegroundColor Green
    } catch {
        Write-Host "✗ Error: $_" -ForegroundColor Red
    }
}

# === Funciones Adicionales Útiles ===
function Get-PoshThemes {
    # Listar todos los temas disponibles
    Get-ChildItem "$env:POSH_THEMES_PATH\*.omp.json" | Select-Object -ExpandProperty Name
}

function Set-PoshTheme {
    param([string]$ThemeName)
    # Cambiar a un tema específico
    oh-my-posh init pwsh --config "$env:POSH_THEMES_PATH\$ThemeName" | Invoke-Expression
    Write-Host "Tema cambiado a: $ThemeName" -ForegroundColor Green
}

# === Solución de Problemas ===
function Test-PoshConfig {
    # Verificar que Oh My Posh esté funcionando
    Write-Host "=== Diagnóstico Oh My Posh ===" -ForegroundColor Cyan
    
    # 1. Verificar instalación
    if (Get-Command oh-my-posh -ErrorAction SilentlyContinue) {
        Write-Host "✓ Oh My Posh instalado" -ForegroundColor Green
        Write-Host "  Versión: $(oh-my-posh --version)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Oh My Posh NO instalado" -ForegroundColor Red
    }
    
    # 2. Verificar tema
    if (Test-Path "$env:POSH_THEMES_PATH\jandedobbeleer.omp.json") {
        Write-Host "✓ Tema encontrado" -ForegroundColor Green
    } else {
        Write-Host "✗ Tema NO encontrado" -ForegroundColor Red
        Write-Host "  Ruta: $env:POSH_THEMES_PATH" -ForegroundColor Gray
    }
}