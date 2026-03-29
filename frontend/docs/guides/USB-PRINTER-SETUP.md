# Guía de Configuración: Impresora Térmica USB

## ✅ Cambios Realizados

He actualizado el servicio `thermal-printer-service.ts` para usar conexión USB en lugar de red.

## 📋 Configuración USB

### Opción 1: Usando el nombre de la impresora en Windows

Si tu impresora está instalada en Windows, puedes usar su nombre:

```typescript
const printerConfig: PrinterConfig = {
    type: 'usb',
    interface: '\\\\localhost\\NombreDeTuImpresora',  // Reemplaza con el nombre real
    printerType: PrinterTypes.EPSON,
    characterSet: 'PC858_EURO',
    width: 48
};
```

### Opción 2: Usando el puerto USB directamente

```typescript
const printerConfig: PrinterConfig = {
    type: 'usb',
    interface: 'USB001',  // O el puerto que Windows asigne (USB001, USB002, etc.)
    printerType: PrinterTypes.EPSON,
    characterSet: 'PC858_EURO',
    width: 48
};
```

### Opción 3: Para desarrollo/pruebas - Compartir impresora

Si tienes problemas con USB directo, una alternativa es:

1. Compartir la impresora en Windows
2. Usar la conexión compartida:

```typescript
const printerConfig: PrinterConfig = {
    type: 'usb',
    interface: '\\\\localhost\\NombreImpresora',
    printerType: PrinterTypes.EPSON,
    characterSet: 'PC858_EURO',
    width: 48
};
```

## 🔍 Cómo encontrar el nombre de tu impresora

### Método 1: Panel de Control
1. Abre "Dispositivos e impresoras" (Panel de Control)
2. Encuentra tu impresora térmica
3. Copia el nombre exacto tal como aparece

### Método 2: PowerShell
Ejecuta en PowerShell:
```powershell
Get-Printer | Select-Object Name, PortName
```

### Método 3: CMD
Ejecuta en CMD:
```cmd
wmic printer get name,portname
```

## 🛠️ Pasos para configurar

1. **Asegúrate de que la impresora está conectada por USB**
   - Verifica que Windows la reconozca
   - Instala los drivers del fabricante si es necesario

2. **Encuentra el nombre de la impresora** usando uno de los métodos arriba

3. **Actualiza la configuración** en tu código:

```typescript
import { getPrinterInstance } from '@/lib/services/thermal-printer-service';

// Opción A: Usar configuración por defecto (se modificó a USB)
const printer = getPrinterInstance();

// Opción B: Especificar configuración personalizada
const printer = getPrinterInstance({
    type: 'usb',
    interface: '\\\\localhost\\TU_IMPRESORA',  // Reemplaza con el nombre real
    printerType: PrinterTypes.EPSON,
    characterSet: 'PC858_EURO',
    width: 48
});

// Probar impresión
await printer.printTest();
```

## 🧪 Script de prueba rápida

Crea un archivo `test-printer.ts` y ejecuta:

```typescript
import { ThermalPrinterService } from './lib/services/thermal-printer-service';
import { PrinterTypes } from 'node-thermal-printer';

async function test() {
    const printer = new ThermalPrinterService({
        type: 'usb',
        interface: '\\\\localhost\\NombreDeTuImpresora',  // ⚠️ CAMBIAR AQUÍ
        printerType: PrinterTypes.EPSON,
        characterSet: 'PC858_EURO',
        width: 48
    });

    await printer.printTest();
}

test().catch(console.error);
```

## ❓ Problemas comunes

### "No interface" error
- **Solución**: Especifica el `interface` con el nombre correcto de la impresora

### La impresora no se detecta
- Verifica que los drivers estén instalados
- Intenta imprimir una página de prueba desde Windows
- Verifica que el cable USB esté bien conectado

### "Access denied" o "Permission denied"
- Ejecuta tu aplicación como Administrador
- Verifica que la impresora no esté siendo usada por otro programa

### La impresora imprime caracteres raros
- Verifica que el `characterSet` sea correcto (para español: `PC858_EURO`)
- Prueba con otros character sets si es necesario

## 📝 Próximos pasos

1. Encuentra el nombre exacto de tu impresora en Windows
2. Actualiza la configuración en el servicio o al instanciarlo
3. Ejecuta una prueba con `printer.printTest()`
4. Si funciona, ya puedes usar `printBothTickets()` normalmente

## 💡 Recomendación

Si tienes dificultades con la configuración USB directa, considera usar una librería alternativa como:
- `escpos` + `escpos-usb` (más control de bajo nivel)
- O configurar la impresora como impresora de Windows y usar impresión estándar

¿Necesitas ayuda específica con algún paso?
