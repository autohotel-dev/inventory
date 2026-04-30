# Documentación Granular: Next.js Server Actions

Este documento explica las convenciones y el funcionamiento de los Server Actions en la aplicación web. En Next.js 14+, preferimos Server Actions sobre API Routes para manejar mutaciones.

## Arquitectura de un Server Action Seguro

Todo archivo en `frontend/app/actions/` debe comenzar con `"use server"`. 
Para que una acción sea segura, **siempre** debe:
1. **Verificar Sesión:** `await supabase.auth.getSession()`
2. **Autorizar Usuario:** Obtener el perfil de la base de datos (ej. `employees`) para verificar que el usuario tenga los roles necesarios (`admin`, `receptionist`).
3. **Validar Entradas:** Usar bibliotecas como Zod para asegurar que los datos del formulario tienen el formato correcto antes de insertarlos.

## Acciones Críticas Implementadas

### Gestión de Reservaciones (`reservations-actions.ts`)
- **`createReservation(data)`:** Inserta en `reservations`. Verifica disponibilidad de cuarto, marca el estado en BD y emite evento de Realtime para actualizar la recepción.
- **`cancelReservation(id)`:** Marca en estado `CANCELLED`. Libera el cuarto. Requiere permisos elevados.

### Inventario y Catálogo (`inventory-actions.ts`)
- **`updateProductStock(productId, delta)`:** Operación de incremento/decremento. Ojo: La validación de stock negativo se maneja tanto aquí (código) como en la BD (check constraint).
- **`shareCatalogVisibility(isPublic)`:** Interactúa con el RPC para ajustar RLS y permitir que un catálogo se exponga vía link.

### Autenticación Extendida (`auth-actions.ts`)
- **`createAuthUser(employeeId)`:** *(Vulnerabilidad documentada en `sentinel.md`)*. Esta función utiliza `SUPABASE_SERVICE_ROLE_KEY` para crear cuentas. Valida estrictamente que quien llama a la función sea un administrador autenticado para evitar elevación de privilegios.

### Notificaciones Push Admin (`notifications-admin-actions.ts`)
- **`sendStaffAnnouncement(title, body, roleTarget)`:** 
  1. Recupera todos los tokens VAPID (Push Subscriptions) de los usuarios que coinciden con `roleTarget` (ej. solo Cocheros).
  2. Dispara llamadas HTTP usando la librería `web-push` con las llaves de servidor.
  3. Inserta un log de auditoría en la tabla `notification_logs`.
