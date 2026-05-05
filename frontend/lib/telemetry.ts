export type TelemetryActionType = 'UI_CLICK' | 'API_REQUEST' | 'PAGE_VIEW';

export interface TelemetryEvent {
  module?: string;
  page: string;
  action_type: TelemetryActionType;
  action_name: string;
  duration_ms?: number;
  payload?: any;
  endpoint?: string;
  is_success?: boolean;
  error_details?: any;
  timestamp: string;
}

class TelemetryTracker {
  private queue: TelemetryEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 20;
  private readonly FLUSH_INTERVAL_MS = 5000; // 5 seconds

  constructor() {
    if (typeof window !== 'undefined') {
      this.flushInterval = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
      
      // Attempt to flush on page unload
      window.addEventListener('beforeunload', () => {
        this.flush(true);
      });
    }
  }

  public track(event: Omit<TelemetryEvent, 'timestamp'>) {
    this.queue.push({
      ...event,
      timestamp: new Date().toISOString(),
    });

    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  public async flush(isUnload = false) {
    if (this.queue.length === 0) return;

    // Create a copy of the queue and clear the original
    const batch = [...this.queue];
    this.queue = [];

    try {
      if (isUnload && navigator.sendBeacon) {
        // Use sendBeacon for more reliable delivery during page unload
        navigator.sendBeacon('/api/telemetry', JSON.stringify({ events: batch }));
      } else {
        // Standard fetch
        const response = await fetch('/api/telemetry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ events: batch }),
          // Prevent this fetch from being intercepted by our global patch
          // We can use a custom header or internal signal to avoid loops
          // However, in the interceptor we will check the URL. If URL contains '/api/telemetry', we ignore it.
        });
        
        if (!response.ok) {
          console.error('[TelemetryTracker] Failed to flush events', await response.text());
        }
      }
    } catch (error) {
      console.error('[TelemetryTracker] Error flushing events', error);
      // In a very robust system, we might put them back in the queue if it fails,
      // but for telemetry we often accept some data loss over memory leaks.
    }
  }
}

// Singleton instance
export const telemetry = new TelemetryTracker();
