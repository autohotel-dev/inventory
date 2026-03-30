import { useEffect, useRef } from "react";
import { Room } from "@/components/sales/room-types";
import { TrainingMode } from "@/lib/training/training-types";

export interface UseRoomsTrainingProps {
  activeModule: any;
  currentStepIndex: number;
  currentMode: TrainingMode | null;
  rooms: Room[];
  updateRoomStatus: (room: Room, status: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA", successMessage: string, notes?: string) => Promise<any>;
  modals: ReturnType<typeof import('@/hooks/rooms/use-room-modals').useRoomModals>;
}

export function useRoomsTraining({
  activeModule,
  currentStepIndex,
  currentMode,
  rooms,
  updateRoomStatus,
  modals
}: UseRoomsTrainingProps) {
  const trainingStatusRoomIdRef = useRef<string | null>(null);
  const trainingStatusDirtyTriggeredRef = useRef(false);
  const trainingStatusBlockTriggeredRef = useRef(false);
  const trainingStatusCleanTriggeredRef = useRef(false);
  const trainingWheelRoomIdRef = useRef<string | null>(null);
  const trainingStatusCleanStepInitRef = useRef(false);
  const trainingStatusPrevStepIdRef = useRef<string | null>(null);
  const trainingStatusUpdateChainRef = useRef<Promise<void>>(Promise.resolve());
  const trainingStatusWasActiveRef = useRef(false);
  const trainingStatusEndCleanupRef = useRef(false);

  // Training: Auto-abrir la rueda de acciones y auto-ejecutar acciones en el módulo de check-in
  useEffect(() => {
    if (activeModule?.id !== 'room-checkin' || currentMode !== 'interactive') return;

    const activeStep = activeModule.steps[currentStepIndex];

    // Paso 2 (índice 1): Mostrar la rueda de acciones
    if (currentStepIndex === 1 && activeStep?.id === 'action-wheel') {
      if (rooms.length > 0 && !modals.isOpen("actions")) {
        const freeRoom = rooms.find(r => r.status === 'LIBRE');
        if (freeRoom) {
          console.log('🎓 [Training] Auto-abriendo rueda de acciones para demostración');
          modals.openActionsDock(freeRoom);
        }
      }
    }

    // Paso 3 (índice 2): Auto-abrir modal de check-in rápido
    if (currentStepIndex === 2 && activeStep?.id === 'check-in-rapido' && modals.isOpen("actions") && !modals.isOpen("quickCheckin")) {
      window.setTimeout(() => {
        console.log('🎓 [Training] Auto-abriendo modal de check-in rápido');
        modals.openModal("quickCheckin");
        modals.closeModal("actions");
      }, 500);
    }
  }, [activeModule, currentStepIndex, currentMode, rooms, modals]);

  // Training: Auto-abrir la rueda de acciones y modal de gestión de personas en el módulo de room-guests
  useEffect(() => {
    if (activeModule?.id !== 'room-guests' || currentMode !== 'interactive') return;
    const activeStep = activeModule.steps[currentStepIndex];

    // Paso 1 (índice 0): Solo habitación ocupada resaltada - cerrar todo
    if (currentStepIndex === 0 && activeStep?.id === 'select-occupied-room') {
      if (modals.isOpen("actions")) {
        console.log('🎓 [Training] Cerrando rueda de acciones (navegación hacia atrás)');
        modals.closeModal("actions");
        modals.setActionsDockVisible(false);
      }
      if (modals.isOpen("managePeople")) {
        console.log('🎓 [Training] Cerrando gestión de huéspedes (navegación hacia atrás)');
        modals.closeModal("managePeople");
      }
    }

    // Paso 2 (índice 1): Auto-abrir la rueda de acciones para una habitación ocupada
    if (currentStepIndex === 1 && activeStep?.id === 'action-wheel-guests') {
      if (rooms.length > 0 && !modals.isOpen("actions")) {
        const occupiedRoom = rooms.find(r => r.status === 'OCUPADA' || r.status === 'SUCIA');
        if (occupiedRoom) {
          console.log('🎓 [Training] Auto-abriendo rueda de acciones en Hab. Ocupada');
          modals.openActionsDock(occupiedRoom);
        }
      }
    }

    // Paso 3 (índice 2): Auto-abrir modal de gestión de huéspedes
    if (currentStepIndex === 2 && activeStep?.id === 'manage-guests-modal' && modals.isOpen("actions") && !modals.isOpen("managePeople")) {
      window.setTimeout(() => {
        console.log('🎓 [Training] Auto-abriendo modal de gestión de huéspedes');
        modals.openModal("managePeople");
        modals.closeModal("actions");
      }, 500);
    }
  }, [activeModule, currentStepIndex, currentMode, rooms, modals]);

  // Training: Auto-abrir rueda de acciones y gestión de horas en room-time
  useEffect(() => {
    if (activeModule?.id !== 'room-time' || currentMode !== 'interactive') return;
    const activeStep = activeModule.steps[currentStepIndex];

    if (currentStepIndex === 1 && activeStep?.id === 'action-wheel-time') {
      if (modals.isOpen("hourManagement")) {
        console.log('🎓 [Training] Cerrando modal de horas y mostrando rueda (navegación hacia atrás)');
        modals.closeModal("hourManagement");
      }

      if (rooms.length > 0 && !modals.isOpen("actions")) {
        const occupiedRoom = rooms.find(r => r.status === 'OCUPADA');
        if (occupiedRoom) {
          console.log('🎓 [Training] Auto-abriendo rueda de acciones para demostración de tiempo');
          modals.openActionsDock(occupiedRoom);
        }
      }
    }

    // Paso 3 (índice 2): Auto-abrir modal de gestión de horas
    if (currentStepIndex === 2 && activeStep?.id === 'manage-time-modal') {
      if (modals.isOpen("actions") && !modals.isOpen("hourManagement")) {
        window.setTimeout(() => {
          console.log('🎓 [Training] Auto-abriendo modal de gestión de horas');
          modals.openModal("hourManagement");
          modals.closeModal("actions");
        }, 500);
      } else if (!modals.isOpen("hourManagement") && !modals.isOpen("actions")) {
        modals.openModal("hourManagement");
      }
    }

    // Paso 4 (índice 3): Auto-seleccionar "Horas Personalizadas"
    if (currentStepIndex === 3 && activeStep?.id === 'custom-hours-option') {
      if (!modals.isOpen("hourManagement")) modals.openModal("hourManagement");

      window.setTimeout(() => {
        const customOption = document.getElementById('tour-custom-hours-option');
        if (customOption) {
          console.log('🎓 [Training] Auto-seleccionando Horas Personalizadas');
          customOption.click();
        }
      }, 300);
    }

    // Paso 5 (índice 4): Auto-seleccionar "Renovar"
    if (currentStepIndex === 4 && activeStep?.id === 'renew-option') {
      if (!modals.isOpen("hourManagement")) {
        console.log('🎓 [Training] Abriendo modal para paso renew');
        modals.openModal("hourManagement");
      }

      window.setTimeout(() => {
        const renewOption = document.getElementById('tour-renew-option');
        if (renewOption) {
          console.log('🎓 [Training] Auto-seleccionando Renovar');
          renewOption.click();
        } else {
          console.warn('🎓 [Training] No se encontró el elemento tour-renew-option');
        }
      }, 50);
    }

    // Paso 6 (índice 5): Auto-seleccionar "Promo 4H"
    if (currentStepIndex === 5 && activeStep?.id === 'promos') {
      if (!modals.isOpen("hourManagement")) {
        console.log('🎓 [Training] Abriendo modal para paso promos');
        modals.openModal("hourManagement");
      }

      window.setTimeout(() => {
        const promoOption = document.getElementById('tour-promo4h-option');
        if (promoOption) {
          console.log('🎓 [Training] Auto-seleccionando Promoción 4H');
          promoOption.click();
        } else {
          console.warn('🎓 [Training] No se encontró el elemento tour-promo4h-option');
        }
      }, 50);
    }
  }, [activeModule, currentStepIndex, currentMode, rooms, modals]);

  // Training: Auto-abrir la rueda de acciones en el módulo de room-status
  useEffect(() => {
    if (activeModule?.id === 'room-status' && currentMode === 'interactive') {
      const activeStep = activeModule.steps[currentStepIndex];

      const queueTrainingStatusUpdate = (fn: () => Promise<void>) => {
        trainingStatusUpdateChainRef.current = trainingStatusUpdateChainRef.current
          .then(fn)
          .catch((err) => {
            console.error('🎓 [Training] Error en update encadenado:', err);
          });
      };

      // Ejecutar acciones "al dar Siguiente" usando el cambio de step
      const prevStepId = trainingStatusPrevStepIdRef.current;
      const currentStepId = activeStep?.id ?? null;
      if (prevStepId === 'mark-clean-option' && currentStepId !== 'mark-clean-option') {
        const demoRoom = trainingStatusRoomIdRef.current
          ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
          : null;

        if (demoRoom) {
          console.log('🎓 [Training] Ejecutando acción al salir del paso: Limpiar (LIBRE)');
          // IMPORTANTE: no pasar notes para que updateRoomStatus limpie notes al liberar
          queueTrainingStatusUpdate(() => updateRoomStatus(demoRoom, 'LIBRE', 'Habitación limpia'));
        }
      }

      if (prevStepId === 'unblock-option' && currentStepId !== 'unblock-option') {
        const roomToUnblock = trainingStatusRoomIdRef.current
          ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
          : rooms.find(r => r.status === 'BLOQUEADA') || null;

        if (roomToUnblock) {
          console.log('🎓 [Training] Ejecutando acción al salir del paso: Desbloquear (LIBRE)');
          // IMPORTANTE: no pasar notes para que updateRoomStatus limpie notes al liberar
          queueTrainingStatusUpdate(() => updateRoomStatus(roomToUnblock, 'LIBRE', 'Habitación desbloqueada'));
        }
      }

      const timeouts: number[] = [];
      const addTimeout = (fn: () => void, ms: number) => {
        const id = window.setTimeout(fn, ms);
        timeouts.push(id);
      };

      const hasRoomWithStatus = (status: Room['status']) => {
        return rooms.some(r => r.status === status);
      };

      const ensureWheelOpenForStatus = (status: Room['status']) => {
        if (rooms.length === 0) return;

        const targetRoom = rooms.find(r => r.status === status);
        if (targetRoom) {
          // Evitar reabrir si ya está abierta para el mismo cuarto (evita parpadeo)
          if (modals.isOpen("actions") && trainingWheelRoomIdRef.current === targetRoom.id) return;

          console.log(`🎓 [Training] Auto-abriendo rueda de acciones para habitación ${status}`);
          trainingWheelRoomIdRef.current = targetRoom.id;
          modals.openActionsDock(targetRoom);
        }
      };

      const ensureWheelClosed = () => {
        if (modals.isOpen("actions")) {
          console.log('🎓 [Training] Cerrando rueda de acciones');
          modals.closeModal("actions");
          modals.setActionsDockVisible(false);
          trainingWheelRoomIdRef.current = null;
        }
      };

      // Reset triggers when leaving the step
      if (activeStep?.id !== 'mark-dirty-option') {
        trainingStatusDirtyTriggeredRef.current = false;
      }
      if (activeStep?.id !== 'block-room-option') {
        trainingStatusBlockTriggeredRef.current = false;
      }
      if (activeStep?.id !== 'mark-clean-option') {
        trainingStatusCleanTriggeredRef.current = false;
        trainingStatusCleanStepInitRef.current = false;
      }

      // Paso 1 (índice 0): Solo habitación libre resaltada - cerrar todo
      if (currentStepIndex === 0 && activeStep?.id === 'select-free-room') {
        ensureWheelClosed();
        if (modals.isOpen("statusNote")) {
          console.log('🎓 [Training] Cerrando modal de nota de estado (navegación hacia atrás)');
          modals.closeModal("statusNote");
          modals.setStatusNoteAction(null);
        }
      }

      // Pasos donde se necesita una habitación seleccionada (cerrar overlays)
      const needsRoomsView =
        activeStep?.id === 'select-dirty-room' ||
        activeStep?.id === 'select-blocked-room';

      if (needsRoomsView) {
        ensureWheelClosed();
        if (modals.isOpen("statusNote")) {
          console.log('🎓 [Training] Cerrando modal de nota (selección de habitación)');
          modals.closeModal("statusNote");
          modals.setStatusNoteAction(null);
        }
      }

      // Pasos que requieren la rueda abierta según el estado
      const wheelStatusNeeded: Room['status'] | null =
        activeStep?.id === 'action-wheel-status' ||
          activeStep?.id === 'info-dirty' ||
          activeStep?.id === 'info-clean' ||
          activeStep?.id === 'mark-dirty-option' ||
          activeStep?.id === 'block-room-option'
          ? 'LIBRE'
          : activeStep?.id === 'mark-clean-option'
            ? 'SUCIA'
            : activeStep?.id === 'unblock-option'
              ? 'BLOQUEADA'
              : null;

      // Mantener/abrir la rueda cuando el paso lo requiera
      if (wheelStatusNeeded) {
        // En mark-clean-option manejamos el modal/rueda más abajo (para permitir fallback)
        if (activeStep?.id !== 'mark-clean-option') {
          // En mark-dirty-option: si ya se disparó la automatización o ya está el modal DIRTY, no re-abrir la rueda
          if (
            activeStep?.id === 'mark-dirty-option' &&
            (trainingStatusDirtyTriggeredRef.current || (modals.isOpen("statusNote") && modals.statusNoteAction === 'DIRTY'))
          ) {
            ensureWheelClosed();
          } else if (
            activeStep?.id === 'block-room-option' &&
            (trainingStatusBlockTriggeredRef.current || (modals.isOpen("statusNote") && modals.statusNoteAction === 'BLOCK'))
          ) {
            // Mantener visible el modal de bloqueo durante el paso
            ensureWheelClosed();
          } else {
            if (modals.isOpen("statusNote")) {
              console.log('🎓 [Training] Cerrando modal de nota y mostrando rueda (navegación hacia atrás)');
              modals.closeModal("statusNote");
              modals.setStatusNoteAction(null);
            }

            ensureWheelOpenForStatus(wheelStatusNeeded);
            addTimeout(() => ensureWheelOpenForStatus(wheelStatusNeeded), 300);
          }
        }
      }

      // Paso 5: Marcar como sucia -> abrir modal automáticamente (simulando click en el sector)
      if (activeStep?.id === 'mark-dirty-option') {
        if (!hasRoomWithStatus('LIBRE')) return;

        // Si ya se abrió el modal, no repetir
        if (modals.isOpen("statusNote")) return;

        // Evitar loops: ejecutar una sola vez al entrar al paso
        if (trainingStatusDirtyTriggeredRef.current) return;
        trainingStatusDirtyTriggeredRef.current = true;

        // Seleccionar habitación demo
        const roomForDirty =
          (trainingStatusRoomIdRef.current
            ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
            : null) ||
          modals.selectedRoom ||
          rooms.find(r => r.status === 'LIBRE') ||
          null;

        if (!roomForDirty) return;
        trainingStatusRoomIdRef.current = roomForDirty.id;

        // Cerrar la rueda antes del modal
        ensureWheelClosed();

        console.log('🎓 [Training] Abriendo modal: Marcar como Sucia');
        modals.setSelectedRoom({ ...roomForDirty, notes: 'Capacitación' } as Room);
        modals.setStatusNoteAction('DIRTY');
        modals.openModal("statusNote");

        // Marcar SUCIA para preparar el paso 6 (sin cerrar modal)
        console.log('🎓 [Training] Marcando habitación demo como SUCIA (sin cerrar modal)');
        queueTrainingStatusUpdate(() => updateRoomStatus(roomForDirty, 'SUCIA', 'Habitación marcada como sucia/mantenimiento', 'Capacitación'));
      }

      // Paso 7 (bloqueo/mantenimiento): abrir modal automáticamente y marcar como BLOQUEADA
      if (activeStep?.id === 'block-room-option') {
        if (!hasRoomWithStatus('LIBRE')) return;

        // Si ya se abrió el modal, no repetir
        if (modals.isOpen("statusNote")) return;

        // Evitar loops: ejecutar una sola vez al entrar al paso
        if (trainingStatusBlockTriggeredRef.current) return;
        trainingStatusBlockTriggeredRef.current = true;

        const roomForBlock =
          (trainingStatusRoomIdRef.current
            ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
            : null) ||
          modals.selectedRoom ||
          rooms.find(r => r.status === 'LIBRE') ||
          null;

        if (!roomForBlock) return;
        trainingStatusRoomIdRef.current = roomForBlock.id;

        // Cerrar la rueda antes del modal
        ensureWheelClosed();

        console.log('🎓 [Training] Abriendo modal: Bloquear (Mantenimiento)');
        modals.setSelectedRoom({ ...roomForBlock, notes: 'Capacitación' } as Room);
        modals.setStatusNoteAction('BLOCK');
        modals.openModal("statusNote");

        // Marcar BLOQUEADA para preparar el siguiente paso (sin cerrar modal)
        console.log('🎓 [Training] Marcando habitación demo como BLOQUEADA (sin cerrar modal)');
        queueTrainingStatusUpdate(() => updateRoomStatus(roomForBlock, 'BLOQUEADA', 'Habitación bloqueada', 'Capacitación'));
      }

      // Paso 6: Cerrar modal y abrir rueda para una SUCIA si existe; si no, dejar solo el modal
      if (activeStep?.id === 'mark-clean-option') {
        const roomRef = trainingStatusRoomIdRef.current
          ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
          : null;

        // Ejecutar la preparación del paso una sola vez (evita loops por auto-refresh)
        if (!trainingStatusCleanStepInitRef.current) {
          trainingStatusCleanStepInitRef.current = true;

          // Cerrar modal de nota (si estaba visible) para poder ver la rueda
          if (modals.isOpen("statusNote")) {
            console.log('🎓 [Training] Cerrando modal de nota antes de mostrar opción Limpiar');
            modals.closeModal("statusNote");
            modals.setStatusNoteAction(null);
          }

          // Si NO existe ninguna SUCIA y aún no se ha limpiado, preparar una habitación demo como SUCIA
          // (solo para que se pueda visualizar la opción Limpiar).
          const hasDirtyNow = hasRoomWithStatus('SUCIA');
          if (!hasDirtyNow && roomRef && !trainingStatusCleanTriggeredRef.current) {
            addTimeout(() => {
              console.log('🎓 [Training] Preparando habitación demo como SUCIA');
              updateRoomStatus(roomRef, 'SUCIA', 'Habitación marcada como sucia/mantenimiento', 'Capacitación');
            }, 100);
          }
        }

        // Si hay SUCIA (por demo o ya existente), abrir rueda para mostrar opción limpiar
        addTimeout(() => {
          if (hasRoomWithStatus('SUCIA')) {
            ensureWheelOpenForStatus('SUCIA');
          } else {
            // Fallback: si no hay SUCIA, mostrar solo el modal (sin rueda)
            ensureWheelClosed();
          }
        }, 800);

        addTimeout(() => {
          if (hasRoomWithStatus('SUCIA')) {
            ensureWheelOpenForStatus('SUCIA');
          }
        }, 1400);

      }

      trainingStatusPrevStepIdRef.current = activeStep?.id ?? null;

      return () => {
        timeouts.forEach(id => clearTimeout(id));
      };
    }
  }, [activeModule, currentStepIndex, currentMode, rooms, modals, updateRoomStatus]);

  useEffect(() => {
    const isRoomStatusTourActive = activeModule?.id === 'room-status' && currentMode === 'interactive';

    if (isRoomStatusTourActive) {
      trainingStatusWasActiveRef.current = true;
      trainingStatusEndCleanupRef.current = false;
      return;
    }

    if (!trainingStatusWasActiveRef.current) return;
    if (trainingStatusEndCleanupRef.current) return;
    trainingStatusEndCleanupRef.current = true;
    trainingStatusWasActiveRef.current = false;

    const demoRoom = trainingStatusRoomIdRef.current
      ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
      : null;

    if (!demoRoom) return;

    trainingStatusUpdateChainRef.current = trainingStatusUpdateChainRef.current
      .then(() => updateRoomStatus(demoRoom, 'LIBRE', 'Habitación limpia'))
      .catch((err) => {
        console.error('🎓 [Training] Error en cleanup final:', err);
      });
  }, [activeModule, currentMode, rooms, updateRoomStatus]);
}
