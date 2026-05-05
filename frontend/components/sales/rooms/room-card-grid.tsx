"use client";

import { memo } from "react";
import { RoomCard } from "@/components/sales/room-card";
import { Room } from "@/components/sales/room-types";
import { getActiveStay } from "@/hooks/room-actions";
import { toast } from "sonner";
import { ROOM_STATUS_BG, ROOM_STATUS_ACCENT } from "@/components/sales/room-types";

interface RoomCardGridProps {
  rooms: Room[];
  sensors: any[];
  highlightedRoomIds?: Set<string>;
  getRemainingTimeLabel: (room: Room) => any;
  renderStatusBadge: (status: string, isSaliendo: boolean) => React.ReactNode;
  openActionsDock: (room: Room) => void;
  openConsumptionModal: (room: Room) => void;
  setSelectedRoom: (room: Room) => void;
  setShowInfoModal: (show: boolean) => void;
  setShowTrackingModal: (show: boolean) => void;
  onCancelStay?: (room: Room) => void;
  onAssignRemote?: (room: Room) => void;
}

export const RoomCardGrid = memo(function RoomCardGrid({
  rooms,
  sensors,
  highlightedRoomIds,
  getRemainingTimeLabel,
  renderStatusBadge,
  openActionsDock,
  openConsumptionModal,
  setSelectedRoom,
  setShowInfoModal,
  setShowTrackingModal,
  onCancelStay,
  onAssignRemote,
}: RoomCardGridProps) {
  return (
    <div id="tour-room-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3 min-h-[50vh]">
      {rooms.map((room) => {
        const status = room.status || "OTRO";
        const timeInfo = getRemainingTimeLabel(room);
        const isSaliendo = !!timeInfo?.isSaliendo;

        // --- TODA ESTA LÓGICA AHORA VIENE PRE-COMPUTADA DESDE FASTAPI (BFF) ---
        const activeStay = room.active_stay;
        const hasPendingPayment = activeStay?.has_pending_payment || false;
        const hasPendingService = activeStay?.has_pending_service || false;
        const isCriticalService = activeStay?.is_critical_service || false;
        const valetPending = activeStay?.is_valet_pending || false;
        const vehicleStatus = activeStay?.vehicle_status || null;
        
        // Mantener compatibilidad con sensores en tiempo real (por web socket u otra API)
        const sensorStatus = room.sensor_status ? {
          isOpen: room.sensor_status.is_open,
          batteryLevel: room.sensor_status.battery_level,
          isOnline: room.sensor_status.is_online
        } : (() => {
          const s = sensors?.find(sen => sen.room_id === room.id);
          if (!s) return null;
          return { isOpen: s.is_open, batteryLevel: s.battery_level, isOnline: s.status === 'ONLINE' };
        })();

        return (
          <RoomCard
            key={room.id}
            id={room.id}
            number={room.number}
            status={status as any}
            bgClass={isSaliendo ? "bg-gradient-to-br from-orange-950/60 to-amber-900/40" : ROOM_STATUS_BG[status as keyof typeof ROOM_STATUS_BG]}
            accentClass={
              highlightedRoomIds?.has(room.id)
                ? "ring-2 ring-blue-500 border-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.5)] scale-105 z-10"
                : isSaliendo ? "ring-1 ring-orange-500/40 border-orange-500/20" : ROOM_STATUS_ACCENT[status as keyof typeof ROOM_STATUS_ACCENT]
            }
            statusBadge={renderStatusBadge(status, isSaliendo)}
            hasPendingPayment={hasPendingPayment}
            hasPendingService={hasPendingService}
            isCriticalService={isCriticalService}
            roomTypeName={room.room_type_name || room.room_types?.name}
            notes={room.notes}
            sensorStatus={sensorStatus}
            vehicleStatus={vehicleStatus ? {
              hasVehicle: vehicleStatus.has_vehicle,
              isReady: vehicleStatus.is_ready,
              plate: vehicleStatus.plate,
              brand: vehicleStatus.brand,
              model: vehicleStatus.model,
              isWaitingAuthorization: vehicleStatus.is_waiting_authorization
            } : null}
            onInfo={() => {
              setSelectedRoom(room);
              setShowInfoModal(true);
            }}
            onActions={() => {
              openActionsDock(room);
            }}
            onAddProduct={() => openConsumptionModal(room)}
            onViewServices={() => {
              setSelectedRoom(room);
              setShowTrackingModal(true);
            }}
            isValetPending={valetPending}
            valetId={activeStay?.valet_employee_id || null}
            onCancelStay={onCancelStay ? () => onCancelStay(room) : undefined}
            tvRemoteStatus={room.tv_remote_status}
            onAssignRemote={onAssignRemote ? () => onAssignRemote(room) : undefined}
          />
        );
      })}
    </div>
  );
});
