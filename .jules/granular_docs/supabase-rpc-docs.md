# Documentación Granular: Supabase RPCs (Remote Procedure Calls)

Este documento detalla las funciones de PostgreSQL alojadas en Supabase que contienen la lógica de negocio semántica crítica. Usar estas funciones garantiza la consistencia de los datos en transacciones atómicas.

## Flujo de TV y Activos (Room Assets)

### `assign_asset_to_employee(p_room_id, p_asset_type, p_employee_id, p_action_by_employee_id)`
- **Uso principal:** Asignar una tarea a un Cochero/Valet para que encienda la TV o maneje un control.
- **Acciones:**
  1. Busca si ya existe el registro en `room_assets` para la habitación. Si no, lo inserta.
  2. Actualiza el estado a `PENDIENTE_ENCENDIDO` y asigna el `employee_id`.
  3. Inserta un registro de auditoría en `room_asset_logs` con la acción `ASSIGNED_TO_COCHERO_FOR_TV`.
- **Retorno:** JSON `{ success: true, message: '...' }`

### `confirm_tv_on(p_room_id, p_employee_id)`
- **Uso principal:** El Cochero confirma desde su App móvil que la TV fue encendida para el cliente.
- **Acciones:**
  1. Verifica que la TV estuviese en `PENDIENTE_ENCENDIDO`.
  2. Cambia el estado a `ENCENDIDO_CONFIRMADO`.
  3. Registra en `room_asset_logs` la acción `TV_CONFIRMED_ON`.
- **Retorno:** JSON `{ success: true, message: '...' }`

### `mark_asset_in_room(p_room_id, p_asset_type, p_employee_id)`
- **Uso principal:** Marcar que un activo (como el control del AC) fue dejado físicamente en la habitación.
- **Acciones:**
  1. Actualiza `room_assets` a `EN_HABITACION` y remueve el empleado asignado.
  2. Inserta el log `DROPPED_IN_ROOM`.

### `verify_asset_presence(p_room_id, p_asset_type, p_employee_id)`
- **Uso principal:** Al hacer checkout o limpieza, verificar que el activo sigue en la habitación.
- **Acciones:** Registra un log de tipo `VERIFIED_IN_ROOM`.

## Flujo de Auditoría (TV Audit)

### `get_tv_audit_trail(p_room_id)`
- **Retorna:** Una tabla con el historial de eventos de controles de TV para una habitación (quién lo asignó, cuándo se encendió). Hace un JOIN con la tabla de `employees` para devolver nombres reales (`assigned_to_name`, `action_by_name`).

### `get_tv_audit_stats(p_start_date, p_end_date)`
- **Retorna:** Estadísticas agregadas de cumplimiento (total de asignaciones vs total de confirmaciones exitosas), ideal para el panel analítico web.

## Cancelaciones y Cobros

### `cancel_reception_item_v1` / `cancel_reception_charge`
- **Uso principal:** Cancelar cargos de recepción (consumos o tiempo) de forma segura.
- **Acciones:**
  1. Verifica que la caja/sesión siga abierta.
  2. Cancela el pago o cargo.
  3. Dispara actualizaciones de inventario si el cargo era de un producto.

### `cancel_item_with_refund(...)`
- **Uso principal:** Cancela un ítem y genera el registro contable de reembolso automático para cuadrar el corte de caja.

## Notificaciones

### `send_valet_notification(p_title, p_message, p_data)`
- **Uso principal:** Usado por triggers de base de datos para emitir notificaciones vía Edge Functions o Realtime a los valets.
