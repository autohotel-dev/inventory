"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔍 OAuth Callback Starting...');
        console.log('- Current URL:', window.location.href);

        // Esperar un momento para que el middleware procese el código OAuth
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verificar si hay una sesión válida después del callback
        const { data, error } = await supabase.auth.getSession();

        console.log('- Session check result:', { hasSession: !!data.session, error });

        if (error) {
          console.error('Error getting session after callback:', error);
          router.push('/auth/login?error=callback_error');
          return;
        }

        // SIEMPRE redirigir al dashboard después del callback, o a la URL especificada
        const redirectTo = searchParams.get("redirect_to") || "/dashboard";
        console.log(`🚀 FORCING REDIRECT TO ${redirectTo}...`);

        // Ensure middleware/server components see the new session
        router.refresh();
        router.push(redirectTo);

      } catch (error) {
        console.error('Callback processing error:', error);
        // Incluso si hay error, intentar ir al dashboard
        router.push("/dashboard");
      }
    };

    // Solo ejecutar si estamos en el cliente
    if (typeof window !== 'undefined') {
      handleAuthCallback();
    }
  }, [router, searchParams, supabase.auth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completando autenticación...</p>
      </div>
    </div>
  );
}
