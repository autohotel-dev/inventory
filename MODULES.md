# Auto Hotel Luxor: Arquitectura de Módulos y Guía de Escalabilidad

Este documento describe de forma exhaustiva la estructura real del monorepo tras analizar la totalidad de los directorios y subproyectos actuales. Contiene el mapa de todos los servicios y "recetas" (How-Tos) exactas para escalar el sistema respetando la arquitectura y auditoría.

---

## 🏗️ Mapa Exhaustivo de Módulos (Directorio Raíz)

El proyecto es un ecosistema distribuido compuesto por las siguientes capas físicas:

### 1. `frontend/` (Next.js App Router & Microservicios)
Aplicación web principal (Hub) de alto rendimiento para Recepción y Administración.
- **`app/`**: Rutas de Next.js (ej. `/auditoria`, `/operacion-en-vivo`, `/kardex`, `/precortes-de-caja`). Son *Server Components* para optimizar la carga.
- **`app/actions/`**: **Server Actions.** Único punto de mutación desde la web; encapsulan llamadas a los RPCs de Supabase.
- **`components/`**: Componentes visuales (ui, rooms, live-operations). Aquí residen las interfaces modulares complejas.
- **`lib/`**: Motor lógico y de telemetría forense (`audit-logger.ts`, `flow-logger.ts`).
- **`print-server/`**: Servidor Express NodeJS anidado que traduce peticiones HTTP del frontend a comandos ESC/POS (`node-thermal-printer`) para tickets impresos localmente.
- **`scripts/`**: Directorio crítico que contiene scripts de mantenimiento de base de datos (`setup-database.sql`, `clean-all-tables.sql`) y **daemons de polling IoT para sensores Tuya** (`tuya-poll.js`, `tuya-poll-local.py`).

### 2. Ecosistema Móvil (Expo / React Native)
Existen dos aplicaciones móviles diferenciadas:
- **`mobile/`**: App operativa para personal de campo (Valets, Cocheros, Camaristas). Usada para reportar limpiezas, vincular activos de las habitaciones e interactuar directamente con Supabase RPCs.
- **`admin-mobile/`**: Módulo de Chat Interno (`autohotel-luxor-manager`). A pesar del nombre de la carpeta, es una **Aplicación de mensajería en tiempo real** usada internamente por todo el personal. Se integra transversalmente con la app operativa (`mobile/`) y la web (`frontend/`), soportando canales globales ("Chat Global / Recepción") y Mensajes Directos (DMs) gestionados con `Supabase Presence`.

### 3. `supabase/` (PostgreSQL & Lógica de Negocio)
- **`migrations/`**: Definición absoluta del esquema y **núcleo de la lógica transaccional**. Aquí residen las complejas RPCs (ej. `20260423_cancel_reception_item.sql`, `20260505_global_telemetry.sql`) que se encargan del control atómico de datos, eliminando la necesidad de APIs intermedias.

### 4. `manual/` (Documentación / Landing - Qwik App)
- Proyecto satélite desarrollado con el framework **Qwik** y Vite (`qwik.env.d.ts`). Destinado a fungir como el manual interactivo o documentación estructurada externa.

### 5. `backend/` (Legado / Deprecado)
- Carpeta con configuración Serverless/FastAPI (`main.py`, `mangum`). **Este servicio está obsoleto** y ya no se usa, ya que la lógica fue delegada a los RPCs de PostgreSQL y Server Actions de Next.js.

---

## 🚀 Guías de Escalabilidad (Recetas / How-Tos)

### Receta 1: Crear una NUEVA TABLA y Lógica de Negocio (RPC)
1. **Crear Migración:** Genera un archivo `.sql` en `supabase/migrations/`.
2. **Definir Esquema:** Escribe `CREATE TABLE` y `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
3. **Crear el RPC:** Encapsula la lógica compleja en una función PL/pgSQL (`CREATE OR REPLACE FUNCTION`) en la misma migración.
4. **Aplicar Migración y Tipos:** Aplica los cambios en la BD y regenera los tipos TypeScript en `frontend/types/`.

### Receta 2: Crear una NUEVA PANTALLA WEB
1. **Crear Ruta Server-Side:** Crea la vista en `frontend/app/[dominio]/page.tsx`.
2. **Obtener Datos:** Usa `@supabase/ssr` en el componente servidor.
3. **Mutar Datos:** Crea una Server Action en `frontend/app/actions/`. En ella invoca el RPC de Supabase y **llama obligatoriamente al AuditLogger** para la trazabilidad.

### Receta 3: Añadir Funcionalidad Móvil (Valet o Admin)
1. **App Correcta:** Identifica si el cambio va en `mobile/` o en `admin-mobile/`.
2. **Prevención de UI:** Envuelve acciones en `<ProcessingOverlay />` para evitar toques múltiples.
3. **Llamar RPCs:** Llama a Supabase directamente con `.rpc()`.

### Receta 4: Registro Obligatorio en la AUDITORÍA FORENSE
Cualquier acción destructiva, cambio de estado (ej. cancelar reservas) o cobro debe rastrearse:
```typescript
await AuditLogger.logEvent({
  action: 'CANCEL_RESERVATION',
  employeeId: session.user.id,
  severity: 'CRITICAL',
  oldData: previo,
  newData: actual
});
```

### Receta 5: Manejo de Sensores IoT
Si requieres actualizar la lectura de las puertas o el sensor de movimiento:
1. Revisa los scripts en `frontend/scripts/tuya-poll.js` o `tuya-poll-local.py`.
2. Actualiza la lógica de webhook en las funciones correspondientes para mapear los nuevos IDs de los dispositivos de Tuya.

---

> [!IMPORTANT]
> **Nota para Agentes de IA:** 
> - **Analicen todo el ecosistema:** Si un cambio involucra permisos, revisar si impacta a `mobile/`, `admin-mobile/` y `frontend/`.
> - **Ignorar `backend/`:** Está deprecado.
> - **Scripts SQL Externos:** Cuidado con los scripts en `frontend/scripts/`; aunque son útiles para setups base, todo cambio en producción debe ir en `supabase/migrations/`.
