import axios from 'axios';
import { telemetry } from '../telemetry';
import { fetchAuthSession } from 'aws-amplify/auth';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper for telemetry module detection
function getModuleNameFromUrl(url: string): string {
  if (url.includes('/auth/')) return 'Auth';
  if (url.includes('/system/crud/')) return 'Database';
  return 'General';
}

// Interceptor de Peticiones: Inyectar JWT y Telemetría
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const session = await fetchAuthSession();
      const accessToken = session.tokens?.accessToken?.toString();
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch {
      // Ignorar si no hay sesión
    }

    // Preparar Telemetría
    (config as any).metadata = { startTime: performance.now() };
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de Respuestas: Reportar a Telemetría
apiClient.interceptors.response.use(
  (response) => {
    const config = response.config as any;
    if (config?.metadata?.startTime) {
      const durationMs = Math.round(performance.now() - config.metadata.startTime);
      const endpoint = config.url || '';
      
      telemetry.track({
        module: getModuleNameFromUrl(endpoint),
        page: 'App Móvil',
        action_type: 'API_REQUEST',
        action_name: `${config.method?.toUpperCase() || 'GET'} ${endpoint.split('?')[0].split('/').pop()}`,
        duration_ms: durationMs,
        payload: config.data ? JSON.parse(config.data as unknown as string) : null,
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
        page: 'App Móvil',
        action_type: 'API_REQUEST',
        action_name: `${config.method?.toUpperCase() || 'GET'} ${endpoint.split('?')[0].split('/').pop()}`,
        duration_ms: durationMs,
        payload: config.data ? JSON.parse(config.data as unknown as string) : null,
        endpoint: endpoint,
        is_success: false,
        error_details: error.response?.data || error.message,
      });
    }
    return Promise.reject(error);
  }
);
