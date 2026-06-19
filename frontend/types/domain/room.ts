/**
 * Domain types for Rooms and Room Stays
 * Re-exports from existing definitions + adds missing types
 * 
 * Usage: import { Room, RoomStay, RoomType } from '@/types/domain/room';
 */

// Re-export existing types from their canonical location
export type { Room, RoomStay, RoomType, TimeInfo, PaymentMethod, PaymentTerminal, CardType } from '@/components/sales/room-types';

// Re-export from stay-service
export type { StayBasic, StayWithRoom, StayWithDetails, DateRange } from '@/lib/services/stay-service';

// Re-export status constants
export { ROOM_STATUS, STAY_STATUS } from '@/lib/constants/room-constants';
export type { RoomStatus, StayStatus } from '@/lib/constants/room-constants';
