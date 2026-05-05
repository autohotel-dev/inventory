import axios from 'axios';
import { createClient } from '@/lib/supabase/client';
import { telemetry } from '@/lib/telemetry';

// Helper for telemetry module detection (copied from supabase wrapper)
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

// Configuración de FastAPI URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de Peticiones: Inyectar JWT (temporalmente de Supabase) y Telemetría
apiClient.interceptors.request.use(
  async (config) => {
    // 1. Añadir Auth Token si existe
    if (typeof window !== 'undefined') {
      let accessToken: string | null = null;
      
      if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
        try {
          const { fetchAuthSession } = await import('aws-amplify/auth');
          const session = await fetchAuthSession();
          accessToken = session.tokens?.accessToken?.toString() || null;
        } catch {
          // ignore
        }
      }

      if (!accessToken) {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token || null;
      }
      
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    // 2. Preparar Telemetría (guardar metadata en config para usarla en la respuesta)
    (config as any).metadata = { startTime: performance.now() };

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de Respuestas: Reportar a Telemetría
apiClient.interceptors.response.use(
  (response) => {
    const config = response.config as any;
    if (config?.metadata?.startTime) {
      const durationMs = Math.round(performance.now() - config.metadata.startTime);
      const endpoint = config.url || '';
      
      // Enviar Telemetría
      telemetry.track({
        module: getModuleNameFromUrl(endpoint),
        page: typeof window !== 'undefined' ? window.location.pathname : 'Server',
        action_type: 'API_REQUEST',
        action_name: `${config.method?.toUpperCase() || 'GET'} ${endpoint.split('?')[0].split('/').pop()}`,
        duration_ms: durationMs,
        payload: config.data ? JSON.parse(config.data) : null,
        endpoint: endpoint,
        is_success: true,
        error_details: null,
      });
    }
    return response;
  },
  (error) => {
    const config = error.config as any;
    if (config?.metadata?.startTime) {
      const durationMs = Math.round(performance.now() - config.metadata.startTime);
      const endpoint = config.url || '';
      
      telemetry.track({
        module: getModuleNameFromUrl(endpoint),
        page: typeof window !== 'undefined' ? window.location.pathname : 'Server',
        action_type: 'API_REQUEST',
        action_name: `${config.method?.toUpperCase() || 'GET'} ${endpoint.split('?')[0].split('/').pop()}`,
        duration_ms: durationMs,
        payload: config.data ? JSON.parse(config.data) : null,
        endpoint: endpoint,
        is_success: false,
        error_details: error.response?.data || error.message,
      });
    }
    return Promise.reject(error);
  }
);
