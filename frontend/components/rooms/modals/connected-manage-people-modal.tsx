"use client";

import { Room } from "@/components/sales/room-types";
import { ManagePeopleModal } from "@/components/sales/manage-people-modal";
import { useRoomActions } from "@/hooks/use-room-actions";
import { getActiveStay } from "@/hooks/use-room-actions";
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
    handlePersonLeftReturning, 
    handleRemovePerson 
  } = useRoomActions(async () => {
    onSuccess();
  });
  
  const [localLoading, setLocalLoading] = useState(false);

  if (!room) return null;

  const activeStay = getActiveStay(room);
  
  const currentPeople = activeStay?.current_people || 2;
  const totalPeople = activeStay?.total_people || 2;
  const maxPeople = room.room_types?.max_people || 4;
  const hasActiveTolerance = !!activeStay?.tolerance_started_at;
  
  const toleranceMinutesLeft = (() => {
    if (!activeStay?.tolerance_started_at) return 0;
    const started = new Date(activeStay.tolerance_started_at);
    const elapsed = Math.floor((new Date().getTime() - started.getTime()) / 60000);
    return Math.max(0, 60 - elapsed);
  })();

  const extraPersonPrice = room.room_types?.extra_person_price || 0;
  const isHotelRoom = room.room_types?.is_hotel || false;

  const handleAddPersonNewWrapper = async () => {
    setLocalLoading(true);
    await handleAddPerson(room);
    setLocalLoading(false);
    onSuccess();
    onClose();
  };

  const handleAddPersonReturningWrapper = async () => {
    setLocalLoading(true);
    await handlePersonLeftReturning(room);
    setLocalLoading(false);
    onSuccess();
    onClose();
  };

  const handleRemovePersonWrapper = async (willReturn: boolean) => {
    setLocalLoading(true);
    if (willReturn) {
      await handlePersonLeftReturning(room); // Wait, if the person leaves and will return, logic in use-room-actions might be handlePersonLeftReturning? Wait, the hook handles "leave and return"?
      // Let me reproduce exactly how rooms-board did it:
      // if (willReturn) { handlePersonLeftReturning(selectedRoom); } else { handleRemovePerson(selectedRoom); }
    } else {
      await handleRemovePerson(room);
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
      hasActiveTolerance={hasActiveTolerance}
      toleranceMinutesLeft={toleranceMinutesLeft}
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
