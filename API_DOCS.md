# Documentación de Endpoints API (Auto Hotel Luxor)

El proyecto utiliza **Next.js Route Handlers** (`frontend/app/api/...`). Todas las llamadas están protegidas mediante Supabase Auth o Server Roles.

## 1. Webhooks Sensores IoT

### `POST /api/sensors/webhook`

Recibe eventos desde la plataforma Tuya o IFTTT para actualizar el estado físico de los sensores en las habitaciones.

**Request Body Example (Tuya / IFTTT):**
```json
{
  "deviceId": "vdevoXXXXXX",
  "status": "OPEN",
  "isOpen": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "state": "OPEN"
}
```

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
