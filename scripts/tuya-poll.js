const { TuyaContext } = require('@tuya/tuya-connector-nodejs');

// CREDENCIALES
const ACCESS_ID = 'nuupg99y4yqxxn8gmydw';
const ACCESS_SECRET = '23f8bff93f554fe1b32eb4b286c3d4fe';
const DEVICE_ID = 'ebe28d1fc612ad2e01mh3b'; // ID Virtual del sensor
const REGION_URL = 'https://openapi.tuyaus.com'; // US confirmed

const WEBHOOK_URL = 'http://localhost:3000/api/sensors/webhook';
const POLL_INTERVAL_MS = 2000; // 2 segundos

const context = new TuyaContext({
    baseUrl: REGION_URL,
    accessKey: ACCESS_ID,
    secretKey: ACCESS_SECRET,
});

async function getStatus(deviceId) {
    try {
        const res = await context.request({
            method: 'GET',
            path: `/v1.0/devices/${deviceId}/status`
        });
        if (!res.success) {
            console.log(`Error polling status: ${res.code} - ${res.msg}`);
            return null;
        }
        return res.result;
    } catch (e) {
        console.error(`Error polling ${deviceId}:`, e.message);
        return null;
    }
}

async function reportToLocalApi(deviceId, statusArray) {
    try {
        const payload = {
            deviceId: deviceId,
            data: { status: statusArray }
        };

        // Using built-in fetch (Node 18+)
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

    } catch (e) {
        if (e.cause && e.cause.code === 'ECONNREFUSED') return;
        console.error("Local webhook error:", e.message);
    }
}

// Check cache to avoid spamming local API if nothing changed
const stateCache = new Map();

async function poll() {
    // console.log("--- Polling ---");
    const status = await getStatus(DEVICE_ID);

    if (status) {
        // Buscar estado de puerta (Soporta múltiples códigos comunes de Tuya)
        const relevant = status.find(s =>
            s.code === 'door_contact_state' ||
            s.code === 'door_sensor_state' ||
            s.code === 'switch' ||
            s.code === 'door_state'
        );

        // Buscar batería
        const battery = status.find(s =>
            s.code === 'battery_percentage' ||
            s.code === 'battery_state' ||
            s.code === 'battery'
        );

        if (relevant) {
            const cacheKey = `${DEVICE_ID}-door`;
            const lastVal = stateCache.get(cacheKey);

            // Console log status for user visibility
            // Para 'switch': true suele ser ABIERTA (ON), false CERRADA (OFF)
            // Si funciona al revés, invertir aquí.
            const isOpen = relevant.value === true || relevant.value === 'open' || relevant.value === 'true';

            const stateStr = isOpen ? "ABIERTA 🔴" : "CERRADA 🟢";
            process.stdout.write(`\r[${new Date().toLocaleTimeString()}] Estado: ${stateStr}  `);

            if (lastVal !== relevant.value) {
                console.log(`\n>>> CAMBIO DETECTADO: ${stateStr}`);

                // Normalizar status para nuestra API (siempre enviar como door_sensor_state para consistencia)
                const normalizedStatus = [
                    ...status,
                    // Si el código es 'switch', agregamos un 'door_sensor_state' falso para que la API lo entienda fácil
                    ...(relevant.code === 'switch' ? [{ code: 'door_sensor_state', value: isOpen }] : [])
                ];

                await reportToLocalApi(DEVICE_ID, normalizedStatus);
                stateCache.set(cacheKey, relevant.value);
            }
        }
    }
}

console.log("=== Tuya Sensor Bridge Started ===");
console.log(`Region: US, Device: ${DEVICE_ID}`);
console.log("Presiona Ctrl+C para detener.\n");

setInterval(poll, POLL_INTERVAL_MS);
poll();
