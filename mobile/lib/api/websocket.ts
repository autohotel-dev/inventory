import { API_BASE_URL } from './client';

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

  constructor() {
    // ws://localhost:8000/ws
    const wsBaseUrl = API_BASE_URL.replace(/^http/, 'ws');
    this.url = `${wsBaseUrl}/ws`;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.isIntentionalClose = false;
    
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Conectado');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'pong') return; // Ignorar pongs

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
    }

    // Retorna una función para desuscribirse
    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        this.subscriptions.set(
          channel,
          callbacks.filter(cb => cb !== callback)
        );
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
