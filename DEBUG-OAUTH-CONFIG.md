# 🔍 DEBUG: Configuración OAuth

## ❌ PROBLEMA IDENTIFICADO:
El callback funciona pero sigue redirigiendo a localhost, lo que indica que **Supabase está configurado incorrectamente**.

## 🔧 CONFIGURACIONES QUE DEBES VERIFICAR:

### **1. 🔴 SUPABASE - URL Configuration:**
Ve a: **Authentication → URL Configuration**

**Site URL:**
```
https://www.pixanpax.com
```
❌ **Si dice:** `http://localhost:3000` ← ESTE ES EL PROBLEMA

**Redirect URLs:**
```
https://www.pixanpax.com/auth/callback
```
❌ **Si contiene:** `http://localhost:3000/auth/callback` ← QUÍTALO

### **2. 🔴 SUPABASE - Google Provider:**
Ve a: **Authentication → Providers → Google**

**Site URL:**
```
https://www.pixanpax.com
```

**Redirect URL:**
```
https://www.pixanpax.com/auth/callback
```

### **3. 🔴 GOOGLE CLOUD CONSOLE:**
Ve a: [Google Cloud Console](https://console.cloud.google.com/)
→ **APIs & Services → Credentials → Tu OAuth 2.0 Client**

**Authorized JavaScript origins:**
```
https://www.pixanpax.com
```

**Authorized redirect URIs:**
```
https://www.pixanpax.com/auth/callback
```

## 🎯 DIAGNÓSTICO RÁPIDO:

### **A. Revisa el HTML generado:**
1. Ve a `https://www.pixanpax.com`
2. **F12 → Elements**
3. Busca `<meta>` tags
4. **Verifica** que no haya referencias a localhost

### **B. Revisa la request de OAuth:**
1. **F12 → Network tab**
2. Click "Continuar con Google"
3. **Busca la request** que va a Google
4. **Verifica el redirect_uri** en la URL

**La URL debe contener:**
```
redirect_uri=https%3A//www.pixanpax.com/auth/callback
```

**NO debe contener:**
```
redirect_uri=http%3A//localhost%3A3000/auth/callback
```

## ⚠️ ERRORES COMUNES:

### **1. Site URL incorrecto en Supabase:**
- ❌ `http://localhost:3000`
- ✅ `https://www.pixanpax.com`

### **2. Múltiples Redirect URLs:**
- ❌ Tener localhost Y producción
- ✅ Solo URLs de producción

### **3. Cache de configuración:**
- Supabase puede tardar 1-2 minutos en actualizar
- Google puede tardar hasta 1 hora

## 🚀 SOLUCIÓN PASO A PASO:

### **Paso 1: Limpiar Supabase**
1. **Quita TODAS** las URLs de localhost
2. **Deja SOLO** las URLs de pixanpax.com
3. **Guarda** la configuración

### **Paso 2: Limpiar Google**
1. **Quita TODAS** las URLs de localhost
2. **Deja SOLO** las URLs de pixanpax.com
3. **Guarda** la configuración

### **Paso 3: Verificar Variables**
En Vercel:
```
NEXT_PUBLIC_SITE_URL=https://www.pixanpax.com
```

### **Paso 4: Test**
1. **Espera 5 minutos**
2. **Prueba en modo incógnito**
3. **Verifica** que funcione

## 🎯 SI SIGUE FALLANDO:

1. **Toma screenshot** de la configuración de Supabase
2. **Toma screenshot** de Google Cloud Console
3. **Comparte** los screenshots para revisar

---

**El problema está 99% en que Supabase tiene localhost configurado como Site URL.** 🔍
