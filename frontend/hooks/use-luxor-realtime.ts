import { useEffect } from "react";
import { luxorRealtimeClient } from "@/lib/api/websocket";

export interface LuxorRealtimeEvent {
  table: string;
  schema: string;
  type: "INSERT" | "UPDATE" | "DELETE";
  record: any | null;
  old_record: any | null;
  commit_timestamp: string;
}

/**
 * Hook to subscribe to PostgreSQL table changes via FastAPI WebSockets.
 * Replaces: supabase.channel('...').on('postgres_changes', { table: 'xyz' }, callback)
 * 
 * @param table The name of the database table to listen to
 * @param callback Function to execute when a change occurs
 */
export function useLuxorRealtime(
  table: string, 
  callback: (payload: LuxorRealtimeEvent) => void
) {
  useEffect(() => {
    // luxorRealtimeClient automatically connects if not connected
    const unsubscribe = luxorRealtimeClient.subscribe(table, callback);
    
    return () => {
      unsubscribe();
    };
  }, [table, callback]);
}
