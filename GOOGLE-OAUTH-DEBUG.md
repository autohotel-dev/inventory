# 🔍 DEBUG: Google OAuth Redirect a Localhost

## ❌ Problema:
Google OAuth sigue redirigiendo a localhost en lugar del dominio de producción.

## 🔧 Solución Paso a Paso:

### **1. Verificar Configuración en Supabase:**

#### **A. Ve a Supabase Dashboard:**
- **Authentication → Providers → Google**

#### **B. Verifica estos campos:**

**Site URL:**
```
https://tu-proyecto.vercel.app
```
❌ NO: `http://localhost:3000`
❌ NO: `localhost:3000`

**Redirect URLs:**
```
https://tu-proyecto.vercel.app/auth/callback
```
❌ NO: `http://localhost:3000/auth/callback`

#### **C. Additional Redirect URLs:**
Agrega estas URLs también:
```
https://tu-proyecto.vercel.app/auth/callback
https://tu-proyecto.vercel.app/**
```

### **2. Verificar Variables de Entorno en Vercel:**

#### **NEXT_PUBLIC_SITE_URL:**
```
https://tu-proyecto.vercel.app
```

### **3. Limpiar Cache de Google:**

#### **A. En Google Cloud Console:**
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services → Credentials**
3. Encuentra tu **OAuth 2.0 Client ID**
4. **Edita** las **Authorized redirect URIs**
5. **QUITA** cualquier URL de localhost
6. **AGREGA** solo: `https://tu-proyecto.vercel.app/auth/callback`

#### **B. URLs Autorizadas deben ser:**
```
✅ https://tu-proyecto.vercel.app/auth/callback
❌ http://localhost:3000/auth/callback (QUITAR)
```

### **4. Verificar en el Navegador:**

#### **A. Abre Developer Tools:**
- **Network tab**
- Intenta hacer login con Google
- **Busca la request** de OAuth
- **Verifica el redirect_uri** en la URL

#### **B. La URL debe contener:**
```
redirect_uri=https%3A//tu-proyecto.vercel.app/auth/callback
```

❌ **NO debe contener:**
```
redirect_uri=http%3A//localhost%3A3000/auth/callback
```

### **5. Forzar Actualización:**

#### **A. En Supabase:**
1. **Guarda** la configuración de Google
2. **Desactiva** el provider de Google
3. **Espera 30 segundos**
4. **Reactiva** el provider de Google

#### **B. En Vercel:**
1. **Re-deploy** el proyecto
2. O **Clear cache** si tienes la opción

### **6. Test Final:**

#### **A. Abre tu app en producción:**
```
https://tu-proyecto.vercel.app
```

#### **B. Click en "Continuar con Google"**

#### **C. Verifica que la URL de Google contenga:**
```
redirect_uri=https%3A//tu-proyecto.vercel.app/auth/callback
```

## 🚨 Errores Comunes:

### **1. Site URL incorrecto en Supabase**
❌ `localhost:3000`
✅ `https://tu-proyecto.vercel.app`

### **2. Redirect URLs mezcladas**
❌ Tener localhost Y producción
✅ Solo URLs de producción

### **3. Cache de Google**
❌ Google Cloud Console con localhost
✅ Solo URLs de producción

### **4. Variables de entorno**
❌ `NEXT_PUBLIC_SITE_URL` vacía o incorrecta
✅ `NEXT_PUBLIC_SITE_URL=https://tu-proyecto.vercel.app`

## ✅ Checklist Final:

- [ ] Supabase Site URL = tu dominio de producción
- [ ] Supabase Redirect URLs = solo producción
- [ ] Google Cloud Console = solo producción
- [ ] Variables de entorno configuradas
- [ ] Re-deploy realizado
- [ ] Cache limpiado

## 🎯 Si Sigue Fallando:

1. **Revisa la consola del navegador** para errores
2. **Verifica la URL completa** en Network tab
3. **Contacta soporte de Supabase** si persiste

---

**El problema casi siempre está en tener URLs de localhost mezcladas con producción.** 🔍
