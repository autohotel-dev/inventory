import { API_BASE_URL } from "./client";

type MessageHandler = (payload: any) => void;

class LuxorWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 second
  private isConnecting = false;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (process.env.NEXT_PUBLIC_WS_URL) {
      this.url = process.env.NEXT_PUBLIC_WS_URL;
    } else {
      const baseUrl = API_BASE_URL.replace(/^http/, 'ws');
      this.url = `${baseUrl}/ws`;
    }
  }

  public connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    if (typeof window === 'undefined') return;

    this.isConnecting = true;
    console.log(`[LuxorWS] Connecting to ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("[LuxorWS] Connected successfully");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Setup ping to keep connection alive
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000); // Send ping every 30s
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "pong") return; // Ignore ping responses
          
          // data format from pg_notify trigger:
          // { table: 'rooms', schema: 'public', type: 'UPDATE', record: {...}, old_record: {...} }
          const table = data.table;
          if (table) {
            const callbacks = this.listeners.get(table);
            if (callbacks) {
              callbacks.forEach(cb => cb(data));
            }
          }
        } catch (err) {
          console.error("[LuxorWS] Error parsing message:", err, event.data);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        if (this.pingInterval) clearInterval(this.pingInterval);
        
        console.log(`[LuxorWS] Disconnected (Code: ${event.code})`);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        console.error("[LuxorWS] WebSocket Error:", error);
        // onclose is generally called right after onerror, so reconnect logic stays there.
      };
    } catch (err) {
      this.isConnecting = false;
      console.error("[LuxorWS] Setup Error:", err);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[LuxorWS] Max reconnect attempts reached. Please refresh the page.");
      return;
    }

    const delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    console.log(`[LuxorWS] Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  public subscribe(table: string, callback: MessageHandler) {
    if (!this.listeners.has(table)) {
      this.listeners.set(table, new Set());
    }
    this.listeners.get(table)?.add(callback);
    
    // Auto-connect if not connected when someone subscribes
    if (this.ws?.readyState !== WebSocket.OPEN && !this.isConnecting) {
      this.connect();
    }

    return () => {
      this.listeners.get(table)?.delete(callback);
    };
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }
}

// Export as a singleton
export const luxorRealtimeClient = new LuxorWebSocketClient();
