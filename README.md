# Auto Hotel Luxor

Sistema integral de gestión de reservas, habitaciones, inventarios, y cobros para Auto Hotel Luxor, con una arquitectura distribuida y ágil basada en **Next.js**, **React Native (Expo)** y **Supabase**.

## Stack Tecnológico

- **Frontend Web (Recepción / Admin):** [Next.js](https://nextjs.org/) (App Router, Server Actions para mutaciones seguras)
- **App Móvil (Operativa de Campo):** [Expo](https://expo.dev/) / React Native con NativeWind
- **Backend, Persistencia y Auth:** [Supabase](https://supabase.com/) (PostgreSQL como fuente de verdad, uso intensivo de **RPCs** para lógica de negocio transaccional, Row Level Security, Supabase Realtime)
- **Estilos & UI:** Tailwind CSS, Radix UI, Shadcn/UI (Frontend) y NativeWind (App Móvil)
- **Manejo de Formularios:** React Hook Form, Zod
- **Notificaciones Push:** Web Push API
- **Impresión Térmica:** Servidor local NodeJS (`print-server`) usando `node-thermal-printer` y comandos ESC/POS
- **IoT / Sensores:** Integración Tuya API (`tuyapi`, `@tuya/tuya-connector-nodejs`) para monitorización automatizada
- **Auditoría Forense:** Telemetría personalizada y logs de actividad estructurados (`audit-logger`, `flow-logger`)

## Contexto para Desarrolladores y Agentes de IA

Si eres un asistente de IA o un nuevo desarrollador integrándose al proyecto, por favor lee estos documentos clave en la raíz del repositorio:
1. `ARCHITECTURE.md`: Detalle profundo de la topología del sistema, stack tecnológico, y flujo de datos de extremo a extremo.
2. `MODULES.md`: Mapa de módulos y guías paso a paso de cómo añadir nuevas funciones o rutas.
3. `API_DOCS.md`: Documentación de los Webhooks (IoT, Push) y Endpoints expuestos por Next.js.
4. `.cursorrules`: Archivo de configuración global con las directrices de arquitectura y estándares de código del proyecto.

## Instalación y Despliegue Local

### 1. Panel Web y Servidor de Impresión (Frontend)
1. Entrar a la carpeta frontend:
   ```bash
   cd frontend
   ```
2. Instalar dependencias (se recomienda `pnpm`):
   ```bash
   pnpm install  # o npm install
   ```
3. Configurar Variables de Entorno:
   Copia el archivo `.env.example` a `.env.local` y configura las credenciales (URL de Supabase, Keys de VAPID, etc.).
4. Levantar Entorno de Desarrollo:
   ```bash
   npm run dev:all
   ```
   *Esto levantará el servidor de Next.js en el puerto 3000, junto con el servidor de impresión.*

### 2. Aplicación Operativa (Móvil)
1. Entrar a la carpeta mobile:
   ```bash
   cd mobile
   ```
2. Instalar dependencias:
   ```bash
   pnpm install  # o npm install
   ```
3. Iniciar el servidor de Expo:
   ```bash
   npx expo start
   ```

### 3. Construcción para Producción
Para compilar la versión de producción del frontend:
```bash
cd frontend
npm run build
```
