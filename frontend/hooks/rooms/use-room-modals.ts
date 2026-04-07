import { useState, useCallback } from "react";
import { Room } from "@/components/sales/room-types";

export type RoomModalType =
  | "startStay"
  | "checkout"
  | "actions"
  | "info"
  | "details"
  | "granularPayment"
  | "consumption"
  | "quickCheckin"
  | "editVehicle"
  | "editValet"
  | "changeRoom"
  | "cancelStay"
  | "managePeople"
  | "statusNote"
  | "hourManagement"
  | "damageCharge"
  | "guestPortalQR"
  | "tracking";

export type StatusNoteAction = "BLOCK" | "DIRTY" | null;

export function useRoomModals() {
  const [activeModals, setActiveModals] = useState<Record<string, boolean>>({});
  
  // Secondary state strictly related to modals
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [granularPaymentOrderId, setGranularPaymentOrderId] = useState<string | null>(null);
  const [consumptionOrderId, setConsumptionOrderId] = useState<string | null>(null);
  const [statusNoteAction, setStatusNoteAction] = useState<StatusNoteAction>(null);
  const [actionsDockVisible, setActionsDockVisible] = useState(false);

  // Core modal controls
  const openModal = useCallback((modal: RoomModalType, room?: Room | null) => {
    if (room !== undefined) setSelectedRoom(room);
    setActiveModals((prev) => ({ ...prev, [modal]: true }));
  }, []);

  const closeModal = useCallback((modal: RoomModalType) => {
    setActiveModals((prev) => ({ ...prev, [modal]: false }));
  }, []);

  const isOpen = useCallback(
    (modal: RoomModalType) => !!activeModals[modal],
    [activeModals]
  );

  // Helper macro handlers that also manage specific extra state and animations
  const openActionsDock = useCallback(
    (room: Room) => {
      setSelectedRoom(room);
      openModal("actions");
      setActionsDockVisible(false);
      requestAnimationFrame(() => setActionsDockVisible(true));
    },
    [openModal]
  );

  const closeActionsDock = useCallback(
    (actionLoading: boolean = false) => {
      if (actionLoading) return;
      setActionsDockVisible(false);
      setTimeout(() => {
        closeModal("actions");
      }, 200);
    },
    [closeModal]
  );

  const openStatusNoteModal = useCallback(
    (room: Room, action: "BLOCK" | "DIRTY") => {
      setSelectedRoom(room);
      setStatusNoteAction(action);
      openModal("statusNote");
    },
    [openModal]
  );

  const openGranularPaymentModal = useCallback(
    (room: Room, orderId: string) => {
      setSelectedRoom(room);
      setGranularPaymentOrderId(orderId);
      openModal("granularPayment");
    },
    [openModal]
  );

  const openConsumptionModal = useCallback(
    (room: Room, orderId: string) => {
      setSelectedRoom(room);
      setConsumptionOrderId(orderId);
      openModal("consumption");
    },
    [openModal]
  );

  // Sincronizar selectedRoom con datos frescos cuando rooms se refrescan
  // Crucial para que modales abiertos vean cambios en tiempo real
  // (ej: cochero confirma salida → checkout_valet_employee_id se actualiza)
  const syncSelectedRoom = useCallback((rooms: Room[]) => {
    setSelectedRoom(prev => {
      if (!prev) return prev;
      const fresh = rooms.find(r => r.id === prev.id);
      if (!fresh) return prev;
      return fresh;
    });
  }, []);

  return {
    // Expose current state
    selectedRoom,
    setSelectedRoom,
    granularPaymentOrderId,
    setGranularPaymentOrderId,
    consumptionOrderId,
    setConsumptionOrderId,
    statusNoteAction,
    setStatusNoteAction,
    actionsDockVisible,
    setActionsDockVisible,

    // Expose generic modal controls
    isOpen,
    openModal,
    closeModal,

    // Expose specific complex flows
    openActionsDock,
    closeActionsDock,
    openStatusNoteModal,
    openGranularPaymentModal,
    openConsumptionModal,
    syncSelectedRoom,
  };
}
