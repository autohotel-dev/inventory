export interface TelemetryEvent {
  module?: string;
  page: string;
  action_type: 'UI_CLICK' | 'API_REQUEST' | 'PAGE_VIEW';
  action_name: string;
  duration_ms?: number;
  payload?: any;
  endpoint?: string;
  is_success: boolean;
  error_details?: any;
  timestamp?: string;
}

class TelemetryTracker {
  private buffer: TelemetryEvent[] = [];

  track(event: TelemetryEvent) {
    this.buffer.push({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    });
  }

  getAndClearBuffer(): TelemetryEvent[] {
    if (this.buffer.length === 0) return [];
    const eventsToFlush = [...this.buffer];
    this.buffer = [];
    return eventsToFlush;
  }
}

export const telemetry = new TelemetryTracker();

// Configurar el "Flusher" que manda los datos cada 5 segundos
setInterval(async () => {
  const events = telemetry.getAndClearBuffer();
  if (events.length === 0) return;

  try {
    const { apiClient } = await import('./api/client');
    const { fetchAuthSession } = await import('aws-amplify/auth');
    
    let userId = null;
    try {
      const session = await fetchAuthSession();
      userId = session.userSub;
    } catch {
      // Ignorar
    }

    const insertPayload = events.map(event => ({
      user_id: userId,
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

    // El endpoint de telemetría bulk
    await apiClient.post('/system/ops-sync', { events: insertPayload });
  } catch (error) {
    console.error('[Telemetry Móvil] Fallo al sincronizar:', error);
  }
}, 5000);
