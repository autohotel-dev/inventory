import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { telemetry } from './telemetry';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Interceptor de telemetría para Supabase Móvil
const telemetryFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = input.toString();
  
  // Ignorar Auth, Realtime y las inserciones a la propia telemetría (para evitar bucle infinito)
  if (
    urlStr.includes('/auth/v1/') || 
    urlStr.includes('/realtime/v1/') || 
    urlStr.includes('system_telemetry')
  ) {
    return fetch(input, init);
  }

  const startTime = performance.now();
  let payload: any = null;
  
  if (init?.body && typeof init.body === 'string') {
    try {
      payload = JSON.parse(init.body);
    } catch {
      payload = init.body;
    }
  }

  let isSuccess = false;
  let errorDetails: any = null;
  let response: Response | null = null;

  try {
    response = await fetch(input, init);
    isSuccess = response.ok;
    
    if (!isSuccess) {
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
    let endpoint = urlStr;
    try {
      const parsedUrl = new URL(urlStr);
      endpoint = parsedUrl.pathname + parsedUrl.search;
    } catch (e) {}

    telemetry.track({
      module: 'App Móvil (Cochero)',
      page: 'SupabaseClient',
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: telemetryFetch,
  }
});

// Configurar el "Flusher" que manda los datos cada 5 segundos
setInterval(async () => {
  const events = telemetry.getAndClearBuffer();
  if (events.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();

  const insertPayload = events.map(event => ({
    user_id: user?.id || null,
    module: event.module,
    page: event.page,
    action_type: event.action_type,
    action_name: event.action_name,
    duration_ms: event.duration_ms || null,
    payload: event.payload || null,
    endpoint: event.endpoint || null,
    is_success: event.is_success,
    error_details: event.error_details || null,
    created_at: event.timestamp || new Date().toISOString()
  }));

  // Hacer el insert a supabase silenciosamente.
  // Esto NO causará bucle porque ignoramos urlStr.includes('system_telemetry')
  supabase.from('system_telemetry').insert(insertPayload).then(({ error }) => {
    if (error) console.error('[Telemetry Móvil] Fallo al sincronizar:', error);
  });

}, 5000);
