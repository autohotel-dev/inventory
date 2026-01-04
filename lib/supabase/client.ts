import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // @ts-ignore - Usar globalThis para persistir la instancia durante HMR (Hot Module Replacement)
  if (typeof window !== "undefined") {
    if (!window.supabaseClient) {
      window.supabaseClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
      );
    }
    return window.supabaseClient;
  }

  // Fallback para SSR (aunque createBrowserClient suele manejarlo)
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
  );
}

// Declaración de tipos para window
declare global {
  interface Window {
    supabaseClient: any;
  }
}
