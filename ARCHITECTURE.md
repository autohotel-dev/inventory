# Arquitectura del Sistema - Auto Hotel Luxor

El sistema "Luxor" utiliza una arquitectura ágil y distribuida centrada en un **Frontend robusto (Next.js)**, una **App Móvil operativa (Expo/React Native)**, y **Supabase (BaaS)** como el corazón del backend, manejando la persistencia de datos, autenticación, lógica de negocio a través de RPCs (Remote Procedure Calls) y capacidades de tiempo real.

Esta infraestructura está diseñada para ser altamente escalable, auditable (a nivel forense) y de alta disponibilidad, permitiendo la operación fluida 24/7 de un auto hotel.

---

## 🏗️ Topología del Sistema y Stack Tecnológico

### 1. Panel de Administración y Recepción (Frontend Web)
- **Framework:** Next.js (App Router) con React.
- **Estilos y UI:** Tailwind CSS, Shadcn/UI, y Radix Primitives para una experiencia "Premium" con micro-animaciones fluidas (ej. orbes flotantes, scanlines para estados de habitación).
- **Arquitectura de Datos:** Patrón de Server Actions para mutaciones seguras y obtención de datos SSR para optimizar el rendimiento.
- **Propósito:** Actúa como el centro neurálgico ("Hub") para recepcionistas y administradores. Gestiona la matriz visual de asignación de habitaciones, control de inventario avanzado, panel de auditoría forense y finanzas.

### 2. Aplicación Operativa (Móvil)
- **Framework:** Expo y React Native.
- **Estilos:** NativeWind (Tailwind para React Native).
- **Propósito:** Herramienta de campo rápida y eficiente para Valets, Cocheros y Camaristas. Permite reportar inicios y fines de limpieza, gestionar el control de activos prestados (TVs, loza, controles), y recibir notificaciones operativas en tiempo real.

### 3. Módulo de Comunicación y Chat Interno (`admin-mobile/`)
- **Framework:** Expo y React Native.
- **Propósito:** A pesar de su nombre de directorio (`admin-mobile`), es una **Aplicación de Chat Interno** dedicada a la mensajería en tiempo real entre todo el staff (Recepción, Operadores, Administración). Soporta un canal global ("Chat Global / Recepción") y Mensajes Directos (DMs), unificando la comunicación entre el panel web y la app operativa de campo, integrando `Supabase Presence` para tracking de conexión.

### 4. Backend, Persistencia y Tiempo Real (Supabase/PostgreSQL)
- **Base de Datos:** PostgreSQL como fuente única de verdad.
- **Lógica de Negocio (RPCs):** Uso extensivo de Remote Procedure Calls (RPCs) de PostgreSQL para procesar transacciones seguras y operaciones complejas directamente desde el frontend, eliminando la necesidad de una capa API intermedia.
- **Seguridad:** Row Level Security (RLS) policies estrictas y validaciones de esquema a nivel base de datos.
- **Realtime:** Supabase Realtime para sincronizar la matriz de habitaciones en milisegundos entre el panel web y la app móvil, garantizando que el estado "Libre", "Ocupada", "Sucia" sea siempre exacto en todas las terminales.
- **Edge Functions:** Scripts Deno en `supabase/functions/` para manejar webhooks externos y tareas en segundo plano.

### 5. Servicios Periféricos e IoT
- **Print Server Local:** Servidor Express/NodeJS (`print-server/index.js`) que interactúa con la librería `node-thermal-printer` para enviar comandos ESC/POS directamente a impresoras de tickets (USB/Red) de manera silenciosa.
- **Integración IoT (Tuya):** Webhooks (`/api/sensors/webhook`) que interpretan aperturas de puertas o señales de sensores de movimiento, detectando de forma automática ocupación no autorizada o midiendo tiempos exactos de permanencia/limpieza.

---

## 🔄 Flujo de Datos Principal (Reserva -> Checkout)

### 1. Asignación y Check-In
- La Recepción inicia el proceso desde la matriz visual en la interfaz web. El sistema valida el estado de la habitación y registra la entrada (cambiando el estado a `OCUPADA`).
- Las Server Actions y reglas de RLS en Postgres validan que el usuario en sesión tenga los permisos adecuados.
- Se emiten eventos por **Supabase Realtime**, actualizando la UI al instante en todos los dispositivos y disparando notificaciones Push hacia la app móvil del Valet asignado.

### 2. Consumos y Control de Inventarios (Live Operations)
- Durante la estancia, los pedidos (Room Service, Bar) se añaden como `sales_orders` o `room_expenses`.
- El sistema de inventario realiza deducciones automáticas del stock.
- Los activos prestados (ej. secadoras, cables) se vinculan directamente a la cuenta de la habitación. Si en el proceso de check-out el Valet reporta algún daño o pérdida desde la App, el cargo extra se añade instantáneamente a la cuenta final.

### 3. Checkout y Facturación
- La Recepción emite la cuenta. El sistema calcula dinámicamente el cargo de hospedaje basado en el tipo de habitación (Sencilla, Jacuzzi, Master) y el tiempo transcurrido, sumando consumos y posibles multas.
- Tras registrar y confirmar el pago en la tabla `payments`, la habitación pasa a estado `DIRTY` (Sucia) o `CLEANING` (Limpiando).
- Se dispara automáticamente la impresión del ticket detallado mediante el **Print Server Local**.

### 4. Limpieza, Habilitación y Trazabilidad Operativa
- El personal de limpieza notifica el inicio de sus labores vía la App Móvil o a través de los sensores IoT.
- Al terminar, se registra el evento en el sistema. La habitación regresa al estado `AVAILABLE` (Libre).
- Todo este ciclo queda registrado cronológicamente para generar reportes de eficiencia, medir los KPIs de limpieza y cruzar datos con los sensores de movimiento.

---

## 🔍 Telemetría y Auditoría Forense (FBI-Grade Tracking)

Para garantizar la máxima transparencia en la operación, Luxor incorpora una trazabilidad profunda ("Forensic Hub"):
- **Librerías de Logging (`audit-logger.ts`, `flow-logger.ts`, `activity-logger.ts`):** Capturan y estructuran cada acción crítica del sistema (ej. cancelaciones, ajustes de precio, inicios de sesión fallidos).
- **Diffing de Datos:** Las modificaciones en registros clave guardan una instantánea del estado anterior (`old_data`) contra el nuevo (`new_data`), facilitando la investigación de incongruencias.
- **Live Operations Dashboard:** Interfaz administrativa diseñada para manejar un gran volumen de datos granulares, permitiendo a los gerentes filtrar líneas de tiempo por empleado, turno o habitación específica, activando alertas automatizadas ante comportamientos sospechosos o anómalos.
