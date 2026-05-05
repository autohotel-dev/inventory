import { createBrowserClient } from "@supabase/ssr";

import { telemetry } from "../telemetry";

// Helper for telemetry module detection
function getModuleNameFromUrl(url: string): string {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/operacion-en-vivo')) return 'Operación en Vivo';
    if (pathname.startsWith('/dashboard')) return 'Dashboard';
    if (pathname.startsWith('/sales')) return 'Recepción / Ventas';
    if (pathname.startsWith('/movements')) return 'Inventario / Movimientos';
    return pathname.split('/')[1] || 'General';
  }
  return 'Server/General';
}

// Custom fetch wrapper to intercept Supabase requests
const telemetryFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = input.toString();
  
  // Ignore auth/realtime or non-REST requests to avoid spam and loops
  if (urlStr.includes('/auth/v1/') || urlStr.includes('/realtime/v1/') || urlStr.includes('/api/ops-sync')) {
    return fetch(input, init);
  }

  const startTime = performance.now();
  
  // Capture request payload if available
  let payload: any = null;
  if (init?.body && typeof init.body === 'string') {
    try {
      payload = JSON.parse(init.body);
    } catch {
      payload = init.body; // fallback to raw string
    }
  }

  let isSuccess = false;
  let errorDetails: any = null;
  let response: Response | null = null;

  try {
    response = await fetch(input, init);
    isSuccess = response.ok;
    
    if (!isSuccess) {
      // Try to clone and read error body
      try {
        const errorText = await response.clone().text();
        errorDetails = { status: response.status, statusText: response.statusText, response: errorText };
      } catch (e) {
        errorDetails = { status: response.status, statusText: response.statusText };
      }
    }
    
    return response;
  } catch (error: any) {
    errorDetails = error.message || String(error);
    throw error;
  } finally {
    const duration_ms = Math.round(performance.now() - startTime);
    
    // Extract endpoint path
    let endpoint = urlStr;
    try {
      const parsedUrl = new URL(urlStr);
      endpoint = parsedUrl.pathname + parsedUrl.search;
    } catch (e) {}

    // Only log if it's a mutation (POST, PATCH, DELETE) or if you want ALL GETs too.
    // The user requested ALL interaction, so we will log all REST operations.
    // However, to keep it clean, we might just log mutations. Let's log all for now.
    telemetry.track({
      module: getModuleNameFromUrl(urlStr),
      page: typeof window !== 'undefined' ? window.location.pathname : 'Server',
      action_type: 'API_REQUEST',
      action_name: `${init?.method || 'GET'} ${endpoint.split('?')[0].split('/').pop()}`,
      duration_ms,
      payload,
      endpoint,
      is_success: isSuccess,
      error_details: errorDetails,
    });
  }
};

export function createClient() {
  if (typeof window !== "undefined") {
    if (!window.supabaseClient) {
      window.supabaseClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
        {
          global: {
            fetch: telemetryFetch
          }
        }
      );
    }
    return window.supabaseClient;
  }

  // Fallback para SSR
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      global: {
        fetch: telemetryFetch
      }
    }
  );
}

// Declaración de tipos para window
declare global {
  interface Window {
    supabaseClient: any;
  }
}
