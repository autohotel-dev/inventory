# Auto Hotel Luxor

Sistema integral de gestión de reservas, habitaciones, inventarios, y cobros para Auto Hotel Luxor, desarrollado con Next.js y Supabase.

## Stack Tecnológico
- **Frontend / Backend (BFF):** [Next.js](https://nextjs.org/) (App Router, Server Actions, API Routes)
- **Base de Datos & Auth:** [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Supabase Auth)
- **Estilos & UI:** Tailwind CSS, Radix UI, Shadcn/UI
- **Manejo de Formularios:** React Hook Form, Zod
- **Notificaciones Push:** Web Push API
- **Impresión Térmica:** `node-thermal-printer`, ESC/POS Commands
- **IoT / Sensores:** Tuya API integration (`tuyapi`, `@tuya/tuya-connector-nodejs`)

## Contexto para Agentes de IA

Si eres un asistente de IA o un nuevo desarrollador integrándose al proyecto, por favor lee:
1. `.cursorrules`: Archivo de configuración global con las directrices de arquitectura y estándares de código del proyecto.
2. `.jules/project_context.md`: Documento de memoria histórica con reglas de negocio y flujos de trabajo clave.

## Instalación y Despliegue Local

1. **Clonar el repositorio y entrar a la carpeta frontend:**
   ```bash
   git clone <repo-url>
   cd frontend
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar Variables de Entorno:**
   Copia el archivo `.env.example` a `.env.local` y configura las variables necesarias (URL de Supabase, Keys de VAPID, etc.).

4. **Levantar Entorno de Desarrollo:**
   ```bash
   npm run dev:all
   ```
   Esto levantará el servidor de Next.js (`npm run dev`) en conjunto con el servidor de impresión (`npm run print-server`).

5. **Construir para Producción:**
   ```bash
   npm run build
   ```
