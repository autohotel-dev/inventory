# Servidor Local de Impresión Térmica

Este servidor permite imprimir tickets de corte de caja en impresoras térmicas USB desde la aplicación web en la nube.

## 📋 Requisitos

- Node.js v18 o superior instalado
- Impresora térmica ESC/POS conectada por USB
- Windows, macOS o Linux

## 🚀 Instalación

### 1. Instalar Node.js

Si no tienes Node.js instalado:
1. Descarga desde https://nodejs.org/
2. Instala la versión LTS (recomendada)
3. Verifica la instalación abriendo PowerShell y ejecutando:
   ```
   node --version
   ```

### 2. Instalar Dependencias

Abre PowerShell en la carpeta `print-server` y ejecuta:

```powershell
npm install
```

Esto instalará todas las librerías necesarias.

## ▶️ Iniciar el Servidor

### Desde PowerShell

```powershell
cd "C:\Users\hackm\OneDrive\Documentos\Desarrollos Frontend\Inventory\inventory\print-server"
npm start
```

Deberías ver:
```
🖨️  Servidor de impresión corriendo en http://localhost:3001
📡 Aceptando peticiones desde:
   - http://localhost:3000 (desarrollo)
   - https://manager.autohoteluxor.com (producción)
```

### Mantener Corriendo en Segundo Plano

Para que el servidor se inicie automáticamente con Windows:

1. Presiona `Win + R`
2. Escribe `shell:startup` y presiona Enter
3. Crea un archivo `.bat` con este contenido:

```batch
@echo off
cd "C:\Users\hackm\OneDrive\Documentos\Desarrollos Frontend\Inventory\inventory\print-server"
start /min node index.js
```

4. Guárdalo como `start-print-server.bat`
5. Reinicia Windows para probar

## 🔧 Configuración

### Variables de Entorno

El servidor escucha en el puerto **3001** por defecto. Para cambiarlo:

```powershell
$env:PORT=3002
npm start
```

### Configurar IP Estática (Opcional)

Si la PC cambia de IP frecuentemente:

1. Ve a Configuración de Red → Ethernet/WiFi
2. Editar configuración IP
3. Asigna una IP fija (ej: 192.168.1.100)
4. Actualiza `NEXT_PUBLIC_PRINT_SERVER_URL` en Vercel

## 🧪 Probar el Servidor

### Test de Conectividad

Abre un navegador y ve a:
```
http://localhost:3001/health
```

Deberías ver:
```json
{
  "status": "ok",
  "service": "thermal-print-server",
  "version": "1.0.0"
}
```

### Test desde la Aplicación

1. Abre la aplicación (localhost:3000 o manager.autohoteluxor.com)
2. Ve a Cortes de Caja
3. Intenta imprimir un corte
4. Si todo funciona, deberías ver el ticket impreso

## ❌ Solución de Problemas

### "No se encontró ninguna impresora"

- Verifica que la impresora esté conectada por USB
- Verifica que esté encendida
- Reinicia el servidor

### "Error al conectar con la impresora"

- La impresora puede estar siendo usada por otro programa
- Cierra otros software de impresión
- Desconecta y reconecta la impresora

### "CORS error"

- Verifica que el dominio de tu app esté en la lista de `corsOptions` en `index.js`
- Reinicia el servidor después de hacer cambios

### El servidor se cierra solo

- Usa el método de inicio automático con Windows
- O usa `pm2` (gestor de procesos):
  ```
  npm install -g pm2
  pm2 start index.js --name print-server
  pm2 startup
  ```

## 📡 Configuración de Red

### Para desarrollo (misma PC)
```
NEXT_PUBLIC_PRINT_SERVER_URL=http://localhost:3001
```

### Para producción (PC diferente en red local)
```
NEXT_PUBLIC_PRINT_SERVER_URL=http://192.168.1.XXX:3001
```

> **Nota:** Reemplaza `192.168.1.XXX` con la IP de la PC que tiene la impresora

### Verificar IP de la PC

```powershell
ipconfig
```

Busca "Dirección IPv4" en tu adaptador de red activo.

## 🔒 Seguridad

- El servidor solo acepta conexiones desde dominios autorizados (configurados en CORS)
- No expone la impresora a internet directamente
- Solo funciona en red local

## 📝 Logs

Los logs se muestran en la consola donde corre el servidor:
- ✅ Ticket impreso correctamente
- ❌ Errores de conexión
- 📄 Datos recibidos

## 🆘 Soporte

Si tienes problemas:

1. Verifica que Node.js esté instalado: `node --version`
2. Verifica que las dependencias estén instaladas: `npm list`
3. Verifica que la impresora aparezca en Administrador de Dispositivos
4. Revisa los logs del servidor para mensajes de error
