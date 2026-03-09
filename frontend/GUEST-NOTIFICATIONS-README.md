# 🔔 Sistema de Notificaciones para Huéspedes

Sistema completo de notificaciones web push para huéspedes del hotel conectados a la red LUXOR.

## 🚀 Características

- **Portal de huéspedes** accesible vía QR code o URL
- **Notificaciones push** en navegador para recordatorios y promociones
- **Encuestas de satisfacción** personalizadas
- **Panel administrativo** para gestionar notificaciones
- **Automatización** de recordatorios de check-out
- **Templates reutilizables** de notificaciones
- **Analíticas en tiempo real**

---

## 📋 Configuración Inicial

### 1. Instalar Dependencias

Las dependencias ya fueron instaladas:
```bash
npm install qrcode web-push @types/qrcode @types/web-push
```

### 2. Generar Claves VAPID

Las claves VAPID son necesarias para las notificaciones push:

```bash
node scripts/generate-vapid-keys.js
```

Este comando mostrará:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:tu_email@hotel.com
```

### 3. Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env.local`:

```bash
# Web Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=tu_clave_publica_generada
VAPID_PRIVATE_KEY=tu_clave_privada_generada
VAPID_SUBJECT=mailto:tu_email@hotel.com

# Cron Job Secret (genera uno aleatorio)
CRON_SECRET=un_secreto_aleatorio_para_cron
```

### 4. Ejecutar Migración de Base de Datos

La migración creará todas las tablas necesarias:

```sql
-- Ejecuta este archivo en Supabase SQL Editor
supabase/migrations/20241227_create_guest_notifications_system.sql
```

O desde tu terminal (si tienes Supabase CLI):
```bash
supabase db push
```

---

## 🎯 Uso

### Para Huéspedes

1. **Acceder al Portal:**
   - Escanear código QR en la habitación
   - O ir a: `tu-dominio.com/guest-portal/[NUMERO_HABITACION]`
   - Ejemplo: `hotel.com/guest-portal/101`

2. **Suscribirse a Notificaciones:**
   - Hacer clic en "Activar Notificaciones"
   - Aceptar el permiso del navegador
   - ¡Listo! Recibirás notificaciones importantes

3. **Completar Encuestas:**
   - Ver encuestas disponibles
   - Responder preguntas
   - Enviar feedback

### Para el Personal del Hotel

1. **Acceder al Panel Admin:**
   - Ir a: `tu-dominio.com/notifications-admin`
   - Requiere autenticación como staff

2. **Enviar Notificaciones:**
   - Seleccionar destinatario (habitación específica o todos)
   - Escribir título y mensaje
   - Hacer clic en "Enviar Notificación"

3. **Ver Huéspedes Suscritos:**
   - Lista en tiempo real de huéspedes suscritos
   - Estado de suscripciones
   - Última notificación enviada

---

## 🔄 Recordatorios Automáticos

El sistema envía automáticamente recordatorios de check-out **2 horas antes** de la salida programada.

### Configuración en Vercel

El cron job ya está configurado en `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/guest/check-reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

Esto ejecuta el endpoint cada hora para verificar check-outs próximos.

### Configurar Cron Secret en Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Settings > Environment Variables
3. Agrega: `CRON_SECRET` con un valor aleatorio
4. Usa el mismo valor en tu `.env.local` local

---

## 📱 Generar Códigos QR para Habitaciones

Puedes generar códigos QR para cada habitación de dos formas:

### Opción 1: Desde el sistema
(Funcionalidad por implementar en futuras versiones)

### Opción 2: Herramientas Online
1. Usa https://qr-code-generator.com
2. Tipo: URL
3. URL: `tu-dominio.com/guest-portal/[NUMERO]`
4. Descarga e imprime
5. Coloca en cada habitación

---

## 🗂️ Estructura de Archivos

```
inventory/
├── app/
│   ├── api/guest/                    # APIs para huéspedes
│   │   ├── subscribe/route.ts        # Suscripción push
│   │   ├── unsubscribe/route.ts      # Cancelar suscripción
│   │   ├── notify/route.ts           # Enviar notificaciones
│   │   ├── survey/route.ts           # Encuestas
│   │   ├── notification-status/route.ts  # Estado de notificaciones
│   │   └── check-reminders/route.ts  # Cron: recordatorios
│   ├── guest-portal/[roomNumber]/    # Portal de huéspedes
│   └── notifications-admin/          # Panel administrativo
├── components/
│   ├── guest/                        # Componentes del portal
│   │   ├── welcome-section.tsx
│   │   ├── notification-subscribe.tsx
│   │   ├── services-showcase.tsx
│   │   └── survey-viewer.tsx
│   └── admin-notifications/          # Componentes admin
│       ├── notification-composer.tsx
│       ├── guest-list.tsx
│       └── notification-stats.tsx
├── lib/services/
│   ├── push-notification-service.ts  # Cliente push (frontend)
│   └── guest-notification-service.ts # Servidor push (backend)
├── public/
│   └── guest-sw.js                   # Service Worker
├── supabase/migrations/
│   └── 20241227_create_guest_notifications_system.sql
└── scripts/
    └── generate-vapid-keys.js        # Generar claves VAPID
```

---

## 📊 Base de Datos

### Tablas Creadas

1. **guest_subscriptions** - Suscripciones push de huéspedes
2. **notification_templates** - Templates reutilizables
3. **guest_notifications** - Historial de notificaciones
4. **surveys** - Encuestas de satisfacción
5. **survey_responses** - Respuestas de huéspedes

### Templates Predeterminados

Se incluyen 4 templates por defecto:
- 🏨 Bienvenida
- ⏰ Recordatorio de check-out
- 🍽️ Promoción de restaurante
- ⭐ Encuesta de satisfacción

---

## 🧪 Testing

### Probar Notificaciones Localmente

1. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

2. Ir a `localhost:3000/guest-portal/101`

3. Suscribirse a notificaciones

4. Ir a `localhost:3000/notifications-admin`

5. Enviar una notificación de prueba a la habitación 101

6. Verificar que llegue la notificación

### Navegadores Soportados

- ✅ Chrome / Edge (Recomendado)
- ✅ Firefox
- ✅ Safari (macOS 16.4+)
- ❌ Internet Explorer (no soportado)

---

## 🔧 Troubleshooting

### Las notificaciones no llegan

1. Verificar que las claves VAPID estén correctamente configuradas
2. Confirmar que el navegador soporta push notifications
3. Revisar que el usuario haya aceptado los permisos
4. Verificar la consola del navegador para errores

### Error: "Subscription expired"

Las suscripciones push pueden expirar. El sistema automáticamente marca estas suscripciones como inactivas.

### Cron job no se ejecuta

1. Verificar que `CRON_SECRET` esté configurado en Vercel
2. Confirmar que el cron está habilitado en Vercel Dashboard
3. Revisar los logs en Vercel

---

## 🎨 Personalización

### Cambiar Servicios Mostrados

Editar `components/guest/services-showcase.tsx`:

```typescript
const services = [
  {
    icon: Utensils,
    title: 'Tu Servicio',
    description: 'Descripción',
    hours: 'Horario',
    color: 'from-color-to-color',
  },
  // ... más servicios
];
```

### Crear Nuevos Templates

Desde Supabase SQL Editor:
```sql
INSERT INTO notification_templates (
  name,
 title_template,
  body_template,
  template_type
) VALUES (
  'Mi Template',
  'Título con {variable}',
  'Cuerpo del mensaje con {otra_variable}',
  'custom'
);
```

---

## 📈 Próximas Mejoras

- [ ] Generador de QR codes integrado
- [ ] Templates con editor visual
- [ ] Programación de notificaciones
- [ ] Segmentación avanzada de huéspedes
- [ ] Reportes de satisfacción
- [ ] Notificaciones con imágenes
- [ ] Soporte para múltiples idiomas

---

## 🤝 Soporte

Para problemas o preguntas:
1. Revisar este README
2. Verificar la consola de errores
3. Revisar logs en Vercel
4. Contactar al equipo de desarrollo

---

**¡Sistema listo para usar! 🎉**
