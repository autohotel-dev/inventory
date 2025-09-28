# 🔧 CONFIGURACIÓN OAUTH PARA PIXANPAX.COM

## 🎯 PROBLEMA ACTUAL:
Google OAuth sigue redirigiendo a localhost después del login.

## ✅ SOLUCIÓN COMPLETA:

### **1. 🔴 GOOGLE CLOUD CONSOLE (MUY IMPORTANTE):**

Ve a [Google Cloud Console](https://console.cloud.google.com/)
→ **APIs & Services** → **Credentials** → **Tu OAuth 2.0 Client ID**

**Authorized JavaScript origins:**
```
https://www.pixanpax.com
```
❌ QUITA: `http://localhost:3000`
❌ QUITA: `https://inventory-five-peach.vercel.app`

**Authorized redirect URIs:**
```
https://www.pixanpax.com/auth/callback
```
❌ QUITA: Cualquier URL de localhost o Vercel
❌ QUITA: URLs de Supabase (etqvscnopvbqwpzlwfpc.supabase.co)

### **2. 🔴 SUPABASE DASHBOARD:**

Ve a **Authentication** → **Providers** → **Google**

**Site URL:**
```
https://www.pixanpax.com
```

**Redirect URLs:**
```
https://www.pixanpax.com/auth/callback
```

### **3. 🔴 VERCEL ENVIRONMENT VARIABLES:**

En tu proyecto de Vercel → **Settings** → **Environment Variables**

**Variable a actualizar:**
```
NEXT_PUBLIC_SITE_URL = https://www.pixanpax.com
```

Asegúrate de que esté configurada para:
- ✅ Production
- ✅ Preview  
- ✅ Development

### **4. 🔴 RE-DEPLOY:**

Después de hacer todos los cambios:
1. **Push** tu código actualizado
2. **Re-deploy** en Vercel
3. **Espera 5-10 minutos** para que Google actualice su cache

### **5. 🔍 VERIFICACIÓN:**

#### **A. Abre Developer Tools:**
1. Ve a `https://www.pixanpax.com`
2. **F12** → **Network tab**
3. Click en "Continuar con Google"
4. **Busca la request** que va a Google
5. **Verifica** que contenga: `redirect_uri=https%3A//www.pixanpax.com/auth/callback`

#### **B. Si sigue mostrando localhost:**
- **Limpia cache** del navegador
- **Prueba en modo incógnito**
- **Espera más tiempo** (Google puede tardar hasta 1 hora)

### **6. 🚨 ERRORES COMUNES:**

#### **A. Cache de Google:**
Google puede tardar hasta 1 hora en actualizar las configuraciones.

#### **B. Múltiples URLs:**
Si tienes localhost Y producción, Google puede elegir localhost.

#### **C. Variables de entorno:**
Si `NEXT_PUBLIC_SITE_URL` no está configurada correctamente.

### **7. 🎯 TEST FINAL:**

#### **A. URL de Google debe ser:**
```
https://accounts.google.com/oauth/authorize?
client_id=TU_CLIENT_ID&
redirect_uri=https%3A//www.pixanpax.com/auth/callback&
...
```

#### **B. NO debe contener:**
```
❌ localhost
❌ vercel.app
❌ supabase.co
```

## ⏰ TIEMPO DE PROPAGACIÓN:

- **Vercel:** Inmediato después del deploy
- **Supabase:** 1-2 minutos
- **Google:** 5 minutos a 1 hora

## 🎉 RESULTADO ESPERADO:

1. **Click** en "Continuar con Google"
2. **Google autentica** al usuario
3. **Redirige** a `https://www.pixanpax.com/auth/callback`
4. **Usuario llega** al dashboard en `https://www.pixanpax.com/dashboard`

---

**Si después de 1 hora sigue fallando, revisa que TODAS las configuraciones estén exactamente como se indica arriba.** 🔍
