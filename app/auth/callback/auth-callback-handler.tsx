"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AuthCallbackHandler() {
  const router = useRouter();
  const supabase = createClient();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get redirect URL from current URL params (client-side only)
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirect_to') || '/dashboard';
        
        // Handle the OAuth callback
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          router.push('/auth/login?error=callback_error');
          return;
        }

        if (data.session) {
          // User is authenticated, redirect to dashboard or specified redirect
          router.push(redirectTo);
        } else {
          // No session, redirect to login
          router.push('/auth/login');
        }
      } catch (error) {
        console.error('Callback error:', error);
        router.push('/auth/login?error=unexpected_error');
      } finally {
        setIsProcessing(false);
      }
    };

    // Only run on client side
    if (typeof window !== 'undefined') {
      handleAuthCallback();
    }
  }, [router, supabase.auth]);

  if (isProcessing) {
    return (
      <>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completando autenticación...</p>
      </>
    );
  }

  return (
    <>
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-muted-foreground">Redirigiendo...</p>
    </>
  );
}
