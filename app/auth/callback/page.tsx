"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the OAuth callback
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          router.push('/auth/login?error=callback_error');
          return;
        }

        if (data.session) {
          // User is authenticated, redirect to dashboard or specified redirect
          const redirectTo = searchParams.get('redirect_to') || '/dashboard';
          router.push(redirectTo);
        } else {
          // No session, redirect to login
          router.push('/auth/login');
        }
      } catch (error) {
        console.error('Callback error:', error);
        router.push('/auth/login?error=unexpected_error');
      }
    };

    handleAuthCallback();
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
