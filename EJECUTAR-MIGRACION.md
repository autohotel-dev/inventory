# Guía Rápida: Ejecutar Migración SQL en Supabase

## 📋 Pasos a Seguir

### 1. Abre Supabase Dashboard
- Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Selecciona tu proyecto

### 2. Abre el SQL Editor
- En el menú lateral, click en **SQL Editor**
- Click en **New query** (botón verde)

### 3. Copia el Script SQL
- Abre el archivo: [`scripts/add-pending-closing-status.sql`](file:///c:/Users/autoh/Documents/GitHub/inventory/scripts/add-pending-closing-status.sql)
- Copia **TODO** el contenido del archivo
- Pégalo en el editor SQL de Supabase

### 4. Ejecuta el Script
- Click en el botón **Run** (o presiona `Ctrl+Enter`)
- Espera a que se complete la ejecución
- Deberías ver mensajes de éxito y algunas tablas de verificación

### 5. Verifica que Funcionó
Ejecuta esta query en el SQL Editor:

```sql
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'shift_sessions_status_check';
```

**Resultado esperado:**
```
CHECK ((status)::text = ANY ((ARRAY['active'::character varying, 'pending_closing'::character varying, 'closed'::character varying, 'cancelled'::character varying])::text[]))
```

### 6. Prueba en la Aplicación
1. Ve a tu aplicación (que debería estar corriendo en `npm run dev`)
2. Registra entrada a un turno
3. Click en "Salir"
4. Selecciona **"Hacer corte después"**
5. ✅ Ya NO debería dar error

---

## ⚠️ Si Tienes Problemas

### "Permission denied"
- Asegúrate de estar logueado como el dueño del proyecto
- O usa una cuenta con permisos de administrador

### "Syntax error"
- Verifica que copiaste TODO el contenido del archivo
- No modifiques nada del script

### Necesitas ayuda
- Avísame qué mensaje de error ves exactamente
