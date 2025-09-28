"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ForceDashboardRedirect } from "./force-dashboard-redirect";

export function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [shouldForceRedirect, setShouldForceRedirect] = useState(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Esperar un momento para que el middleware procese el código OAuth
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar si hay una sesión válida después del callback
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session after callback:', error);
          router.push('/auth/login?error=callback_error');
          return;
        }

        if (data.session) {
          // Usuario autenticado exitosamente
          const redirectTo = searchParams.get('redirect_to') || '/dashboard';
          
          // Debug: mostrar información del redirect
          console.log('🔍 OAuth Callback Debug:');
          console.log('- Session found:', !!data.session);
          console.log('- redirect_to param:', searchParams.get('redirect_to'));
          console.log('- Final redirectTo:', redirectTo);
          console.log('- Current URL:', window.location.href);
          
          // ACTIVAR COMPONENTE DE FORZAR REDIRECT
          console.log('- Activating force redirect component...');
          setShouldForceRedirect(true);
        } else {
          // No hay sesión válida, redirigir al login
          console.warn('No session found after OAuth callback');
          router.push('/auth/login?error=no_session');
        }
      } catch (error) {
        console.error('Callback processing error:', error);
        router.push('/auth/login?error=unexpected_error');
      }
    };

    // Solo ejecutar si estamos en el cliente
    if (typeof window !== 'undefined') {
      handleAuthCallback();
    }
  }, [router, searchParams, supabase.auth]);

  // Si debemos forzar redirect, mostrar el componente de forzar redirect
  if (shouldForceRedirect) {
    return <ForceDashboardRedirect />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completando autenticación...</p>
      </div>
    </div>
  );
}
