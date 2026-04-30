# Documentación Granular: Flujos Móviles (Expo / React Native)

Este documento mapea la semántica de las pantallas y flujos en la aplicación móvil `valet-mobile`, construida con Expo Router. 

## Tab Principal (`app/(tabs)`)

### `assets.tsx` (Control de TVs y Activos)
- **Función Principal:** Permite a los Cocheros ver las habitaciones a las que han sido asignados para interactuar con activos físicos (especialmente controles de TV).
- **Semántica de BD:** 
  - Escucha cambios en tiempo real vía `supabase.channel` sobre la tabla `room_assets` filtrando por su `employee_id`.
  - Cuando el Cochero presiona "Confirmar Encendido", llama al RPC `confirm_tv_on` de Supabase.
- **Protección de UX:** Usa `<ProcessingOverlay />` (un modal de bloqueo) para evitar que presionen el botón múltiple veces mientras el RPC se procesa y el servidor de la app de Recepción se actualiza.

### `camarista/` (Limpieza de Habitaciones)
- **Función Principal:** Gestiona los estados de las recámaras (Sucia, En Limpieza, Limpia).
- **Semántica de BD:**
  - Cambia el `status` de la tabla `rooms`.
  - Emite logs en `cleaning_logs`.
- **Integración de Sensores:** El cambio a estado `Limpia` puede cruzarse (en el backend) con datos del sensor de presencia (Tuya API) para auditar que el personal estuvo el tiempo adecuado dentro de la habitación.

### `login.tsx` 
- **Flujo de Autenticación:** 
  1. Usa `@supabase/supabase-js` `signInWithPassword`.
  2. Guarda la sesión en el Keychain / Secure Storage del dispositivo usando un adaptador personalizado para Supabase (para evitar deslogueos al reiniciar la app).
  3. Redirige a `/(tabs)` usando `router.replace()`.

## Componentes Clave (`components/`)

### `ProcessingOverlay.tsx`
- Componente crítico. Un modal transparente con un `ActivityIndicator` absoluto que cubre toda la pantalla y previene toques. Se DEBE montar en el nivel más alto de cada vista de mutación (ej. al confirmar un activo o registrar una salida).

### `PushNotificationSetup.tsx`
- Se encarga de solicitar permisos de `expo-notifications` al inicio de la app.
- Recupera el `ExpoPushToken` (o VAPID token para web) y lo envía a la base de datos de Supabase en la tabla `employee_push_tokens` para permitir que el backend (`sendStaffAnnouncement`) localice el dispositivo del cochero en el futuro.
