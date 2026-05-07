import { API_BASE_URL } from './client';
import { fetchAuthSession } from 'aws-amplify/auth';

type SubscriptionCallback = (payload: any) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private isConnecting: boolean = false;
  private isIntentionalClose: boolean = false;
  private subscriptions: Map<string, SubscriptionCallback[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private pingInterval: NodeJS.Timeout | null = null;
  private isAuthenticated: boolean = false;

  constructor() {
    // ws://localhost:8000/ws
    const wsBaseUrl = process.env.EXPO_PUBLIC_WS_URL || API_BASE_URL.replace(/^http/, 'ws') + '/ws';
    this.url = wsBaseUrl;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.isIntentionalClose = false;
    
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = async () => {
        console.log('[WebSocket] Conectado. Autenticando...');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPing();
        
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.accessToken?.toString() || session.tokens?.idToken?.toString();
            if (token) {
                this.ws?.send(JSON.stringify({ type: 'auth', token }));
            } else {
                console.warn('[WebSocket] No hay token disponible para autenticar. Cerrando conexión preventivamente.');
                this.disconnect();
            }
        } catch (e) {
            console.error('[WebSocket] Error al obtener token para auth:', e);
            this.disconnect();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'pong') return; // Ignorar pongs
          
          if (data.type === 'auth_success') {
            console.log('[WebSocket] Autenticación exitosa');
            this.isAuthenticated = true;
            // Al autenticar, suscribir a todos los canales guardados
            this.subscriptions.forEach((callbacks, channel) => {
                if (callbacks.length > 0) {
                    this.ws?.send(JSON.stringify({ type: 'subscribe', channel }));
                }
            });
            return;
          }
          
          if (data.type === 'error' || data.type === 'subscribed' || data.type === 'unsubscribed') {
            return; // Manejo interno de control
          }

          // Asumimos que el payload tiene { channel: string, event: string, data: any }
          const channel = data.channel || 'global';
          
          const callbacks = this.subscriptions.get(channel);
          if (callbacks) {
            callbacks.forEach(cb => cb(data));
          }
        } catch (e) {
          console.error('[WebSocket] Error procesando mensaje:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Desconectado');
        this.isConnecting = false;
        this.isAuthenticated = false;
        this.stopPing();
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (e) {
      console.error('[WebSocket] Fallo de inicialización:', e);
      this.isConnecting = false;
      this.handleReconnect();
    }
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleReconnect() {
    if (this.isIntentionalClose) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const timeout = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`[WebSocket] Reconectando en ${timeout}ms...`);
      setTimeout(() => this.connect(), timeout);
    } else {
      console.error('[WebSocket] Se alcanzó el límite máximo de reconexiones');
    }
  }

  disconnect() {
    this.isIntentionalClose = true;
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(channel: string, callback: SubscriptionCallback) {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);
    }
    this.subscriptions.get(channel)?.push(callback);
    
    // Si no estamos conectados, conectar
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    } else if (this.isAuthenticated) {
      // Si ya estamos conectados y autenticados, enviar la suscripción
      this.ws.send(JSON.stringify({ type: 'subscribe', channel }));
    }

    // Retorna una función para desuscribirse
    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        const remaining = callbacks.filter(cb => cb !== callback);
        this.subscriptions.set(channel, remaining);
        
        if (remaining.length === 0 && this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated) {
            this.ws.send(JSON.stringify({ type: 'unsubscribe', channel }));
        }
      }
    };
  }
}

export const wsManager = new WebSocketManager();

/**
 * Hook para emular supabase.channel() en React Native
 */
export function useRealtimeSubscription(channel: string, callback: SubscriptionCallback) {
  // Uso:
  // useEffect(() => {
  //   const unsubscribe = useRealtimeSubscription('rooms', (payload) => { ... });
  //   return () => unsubscribe();
  // }, []);
  return wsManager.subscribe(channel, callback);
}
