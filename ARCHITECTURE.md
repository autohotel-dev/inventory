# Arquitectura del Sistema - Auto Hotel Luxor

El sistema utiliza una arquitectura orientada a servicios basada en **Next.js (Fullstack)** y **Supabase (BaaS)**.

## Flujo de Datos Principal (Reserva -> Checkout)

1. **Asignación y Check-In:**
   - La aplicación cliente (recepción) envía una solicitud de cambio de estado de habitación a través de Supabase Client (`lib/supabase/client.ts`).
   - Las reglas de Row Level Security (RLS) en Postgres validan que el usuario en sesión tenga permisos.
   - Si se requiere notificar al valet, se disparan Webhooks o suscripciones a Supabase Realtime que a su vez llaman a `/api/chat/send-push` o envían notificaciones vía Web Push.
2. **Consumos y Cargos Extra:**
   - Durante la estancia, los pedidos de cocina/bar se registran en la tabla de `sales` o `room_expenses`.
   - El sistema de inventarios descuenta automáticamente el stock mediante Triggers de base de datos o lógica en `lib/services/sales-order-service.ts`.
3. **Checkout y Cobro:**
   - Al finalizar, el recepcionista emite la cuenta. El sistema acumula cargos fijos (tiempo) y extras (consumos, multas).
   - Se registra el pago en la tabla `payments` y se actualiza el estado de la habitación a `DIRTY` o `CLEANING`.
4. **Limpieza y Habilitación:**
   - Sensores IoT (Tuya) o personal de limpieza reportan el final del proceso.
   - El sistema (vía API webhooks en `/api/sensors/webhook`) recibe el evento, actualiza las tablas correspondientes, y la habitación vuelve a estar disponible (`AVAILABLE`).

## Integraciones Clave

- **Supabase Realtime:** Usado para mantener la UI sincronizada en recepciones y dashboards (ej. cambios de estado de habitaciones instantáneos).
- **Tuya API:** Integración con sensores de puerta y movimiento en las habitaciones para detectar ocupación no autorizada o tiempos de limpieza.
- **Node Thermal Printer:** Un servidor local (Express) en NodeJS (`print-server/index.js`) expone endpoints para comunicarse directamente con impresoras ESC/POS vía USB/Red.
