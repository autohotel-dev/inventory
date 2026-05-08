/**
 * Core room action helpers: stays, tolerance, time extensions, action wrappers.
 * Shift helpers → ./shift-helpers.ts
 * Payment helpers → ./payment-helpers.ts
 */
"use client";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room, RoomStay } from "@/components/sales/room-types";
import { logger } from "@/lib/utils/logger";

// Re-export from sub-modules for backward compatibility
export {
  getCurrentShiftId,
  getReceptionShiftId,
  getCurrentEmployeeId,
  getReceptionEmployeeId,
  getReceptionContext,
  invalidateReceptionCache,
} from "./shift-helpers";

export {
  updateSalesOrderTotals,
  createPendingCharge,
  updatePendingPaymentsHelper,
} from "./payment-helpers";

// ─── Payment Reference ──────────────────────────────────────────────

export function generatePaymentReference(prefix: string = "PAY"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// ─── Active Stay ─────────────────────────────────────────────────────

export function getActiveStay(room: Room): RoomStay | null {
  return (room.room_stays || []).find((stay) => stay.status === "ACTIVA") || null;
}

// ─── Tolerance ───────────────────────────────────────────────────────

const TOLERANCE_MS = 60 * 60 * 1000; // 1 hora

export function isToleranceExpired(toleranceStartedAt: string | null | undefined): boolean {
  if (!toleranceStartedAt) return false;
  const started = new Date(toleranceStartedAt);
  const now = new Date();
  return (now.getTime() - started.getTime()) >= TOLERANCE_MS;
}

export function getToleranceRemainingMinutes(toleranceStartedAt: string | null | undefined): number {
  if (!toleranceStartedAt) return 60;
  const started = new Date(toleranceStartedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - started.getTime();
  const remainingMs = Math.max(0, TOLERANCE_MS - elapsedMs);
  return Math.ceil(remainingMs / 60000);
}

// ─── Extend Checkout Time ───────────────────────────────────────────

export async function extendCheckoutTime(
  supabase: ReturnType<typeof createClient>,
  stayId: string,
  hours: number
): Promise<boolean> {
  const { data: freshStay } = await supabase
    .from("room_stays")
    .select("expected_check_out_at")
    .eq("id", stayId)
    .single();

  if (!freshStay?.expected_check_out_at) return false;

  const checkout = new Date(freshStay.expected_check_out_at);
  checkout.setHours(checkout.getHours() + hours);

  const { error } = await supabase
    .from("room_stays")
    .update({ expected_check_out_at: checkout.toISOString() })
    .eq("id", stayId);

  return !error;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface RoomActionContext {
  checkAuthorization: (actionName: string) => boolean;
  setActionLoading: (loading: boolean) => void;
  onRefresh: () => Promise<void>;
  /** Instantly update a room in the react-query cache for optimistic UI */
  optimisticRoomUpdate: (roomId: string, updates: Record<string, unknown>) => void;
  /** Synchronous lock to prevent double-click race conditions */
  isLocked: () => boolean;
  lock: () => void;
  unlock: () => void;
}

// ─── Action Wrappers ─────────────────────────────────────────────────

/**
 * Wraps an action with loading state, error handling, and auto-refresh.
 */
export async function withAction<T>(
  ctx: RoomActionContext,
  errorMessage: string,
  fn: () => Promise<T>
): Promise<T | undefined> {
  // Synchronous guard: prevents double-click before React re-renders disabled state
  if (ctx.isLocked()) return undefined;
  ctx.lock();
  ctx.setActionLoading(true);
  try {
    const result = await fn();
    // Fire-and-forget refresh: don't block UI waiting for full refetch.
    // Realtime subscriptions will also trigger a refresh as safety net.
    ctx.onRefresh().catch(() => {});
    return result;
  } catch (error) {
    logger.error(errorMessage, error);
    toast.error(errorMessage);
    return undefined;
  } finally {
    ctx.setActionLoading(false);
    ctx.unlock();
  }
}

/**
 * Like withAction but returns a boolean and doesn't auto-refresh.
 */
export async function withBoolAction(
  ctx: RoomActionContext,
  errorMessage: string,
  fn: () => Promise<boolean>
): Promise<boolean> {
  // Synchronous guard: prevents double-click before React re-renders disabled state
  if (ctx.isLocked()) return false;
  ctx.lock();
  ctx.setActionLoading(true);
  try {
    return await fn();
  } catch (error) {
    logger.error(errorMessage, error);
    toast.error(errorMessage);
    return false;
  } finally {
    ctx.setActionLoading(false);
    ctx.unlock();
  }
}
