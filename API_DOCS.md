# Documentación de Endpoints API (Auto Hotel Luxor)

El proyecto utiliza **Next.js Route Handlers** (`frontend/app/api/...`). Todas las llamadas están protegidas mediante Supabase Auth o Server Roles.

## 1. Sensores IoT (cocheras)

No hay endpoint HTTP para sensores. El daemon local `frontend/scripts/sensors/daemon.js` (PC de recepción) se conecta por LAN a los hubs Zigbee Tuya y escribe directamente en las tablas `sensors` / `sensor_events` de Supabase con la service role; el tablero las lee por Supabase Realtime. El antiguo webhook de Tuya Cloud (`/api/sensors/webhook`) se eliminó: no tenía autenticación obligatoria y permitía falsear el estado de las cocheras.

## 2. Notificaciones Push (Chat)

### `POST /api/chat/send-push`

Envía notificaciones push a todos los suscriptores (excepto al remitente original) cada vez que se inserta un nuevo mensaje. Gatillado usualmente por un Webhook de Base de Datos (Supabase).

**Request Headers:**
- `x-webhook-secret`: Secreto compartido para prevenir llamadas no autorizadas.

**Request Body Example (Supabase Insert Event):**
```json
{
  "type": "INSERT",
  "table": "messages",
  "record": {
    "id": 123,
    "user_id": "uuid-...",
    "user_email": "recepcion@luxor.com",
    "content": "Habitación 4 lista."
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 5
}
```

## 3. Empleados y Auth

### `POST /api/employees/create-auth-user`

Crea un usuario en la plataforma de Auth de Supabase y asocia su rol o perfil a la base de datos de empleados. Requiere provilegios de Administrador.

**Request Body Example:**
```json
{
  "email": "nuevo.valet@luxor.com",
  "password": "TempPassword123",
  "firstName": "Juan",
  "lastName": "Pérez",
  "roleId": 3
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "userId": "auth-uuid-..."
}
```
