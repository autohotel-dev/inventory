# 🔍 DEBUG: Redirect al Dashboard

## ❌ PROBLEMA:
OAuth funciona pero redirige a la URL principal (`/`) en lugar del dashboard (`/dashboard`).

## 🔧 DEBUG AGREGADO:

### **1. En Google Login Button:**
```typescript
console.log('🔍 Google OAuth Debug:');
console.log('- Base URL:', baseUrl);
console.log('- Redirect URL:', redirectUrl);
```

### **2. En Callback Handler:**
```typescript
console.log('🔍 OAuth Callback Debug:');
console.log('- Session found:', !!data.session);
console.log('- redirect_to param:', searchParams.get('redirect_to'));
console.log('- Final redirectTo:', redirectTo);
console.log('- Current URL:', window.location.href);
console.log('- Final URL:', finalUrl);
```

## 🚀 PASOS PARA DEBUG:

### **1. Deploy los Cambios:**
```bash
git add .
git commit -m "Add OAuth debug logs"
git push
```

### **2. Probar con Consola Abierta:**
1. **Ve a** `https://www.pixanpax.com`
2. **Abre F12** → **Console tab**
3. **Click** "Continuar con Google"
4. **Observa los logs** en cada paso

### **3. Información a Revisar:**

#### **A. En el Login (antes de ir a Google):**
```
🔍 Google OAuth Debug:
- Base URL: https://www.pixanpax.com
- Redirect URL: https://www.pixanpax.com/auth/callback?redirect_to=/dashboard
```

#### **B. En el Callback (después de Google):**
```
🔍 OAuth Callback Debug:
- Session found: true
- redirect_to param: /dashboard
- Final redirectTo: /dashboard
- Current URL: https://www.pixanpax.com/auth/callback?code=xxx&redirect_to=/dashboard
- Final URL: https://www.pixanpax.com/dashboard
```

## 🎯 POSIBLES PROBLEMAS:

### **1. redirect_to param se pierde:**
Si ves `redirect_to param: null`, significa que el parámetro no llega al callback.

**Solución:** Verificar configuración de Supabase.

### **2. Final URL es correcta pero no redirige:**
Si la Final URL es `https://www.pixanpax.com/dashboard` pero no redirige.

**Solución:** Problema en el `window.location.href`.

### **3. Redirige a URL principal:**
Si todo parece correcto pero termina en `/`.

**Solución:** Middleware o configuración de Next.js.

## 🔧 SOLUCIONES ALTERNATIVAS:

### **Opción 1: Usar router.push en lugar de window.location:**
```typescript
// En lugar de:
window.location.href = finalUrl;

// Usar:
router.push(redirectTo);
```

### **Opción 2: Forzar redirect específico:**
```typescript
// Forzar siempre al dashboard
window.location.href = `${baseUrl}/dashboard`;
```

### **Opción 3: Usar replace en lugar de href:**
```typescript
window.location.replace(finalUrl);
```

## 📋 CHECKLIST DE VERIFICACIÓN:

- [ ] Logs aparecen en consola
- [ ] Base URL es correcta
- [ ] Redirect URL incluye `?redirect_to=/dashboard`
- [ ] Session found es `true`
- [ ] redirect_to param es `/dashboard`
- [ ] Final URL es `https://www.pixanpax.com/dashboard`
- [ ] Redirige correctamente

---

**Ejecuta el debug y comparte los logs de la consola para identificar exactamente dónde está el problema.** 🔍
