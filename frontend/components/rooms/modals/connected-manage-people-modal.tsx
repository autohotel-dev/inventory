"use client";

import { Room } from "@/components/sales/room-types";
import { ManagePeopleModal } from "@/components/sales/manage-people-modal";
import { useRoomActions } from "@/hooks/room-actions";
import { getActiveStay } from "@/hooks/room-actions";
import { useState } from "react";

interface ConnectedManagePeopleModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectedManagePeopleModal({
  room,
  isOpen,
  onClose,
  onSuccess,
}: ConnectedManagePeopleModalProps) {
  const { 
    actionLoading,
    handleAddPerson, 
    handlePersonLeaveWithTolerance,
    handlePersonReturn,
    handleRemovePerson 
  } = useRoomActions(async () => {
    onSuccess();
  });
  
  const [localLoading, setLocalLoading] = useState(false);

  if (!room) return null;

  const activeStay = getActiveStay(room);
  
  const currentPeople = activeStay?.current_people ?? 2;
  const totalPeople = activeStay?.total_people ?? 2;
  const maxPeople = room.room_types?.max_people ?? 4;
  const hasActiveTolerance = !!activeStay?.tolerance_started_at;
  const tolerancePeopleOut = activeStay?.tolerance_people_out ?? 0;
  
  const toleranceMinutesLeft = (() => {
    if (!activeStay?.tolerance_started_at) return 0;
    const started = new Date(activeStay.tolerance_started_at);
    const elapsed = Math.floor((new Date().getTime() - started.getTime()) / 60000);
    return Math.max(0, 60 - elapsed);
  })();

  const extraPersonPrice = room.room_types?.extra_person_price ?? 0;
  const isHotelRoom = room.room_types?.is_hotel ?? false;

  // ── Agregar persona(s) nueva(s) ──
  const handleAddPersonNewWrapper = async (count: number) => {
    setLocalLoading(true);
    await handleAddPerson(room, count);
    setLocalLoading(false);
    onSuccess();
    onClose();
  };

  // ── Persona(s) regresan de tolerancia ──
  const handleAddPersonReturningWrapper = async (count: number) => {
    setLocalLoading(true);
    await handlePersonReturn(room, count);
    setLocalLoading(false);
    onSuccess();
    onClose();
  };

  // ── Persona(s) salen ──
  const handleRemovePersonWrapper = async (count: number, willReturn: boolean) => {
    setLocalLoading(true);
    if (willReturn) {
      await handlePersonLeaveWithTolerance(room, count);
    } else {
      await handleRemovePerson(room, count);
    }
    setLocalLoading(false);
    onSuccess();
    onClose();
  };

  return (
    <ManagePeopleModal
      isOpen={isOpen}
      roomNumber={room.number || ""}
      currentPeople={currentPeople}
      totalPeople={totalPeople}
      maxPeople={maxPeople}
      baseCapacity={room.room_types?.base_capacity ?? 2}
      hasActiveTolerance={hasActiveTolerance}
      toleranceMinutesLeft={toleranceMinutesLeft}
      tolerancePeopleOut={tolerancePeopleOut}
      extraPersonPrice={extraPersonPrice}
      isHotelRoom={isHotelRoom}
      actionLoading={localLoading}
      onClose={onClose}
      onAddPersonNew={handleAddPersonNewWrapper}
      onAddPersonReturning={handleAddPersonReturningWrapper}
      onRemovePerson={handleRemovePersonWrapper}
    />
  );
}
