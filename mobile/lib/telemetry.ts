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
