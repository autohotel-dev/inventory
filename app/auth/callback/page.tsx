import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AuthCallback({
  searchParams,
}: {
  searchParams: { redirect_to?: string };
}) {
  const supabase = await createClient();
  
  // Get the session after OAuth callback
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Auth callback error:', error);
    redirect('/auth/login?error=callback_error');
  }
  
  if (data.session) {
    // User is authenticated, redirect to dashboard or specified redirect
    const redirectTo = searchParams.redirect_to || '/dashboard';
    redirect(redirectTo);
  } else {
    // No session, redirect to login
    redirect('/auth/login');
  }
  
  // This should never be reached, but just in case
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Procesando autenticación...</p>
      </div>
    </div>
  );
}
