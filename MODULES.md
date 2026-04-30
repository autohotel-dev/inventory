# Auto Hotel Luxor: Arquitectura de Módulos y Guía de Escalabilidad

Este documento describe la estructura del proyecto y proporciona "recetas" (How-Tos) exactas para que cualquier desarrollador humano o agente de IA pueda agregar nuevas funcionalidades de forma **súper rápida y sencilla**, manteniendo la consistencia del código.

---

## 🏗️ Mapa de Módulos (Dónde vive cada cosa)

El proyecto es un monorepo lógico dividido en varias sub-aplicaciones y servicios:

### 1. `frontend/` (Next.js App Router)
Aplicación web principal usada por Recepción, Administradores y Puntos de Venta.
- **`app/`**: Rutas de la aplicación (Ej: `/dashboard`, `/inventario`, `/pos`).
- **`app/actions/`**: Server Actions. Aquí **debe ir toda la lógica de mutación de base de datos** (Insert/Update/Delete). No hacemos peticiones directas desde los componentes cliente a menos que sea estrictamente necesario.
- **`components/`**: Componentes visuales.
  - `ui/`: Componentes genéricos de diseño (Shadcn/UI, Radix).
  - `[dominio]/`: Componentes agrupados por contexto de negocio (ej. `rooms/modals/`, `inventory/tables/`).
- **`lib/`**: Lógica compartida, clientes de Supabase (`lib/supabase/`), servicios externos (`lib/services/`).

### 2. `mobile/` (Expo + React Native)
Aplicación móvil utilizada por el personal operativo (Cocheros, Camaristas).
- **`app/`**: Rutas de Expo Router.
- **`app/(tabs)/`**: Pantallas principales de la barra de navegación inferior (ej. `assets.tsx` para control de TVs, `camarista/` para limpieza).
- **`components/`**: Componentes de UI móviles estilizados con NativeWind.

### 3. `supabase/` (Backend & Base de Datos)
- **`migrations/`**: Definición de la base de datos PostgreSQL. Todo cambio estructural **DEBE** hacerse creando un archivo de migración aquí.
- **`functions/`**: Edge Functions en Deno para lógica de servidor que no pertenece al Frontend (ej. webhooks externos).

### 4. `print-server/`
Servidor local en Express.
- **`index.js`**: Endpoints locales que el Frontend llama para mandar a imprimir tickets térmicos ESC/POS o reportes HP.

---

## 🚀 Guías de Escalabilidad (How-Tos)

Aquí están los pasos exactos para agregar funciones sin romper la arquitectura:

### Receta 1: Cómo agregar una NUEVA TABLA a la Base de Datos
Si necesitas almacenar una nueva entidad (ej. `mantenimiento_preventivo`):
1. **Crear Migración:** Crea un archivo `.sql` en `supabase/migrations/` (ej. `20260501_create_mantenimiento.sql`).
2. **Definir Esquema y RLS:** Dentro del archivo, crea la tabla, añade `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` y crea las políticas (policies) para que los usuarios autenticados puedan leer/escribir.
3. **Aplicar Migración:** Si estás en local, ejecuta `supabase migration up`.
4. **Actualizar Frontend:** El agente de IA debe revisar los tipos de TypeScript si la tabla se usa en el frontend.

### Receta 2: Cómo crear una NUEVA PANTALLA en el Frontend (Web)
Si el administrador necesita una nueva vista (ej. `/reportes/mantenimiento`):
1. **Crear Ruta:** Crea una carpeta `frontend/app/reportes/mantenimiento/` y dentro un archivo `page.tsx` (Server Component por defecto).
2. **Obtener Datos:** En `page.tsx`, usa `@supabase/ssr` (el cliente de servidor) para hacer `SELECT` de los datos que necesitas mostrar.
3. **Crear UI:** Crea los componentes necesarios en `frontend/components/mantenimiento/` y úsalos en la página.
4. **Añadir Mutaciones:** Si hay formularios o botones que modifican datos, crea una Server Action en `frontend/app/actions/mantenimiento-actions.ts` y llámala desde un componente de cliente (`"use client"`).

### Receta 3: Cómo agregar un NUEVO BOTÓN que afecta la BD en la App Móvil
Si el cochero necesita un botón de "Reportar Falla" en la app móvil:
1. **Crear Componente/Botón:** En `mobile/app/(tabs)/[archivo].tsx`, añade la UI usando NativeWind (`className="bg-primary p-4 rounded"`).
2. **Crear Estado de Carga:** Envuelve la lógica en un `try/catch` y usa el componente global `<ProcessingOverlay />` (o un estado `isLoading`) para evitar que el usuario presione el botón dos veces por accidente (prevención de race-conditions).
3. **Llamar a Supabase:** Usa el cliente instanciado en el móvil (`import { supabase } from '@/lib/supabase'`) para hacer el `INSERT` o llamar a un RPC si la lógica es compleja.

### Receta 4: Cómo agregar un NUEVO REPORTE IMPRESO
1. **Modificar el Print Server:** En `print-server/index.js`, añade un nuevo endpoint Express (ej. `app.post('/print/mantenimiento')`). Escribe la lógica usando los comandos de `node-thermal-printer`.
2. **Llamar desde Frontend:** Crea un servicio en `frontend/lib/services/print-service.ts` que haga un `fetch('http://localhost:8080/print/mantenimiento', { body: data })`.
3. **Vincular a UI:** Añade un botón de "Imprimir" en el Frontend que llame a ese servicio.

---

*Nota para Agentes de IA: Siempre prioricen el uso del patrón "Server Actions" en Next.js por encima de API Routes, y verifiquen que todas las consultas de Supabase tengan políticas RLS antes de asumirlas seguras.*
