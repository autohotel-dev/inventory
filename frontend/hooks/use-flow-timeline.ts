"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FlowEvent {
  id: string;
  flow_id: string;
  event_type: string;
  event_category: string;
  description: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  metadata: Record<string, any>;
  sequence_number: number;
  duration_from_previous_ms: number;
  created_at: string;
}

export interface FlowDetail {
  id: string;
  flow_number: number;
  room_number: string;
  status: string;
  current_stage: string;
  started_at: string;
  completed_at: string | null;
}

// ─── Event Display Config ────────────────────────────────────────────────────

export const EVENT_ICONS: Record<string, string> = {
  // Room
  ROOM_ASSIGNED: "🏨",
  ROOM_STATUS_CHANGED: "🔄",
  ROOM_CHANGED: "🔀",
  // Valet
  VALET_ENTRY_ACCEPTED: "🚗",
  VALET_VEHICLE_REGISTERED: "📋",
  VALET_PAYMENT_COLLECTED: "💰",
  VALET_CHECKOUT_PROPOSED: "🚪",
  VALET_CHECKOUT_CONFIRMED: "✅",
  // Client
  CLIENT_DATA_FILLED: "👤",
  VEHICLE_DATA_FILLED: "🚙",
  PERSON_COUNT_UPDATED: "👥",
  // Payments
  PAYMENT_PENDING_CREATED: "⏳",
  PAYMENT_COLLECTED_VALET: "💵",
  PAYMENT_CORROBORATED: "🔍",
  PAYMENT_CONFIRMED: "✅",
  PAYMENT_METHOD_CHANGED: "💳",
  PAYMENT_CANCELLED: "❌",
  PAYMENT_REFUNDED: "↩️",
  // Consumption
  CONSUMPTION_ADDED: "🍽️",
  CONSUMPTION_ACCEPTED: "👍",
  CONSUMPTION_DELIVERED: "📦",
  CONSUMPTION_PAID: "💲",
  CONSUMPTION_CANCELLED: "🚫",
  // Extras
  EXTRA_HOUR_ADDED: "⏰",
  EXTRA_HOUR_PAID: "💰",
  EXTRA_PERSON_ADDED: "➕",
  EXTRA_PERSON_PAID: "💰",
  PERSON_ADDED: "👤➕",
  PERSON_REMOVED: "👤➖",
  DAMAGE_REPORTED: "⚠️",
  DAMAGE_CHARGED: "💸",
  // Checkout
  CHECKOUT_INITIATED: "🔚",
  CHECKOUT_PAYMENT_PROCESSED: "💳",
  CHECKOUT_COMPLETED: "🏁",
  TOLERANCE_STARTED: "⏱️",
  TOLERANCE_EXPIRED: "⏱️❌",
  // Courtesy / Discount
  COURTESY_APPLIED: "🎁",
  DISCOUNT_APPLIED: "🏷️",
  // Renewal
  RENEWAL_APPLIED: "🔄",
  // General
  NOTE_ADDED: "📝",
  CUSTOM_EVENT: "📌",
};

export const CATEGORY_COLORS: Record<string, string> = {
  ROOM: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  PAYMENT: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  VALET: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  CONSUMPTION: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  CHECKOUT: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  SYSTEM: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  EXTRAS: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  CLIENT: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
};

export const CATEGORY_LABELS: Record<string, string> = {
  ROOM: "Habitación",
  PAYMENT: "Pago",
  VALET: "Cochero",
  CONSUMPTION: "Consumo",
  CHECKOUT: "Checkout",
  SYSTEM: "Sistema",
  EXTRAS: "Extras",
  CLIENT: "Cliente",
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFlowTimeline(flowId: string | null) {
  const [events, setEvents] = useState<FlowEvent[]>([]);
  const [flowDetail, setFlowDetail] = useState<FlowDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // ─── Fetch Timeline ────────────────────────────────────────────────────

  const fetchTimeline = useCallback(async () => {
    if (!flowId) return;

    setLoading(true);
    const supabase = createClient();

    try {
      // Fetch flow detail
      const { data: flowData } = await supabase
        .from("operation_flows")
        .select("id, flow_number, room_number, status, current_stage, started_at, completed_at")
        .eq("id", flowId)
        .single();

      if (flowData) {
        setFlowDetail(flowData as FlowDetail);
      }

      // Fetch events via RPC
      const { data: eventsData, error } = await supabase.rpc("get_flow_timeline", {
        p_flow_id: flowId,
      });

      if (error) {
        console.error("[useFlowTimeline] Error fetching timeline:", error);
      } else {
        setEvents((eventsData || []) as FlowEvent[]);
      }
    } catch (err) {
      console.error("[useFlowTimeline] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  // ─── Realtime for new events ─────────────────────────────────────────

  useEffect(() => {
    if (!flowId) return;

    const supabase = createClient();

    // Clean up previous
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`flow-timeline-${flowId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "flow_events",
          filter: `flow_id=eq.${flowId}`,
        },
        (payload: { new: Record<string, any> }) => {
          const newEvent = payload.new as FlowEvent;
          setEvents((prev) => {
            // Avoid duplicates
            if (prev.some((e) => e.id === newEvent.id)) return prev;
            return [...prev, newEvent];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [flowId]);

  // ─── Initial Fetch ─────────────────────────────────────────────────────

  useEffect(() => {
    if (flowId) {
      fetchTimeline();
    } else {
      setEvents([]);
      setFlowDetail(null);
    }
  }, [flowId, fetchTimeline]);

  // ─── Computed ──────────────────────────────────────────────────────────

  const filteredEvents =
    categoryFilter === "all"
      ? events
      : events.filter((e) => e.event_category === categoryFilter);

  const totalDurationMs = events.reduce(
    (sum, e) => sum + (e.duration_from_previous_ms || 0),
    0
  );

  const categories = Array.from(new Set(events.map((e) => e.event_category)));

  const eventsByCategory = categories.reduce(
    (acc, cat) => {
      acc[cat] = events.filter((e) => e.event_category === cat).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    events: filteredEvents,
    allEvents: events,
    flowDetail,
    loading,
    categoryFilter,
    setCategoryFilter,
    categories,
    eventsByCategory,
    totalDurationMs,
    totalEvents: events.length,
    refetch: fetchTimeline,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatFlowId(flowNumber: number): string {
  return `F${String(flowNumber).padStart(4, "0")}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
}

export function formatElapsedTime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  return formatDuration(now - start);
}
