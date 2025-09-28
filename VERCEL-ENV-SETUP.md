# 🔧 Configuración de Variables de Entorno en Vercel

## ❌ Error Actual:
```
Environment Variable "NEXT_PUBLIC_SUPABASE_URL" references Secret "supabase_url", which does not exist.
```

## ✅ Solución Paso a Paso:

### 1. **Obtener Credenciales de Supabase**

Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard):

1. **Settings → API**
2. Copia estos valores:
   - **Project URL** (ejemplo: `https://abcdefghijk.supabase.co`)
   - **Anon/Public Key** (ejemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### 2. **Configurar en Vercel Dashboard**

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. **Settings → Environment Variables**
3. **Add New** y agrega estas 3 variables:

#### Variable 1:
- **Name:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** `https://tu-proyecto-id.supabase.co`
- **Environments:** ✅ Production ✅ Preview ✅ Development

#### Variable 2:
- **Name:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (tu clave pública)
- **Environments:** ✅ Production ✅ Preview ✅ Development

#### Variable 3:
- **Name:** `NEXT_PUBLIC_SITE_URL`
- **Value:** `https://tu-proyecto.vercel.app`
- **Environments:** ✅ Production ✅ Preview ✅ Development

### 3. **Configurar Google OAuth en Supabase (Importante)**

Para que Google Login funcione correctamente:

1. **Ve a Supabase Dashboard → Authentication → Providers**
2. **Habilita Google Provider**
3. **En "Site URL"** pon: `https://tu-proyecto.vercel.app`
4. **En "Redirect URLs"** agrega: `https://tu-proyecto.vercel.app/auth/callback`

### 4. **Re-deploy**

Después de configurar las variables:

1. **Deployments → Re-deploy** (botón con 3 puntos)
2. O hacer un nuevo **git push** para trigger automático

## 🔍 Verificación

### En Vercel Dashboard:
- Settings → Environment Variables
- Deberías ver las 3 variables listadas

### En tu App (después del deploy):
- Abre la consola del navegador
- Ejecuta: `console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)`
- Debería mostrar tu URL de Supabase

## ⚠️ Notas Importantes:

1. **NEXT_PUBLIC_** es necesario para variables que se usan en el cliente
2. **No uses comillas** en los valores de las variables
3. **Copia exactamente** las credenciales de Supabase
4. **Re-deploy es necesario** después de cambiar variables

## 🚀 Ejemplo de Valores:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzNjU0ODAwMCwiZXhwIjoxOTUyMTI0MDAwfQ.example-signature
NEXT_PUBLIC_SITE_URL=https://mi-inventario.vercel.app
```

## 🎉 Después del Deploy Exitoso:

Tu aplicación debería:
- ✅ Cargar sin errores
- ✅ Conectar a Supabase
- ✅ Mostrar datos del inventario
- ✅ Permitir autenticación
- ✅ Funcionar como PWA

---

**¿Necesitas ayuda?** Verifica que:
1. Las credenciales de Supabase sean correctas
2. Las variables estén en todos los environments
3. Hayas hecho re-deploy después de configurarlas
