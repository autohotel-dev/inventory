import { createClient } from "./supabase/client";

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
  const supabase = createClient();
  
  try {
    // Get current user if recipientId not provided
    let finalRecipientId = options.recipientId;
    if (!finalRecipientId) {
      const { data: { user } } = await supabase.auth.getUser();
      finalRecipientId = user?.id;
    }

    const { error } = await supabase
      .from('activity_logs')
      .insert({
        action,
        room_number: options.roomNumber,
        valet_id: options.valetId,
        recipient_id: finalRecipientId,
        details: options.details,
        reason: options.reason,
      });

    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (err) {
    console.error('Unexpected error in logActivity:', err);
  }
}
