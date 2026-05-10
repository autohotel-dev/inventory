"use client";

import { memo, useMemo } from "react";
import { RoomCard } from "@/components/sales/room-card";
import { Room } from "@/components/sales/room-types";
import { getActiveStay } from "@/hooks/room-actions";
import { toast } from "sonner";
import { ROOM_STATUS_BG, ROOM_STATUS_ACCENT } from "@/components/sales/room-types";

interface RoomCardGridProps {
  rooms: Room[];
  sensors: any[];
  highlightedRoomIds?: Set<string>;
  isLowPowerMode?: boolean;
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
  isLowPowerMode,
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
  
  // Pre-calculate all heavy derived state for rooms to avoid O(N) calculations during render
  const processedRooms = useMemo(() => {
    return rooms.map(room => {
      const status = room.status || "OTRO";
      const timeInfo = getRemainingTimeLabel(room);
      const isSaliendo = !!timeInfo?.isSaliendo;

      const activeStay = getActiveStay(room);
      const salesOrder = Array.isArray(activeStay?.sales_orders)
        ? activeStay.sales_orders[0]
        : activeStay?.sales_orders;

      const hasPendingPayment = status === "OCUPADA" &&
        salesOrder &&
        (salesOrder.remaining_amount || 0) > 0;

      const vehicleStatus = {
        hasVehicle: !!activeStay?.vehicle_plate,
        isReady: !!activeStay?.checkout_valet_employee_id,
        plate: activeStay?.vehicle_plate || undefined,
        model: activeStay?.vehicle_model || undefined,
        brand: activeStay?.vehicle_brand || undefined,
        isWaitingAuthorization: !!activeStay?.valet_checkout_requested_at && !activeStay?.vehicle_requested_at
      };

      const items = salesOrder?.sales_order_items || [];
      const pendingItems = items.filter((item: any) =>
        item.concept_type === 'CONSUMPTION' &&
        ['PENDING_VALET', 'ACCEPTED', 'IN_TRANSIT'].includes(item.delivery_status || '')
      );
      const hasPendingService = pendingItems.length > 0;

      const isCriticalService = pendingItems.some((item: any) => {
        if (!item.created_at || item.delivery_status === 'IN_TRANSIT') return false;
        const createdDate = new Date(item.created_at);
        const diffMins = (new Date().getTime() - createdDate.getTime()) / (1000 * 60);
        return diffMins > 15;
      });

      const isExtraHourBlock = status === "BLOQUEADA";
      const hasUnconfirmedValetPayment = salesOrder?.payments?.some(
        (p: any) => p.status === 'COBRADO_POR_VALET' && !p.confirmed_at
      );

      const valetPriorityConcepts = ['ROOM_BASE', 'EXTRA_HOUR', 'EXTRA_PERSON', 'DAMAGE_CHARGE', 'ROOM_CHANGE_ADJUSTMENT'];
      const hasValetPriorityConcept = items.some((item: any) => valetPriorityConcepts.includes(item.concept_type || ''));

      const valetPending =
        status === "OCUPADA" &&
        activeStay &&
        !activeStay.checkout_payment_data &&
        !isExtraHourBlock &&
        hasPendingPayment &&
        hasValetPriorityConcept &&
        !hasUnconfirmedValetPayment;

      const tvRemote = room.room_assets?.find(a => a.asset_type === 'TV_REMOTE');

      return {
        room,
        status,
        isSaliendo,
        hasPendingPayment,
        vehicleStatus,
        hasPendingService,
        isCriticalService,
        valetPending,
        activeStay,
        tvRemoteStatus: tvRemote?.status || 'SIN_REGISTRO',
      };
    });
  }, [rooms, getRemainingTimeLabel]);

  return (
    <div id="tour-room-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3 min-h-[50vh]">
      {processedRooms.map(({
        room,
        status,
        isSaliendo,
        hasPendingPayment,
        vehicleStatus,
        hasPendingService,
        isCriticalService,
        valetPending,
        activeStay,
        tvRemoteStatus
      }) => {



        return (
          <RoomCard
            key={room.id}
            id={room.id}
            number={room.number}
            status={room.status as any}
            bgClass={isSaliendo ? "bg-gradient-to-br from-orange-950/60 to-amber-900/40" : ROOM_STATUS_BG[status as keyof typeof ROOM_STATUS_BG]}
            accentClass={
              highlightedRoomIds?.has(room.id)
                ? "ring-2 ring-blue-500 border-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.5)] scale-105 z-10"
                : isSaliendo ? "ring-1 ring-orange-500/40 border-orange-500/20" : ROOM_STATUS_ACCENT[status as keyof typeof ROOM_STATUS_ACCENT]
            }
            statusBadge={renderStatusBadge(status, isSaliendo)}
            hasPendingPayment={!!hasPendingPayment}
            hasPendingService={hasPendingService}
            isCriticalService={isCriticalService}
            roomTypeName={room.room_types?.name}
            notes={room.notes}
            sensorStatus={(() => {
              const s = sensors.find(sen => sen.room_id === room.id);
              if (!s) return null;
              return { isOpen: s.is_open, batteryLevel: s.battery_level, isOnline: s.status === 'ONLINE' };
            })()}
            vehicleStatus={(status === "OCUPADA" || status === "BLOQUEADA") ? (activeStay ? vehicleStatus : null) : null}
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
            isLowPowerMode={isLowPowerMode}
            isValetPending={!!valetPending && (status === "OCUPADA" || status === "BLOQUEADA")}
            valetId={activeStay && (status === "OCUPADA" || status === "BLOQUEADA") ? activeStay.valet_employee_id : null}
            onCancelStay={onCancelStay ? () => onCancelStay(room) : undefined}
            tvRemoteStatus={tvRemoteStatus}
            onAssignRemote={onAssignRemote ? () => onAssignRemote(room) : undefined}
          />
        );
      })}
    </div>
  );
});
