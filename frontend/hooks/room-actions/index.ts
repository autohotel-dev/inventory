/**
 * Room Actions - Modular entry point.
 * Composes all domain-specific action modules into a single hook.
 * 
 * Architecture:
 * - people-actions.ts   → handleAddPerson, handleRemovePerson, handlePersonLeftReturning
 * - time-actions.ts     → handleAddDamageCharge, handleAddCustomHours, handleRenewRoom, handleAdd4HourPromo
 * - checkout-actions.ts → prepareCheckout, processCheckout, updateRoomStatus
 * - cancel-actions.ts   → handleCancelPendingCharge, handleCancelItem
 * - valet-actions.ts    → requestVehicle, handleAuthorizeValetCheckout, handleCancelValetCheckout
 */
"use client";

import { useState, useRef } from "react";
import { useUserRole } from "@/hooks/use-user-role";
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { RoomActionContext } from "./room-action-helpers";
import { createPeopleActions } from "./people-actions";
import { createTimeActions } from "./time-actions";
import { createCheckoutActions } from "./checkout-actions";
import { createCancelActions } from "./cancel-actions";
import { createValetActions } from "./valet-actions";

// Re-export helpers for backward compatibility
export {
  generatePaymentReference,
  getActiveStay,
  getCurrentShiftId,
  getReceptionShiftId,
  getCurrentEmployeeId,
  getReceptionEmployeeId,
  isToleranceExpired,
  getToleranceRemainingMinutes,
} from "./room-action-helpers";

export interface UseRoomActionsReturn {
  actionLoading: boolean;
  handleAddPerson: (room: Room) => Promise<void>;
  handleRemovePerson: (room: Room) => Promise<void>;
  handlePersonLeftReturning: (room: Room) => Promise<void>;
  handleAddDamageCharge: (room: Room, amount: number, description: string) => Promise<void>;
  handleAddCustomHours: (room: Room, hours: number, isCourtesy?: boolean, courtesyReason?: string) => Promise<void>;
  handleRenewRoom: (room: Room) => Promise<void>;
  handleAdd4HourPromo: (room: Room) => Promise<void>;
  updateRoomStatus: (
    room: Room,
    newStatus: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA",
    successMessage: string,
    notes?: string
  ) => Promise<void>;
  prepareCheckout: (room: Room) => Promise<{
    salesOrderId: string;
    remainingAmount: number;
  } | null>;
  processCheckout: (
    room: Room,
    checkoutInfo: { salesOrderId: string; remainingAmount: number },
    amount: number,
    payments?: PaymentEntry[],
    checkoutValetId?: string | null
  ) => Promise<boolean>;
  requestVehicle: (stayId: string) => Promise<boolean>;
  handleAuthorizeValetCheckout: (room: Room) => Promise<boolean>;
  handleCancelValetCheckout: (room: Room) => Promise<boolean>;
  handleCancelPendingCharge: (paymentId: string, room: Room, concept: string, amount: number) => Promise<boolean>;
  handleCancelItem: (itemId: string, room: Room, reason: string) => Promise<boolean>;
}

export function useRoomActions(onRefresh: () => Promise<void>): UseRoomActionsReturn {
  const [actionLoading, setActionLoading] = useState(false);
  const actionLockRef = useRef(false);
  const { isReceptionist, isAdmin, isManager } = useUserRole();

  const checkAuthorization = (actionName: string) => {
    if (!isReceptionist && !isAdmin && !isManager) {
      toast.error("Acceso denegado", {
        description: `Solo los recepcionistas pueden realizar la acción: ${actionName}`
      });
      return false;
    }
    return true;
  };

  const ctx: RoomActionContext = {
    checkAuthorization,
    setActionLoading,
    onRefresh,
    isLocked: () => actionLockRef.current,
    lock: () => { actionLockRef.current = true; },
    unlock: () => { actionLockRef.current = false; },
  };

  const people = createPeopleActions(ctx);
  const time = createTimeActions(ctx);
  const checkout = createCheckoutActions(ctx);
  const cancel = createCancelActions(ctx);
  const valet = createValetActions(ctx);

  return {
    actionLoading,
    ...people,
    ...time,
    ...checkout,
    ...cancel,
    ...valet,
  };
}
