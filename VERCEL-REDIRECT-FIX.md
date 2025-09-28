# 🔧 SOLUCIÓN: SERVICE WORKER REDIRECT ERROR

## ❌ PROBLEMA IDENTIFICADO:
```
SW registro falló: The script resource is behind a redirect, which is disallowed.
```

**Causa:** Vercel tiene redirect `pixanpax.com → www.pixanpax.com` pero el Service Worker no puede seguir redirects.

## ✅ SOLUCIONES:

### **Opción 1: Configurar Vercel Dashboard (RECOMENDADO)**

#### **1. 🌐 En Vercel Dashboard:**
1. **Ve a:** `https://vercel.com/dashboard`
2. **Selecciona** tu proyecto
3. **Settings → Domains**
4. **Configura:**
   - `www.pixanpax.com` → **Primary Domain**
   - `pixanpax.com` → **Redirect to www.pixanpax.com**

#### **2. 📱 Excepciones para PWA:**
En **Settings → Functions** o **vercel.json**:
```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control", 
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/sw.js",
      "destination": "/sw.js"
    },
    {
      "source": "/manifest.json", 
      "destination": "/api/manifest"
    }
  ]
}
```

### **Opción 2: Variables de Entorno**

#### **En Vercel Dashboard → Settings → Environment Variables:**
```
NEXT_PUBLIC_SITE_URL = https://www.pixanpax.com
```

### **Opción 3: Usar Dominio Sin WWW (ALTERNATIVA)**

#### **Si prefieres pixanpax.com sin www:**
1. **Vercel Dashboard → Domains**
2. **Configura:**
   - `pixanpax.com` → **Primary Domain**
   - `www.pixanpax.com` → **Redirect to pixanpax.com**

3. **Actualizar código:**
```typescript
// En layout.tsx y otros archivos
const defaultUrl = "https://pixanpax.com"; // Sin www
```

## 🚀 PASOS PARA APLICAR:

### **1. 📋 Deploy Configuración Actual:**
```bash
git add .
git commit -m "Update vercel.json for PWA redirects"
git push
```

### **2. 🌐 Configurar Vercel Dashboard:**
1. **Domains:** Configurar dominio primario
2. **Environment Variables:** Agregar NEXT_PUBLIC_SITE_URL
3. **Redeploy:** Forzar nuevo deploy

### **3. 🔍 Verificar:**
1. **Service Worker:** `https://www.pixanpax.com/sw.js` (sin redirect)
2. **Manifest:** `https://www.pixanpax.com/api/manifest` (JSON válido)
3. **PWA:** Sin errores de registro

## 🎯 CONFIGURACIÓN RECOMENDADA:

### **Vercel Domains:**
```
✅ www.pixanpax.com (Primary)
↗️ pixanpax.com → redirect to www.pixanpax.com
```

### **Environment Variables:**
```
NEXT_PUBLIC_SITE_URL=https://www.pixanpax.com
```

### **vercel.json (ya actualizado):**
```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Service-Worker-Allowed",
          "value": "/"
        }
      ]
    }
  ]
}
```

## 🔍 VERIFICACIÓN FINAL:

### **1. Test Service Worker:**
```javascript
// En consola del navegador:
navigator.serviceWorker.register('/sw.js')
  .then(reg => console.log('SW OK:', reg))
  .catch(err => console.log('SW Error:', err));
```

### **2. Test URLs Directas:**
- `https://www.pixanpax.com/sw.js` → Debe retornar JavaScript
- `https://www.pixanpax.com/api/manifest` → Debe retornar JSON
- **NO debe haber redirects** en estas URLs

### **3. PWA Funcionando:**
- ✅ Service Worker registrado
- ✅ Manifest sin errores
- ✅ Botón de instalación visible

---

**El problema está en la configuración de dominios de Vercel. Configura el dominio primario correctamente y el PWA funcionará.** 🌐
