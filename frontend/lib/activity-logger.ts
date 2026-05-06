import { apiClient } from "@/lib/api/client";

export type ActivityAction = 
  | 'LOGIN' 
  | 'CHECKIN' 
  | 'CONSUMPTION_ORDER' 
  | 'PAYMENT_RECEIVED' 
  | 'ROOM_BLOCK' 
  | 'ROOM_UNBLOCK' 
  | 'ADMIN_OVERRIDE' 
  | 'CHECKOUT'
  | 'DELETE_ITEM'
  | 'APPLY_DISCOUNT';

interface LogOptions {
  roomNumber?: string;
  valetId?: string;
  recipientId?: string; // receptionist user id or employee id
  details?: any;
  reason?: string;
}

/**
 * Centalized activity logging for Luxor SOP compliance (Rule #1)
 */
export async function logActivity(action: ActivityAction, options: LogOptions) {
  try {
    // Get current user if recipientId not provided
    let finalRecipientId = options.recipientId;
    if (!finalRecipientId) {
      try {
        const { data: me } = await apiClient.get("/system/auth/me");
        finalRecipientId = me?.id || me?.user_id;
      } catch {}
    }

    await apiClient.post("/system/crud/activity_logs", {
      action,
      room_number: options.roomNumber,
      valet_id: options.valetId,
      recipient_id: finalRecipientId,
      details: options.details,
      reason: options.reason,
    });
  } catch (err) {
    console.error('Unexpected error in logActivity:', err);
  }
}
