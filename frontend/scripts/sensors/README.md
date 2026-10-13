# Sensores de cochera (Tuya Zigbee, 100% LAN)

```
Sensor (Zigbee) ──► Hub Tuya (WiFi LUXOR) ──LAN──► daemon.js (PC recepción, PM2) ──► Supabase ──Realtime──► Tablero POS
```

- **`daemon.js`** — único servicio. Conexión persistente a cada hub, recibe aperturas/cierres al instante y los escribe en `sensors` / `sensor_events`. Cada 2 min manda un **latido** (`last_seen`) de los sensores que su hub ve en línea.
- **`list-devices.js`** — regenera `tuya-devices.json` (ids, local keys, node ids) desde Tuya Cloud. Requiere la suscripción IoT Core vigente.
- **`sync-to-db.js`** — da de alta en Supabase los sensores nuevos de `tuya-devices.json`. Vista previa por defecto; `--apply` para aplicar. No borra nada.
- **`start-sensors.bat`** — arranque manual sin PM2 (no usar junto con PM2).

## Instalación en la PC de recepción

1. `git pull` (rama `pos`) y, si cambió `package.json`, `pnpm install` en `frontend`.
2. `frontend\.env.local` debe tener `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y las IPs de los hubs:
   ```
   TUYA_GATEWAY_IPS=HUB 139=192.168.1.47,HUB 148=192.168.1.35,HUB 150=192.168.1.37,HUB 141=192.168.1.100
   ```
   Reservar esas IPs en el DHCP del router. Si un hub cambia de IP el daemon lo vuelve a encontrar solo (~40 s) y avisa en el log.
3. Desde `frontend`: `pm2 start ecosystem.config.js` y `pm2 save`.
4. Arranque automático con Windows (`pm2 startup` no funciona en Windows):
   `npm install -g pm2-windows-startup` y luego `pm2-startup install`.

## Verificar

- `pm2 logs sensor-monitor` → 4 hubs con `✅ Conectado`.
- `http://localhost:5002/status` (o `https://print.autohoteluxor.com/sensors/status`) → `gatewaysConnected`, `lastHeartbeat`, `lastDbWrite`, `pendingDbWrites`.
- Abrir y cerrar una cochera → evento en el historial de la habitación.

## Qué ve recepción en el tablero

Pastilla en la esquina inferior izquierda de cada habitación con sensor:

| Pastilla | Significado |
|---|---|
| Puerta abierta azul | Cochera abierta (normal en libres) |
| Puerta abierta roja + tarjeta roja | Cochera abierta en habitación **ocupada** |
| Puerta cerrada verde | Cochera cerrada |
| `?` gris | Sin dato: el hub no conoce el estado hasta que la cochera se mueva (tras reiniciar el hub) |
| WiFi tachado | Sin señal: el hub no ve el sensor o no llega latido en 7 min |

Alertas (toast + sonido): cochera de ocupada que se abre; abierta +5 min en ocupada; sensor de ocupada que pierde señal; servicio completo sin señal (aviso fijo hasta que vuelva). Batería < 20 %: aviso sin sonido.

## Escenarios de falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Banner "Servicio de sensores sin señal" | Daemon detenido, PC apagada o sin red | `pm2 ls` / `pm2 logs sensor-monitor`; `pm2 restart sensor-monitor` |
| `El puerto 5002 ya está en uso` en el log | PM2 y el `.bat` corriendo a la vez | Cerrar la ventana del `.bat` |
| Un hub `No se pudo conectar` en bucle | Hub apagado / fuera del WiFi | Revisar energía y WiFi del hub; el resto sigue funcionando |
| Hub conecta y se desconecta al instante | Protocolo distinto (firmware) | Probar `HUB x=IP@3.3` en `TUYA_GATEWAY_IPS` |
| Sensor "sin señal" y el log dice `El hub reporta OFFLINE` | Pila agotada, fuera de alcance o desemparejado | Cambiar pila; si sigue, re-emparejar en Smart Life al mismo hub |
| Muchas cocheras con `?` | El hub se reinició | Normal: se corrige solo al moverse cada cochera |
| `Sub-dispositivos que no están en tuya-devices.json` | Sensor emparejado después de generar el JSON | Renovar IoT Core → `list-devices.js --save` → `sync-to-db.js --apply` → reiniciar daemon |
| `[DB] Write failed ... Queued` | Supabase/Internet caído | Nada: se reintenta cada 15 s sin perder el último estado |

## Pruebas sin tocar la base

```
SENSOR_DRY_RUN=1 SENSOR_DEBUG=1 SENSOR_PORT=5099 node scripts/sensors/daemon.js
```
