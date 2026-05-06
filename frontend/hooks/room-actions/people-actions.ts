import { apiClient } from "@/lib/api/client";
/**
 * People-related room actions: add, remove, tolerance.
 */
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { logger } from "@/lib/utils/logger";
import { formatCurrency } from "@/lib/utils/formatters";
import { getOrCreateServiceProduct, createServiceItem } from "@/lib/services/product-service";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";
import { logFinancialAction } from "@/lib/audit-logger";
import { findActiveFlow, logFlowEvent } from "@/lib/flow-logger";
import {
  getActiveStay,
  isToleranceExpired,
  getToleranceRemainingMinutes,
  getReceptionShiftId,
  createPendingCharge,
  withAction,
  RoomActionContext,
} from "./room-action-helpers";

export function createPeopleActions(ctx: RoomActionContext) {
  const { checkAuthorization } = ctx;

  /**
   * Agregar persona a la habitación.
   */
  const handleAddPerson = async (room: Room) => {
    if (!checkAuthorization("Agregar Persona")) return;
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa"); return; }
    if (!room.room_types) { toast.error("Configuración incompleta"); return; }

    const maxPeople = room.room_types.max_people ?? 2;
    const current = activeStay.current_people ?? 2;
    const next = current + 1;

    if (next > maxPeople) {
      toast.error("Capacidad máxima alcanzada", {
        description: `Esta habitación ${room.room_types.name} permite máximo ${maxPeople} personas`,
      });
      return;
    }

    await withAction(ctx, "Error al agregar persona", async () => {
      const newCurrentPeople = next;

      // Persona REGRESANDO con tolerancia activa
      if (activeStay.tolerance_started_at) {
        const toleranceExpired = isToleranceExpired(activeStay.tolerance_started_at);

        if (toleranceExpired) {
          const currentShiftId = await getReceptionShiftId();

          if (activeStay.tolerance_type === 'ROOM_EMPTY') {
            const basePrice = room.room_types!.base_price ?? 0;
            if (basePrice > 0) {
              await createPendingCharge(activeStay.sales_order_id, basePrice, "TOLERANCIA_EXPIRADA", "TOL", currentShiftId);
              toast.warning("Tolerancia expirada - Habitación cobrada", {
                description: `Hab. ${room.number}: +$${basePrice.toFixed(2)} MXN (pendiente)`,
              });
            }
          } else if (activeStay.tolerance_type === 'PERSON_LEFT') {
            const extraPrice = room.room_types!.extra_person_price ?? 0;
            if (extraPrice > 0) {
              await createPendingCharge(activeStay.sales_order_id, extraPrice, "PERSONA_EXTRA", "PEX");
              toast.warning("Tolerancia expirada - Persona extra cobrada", {
                description: `Hab. ${room.number}: +$${extraPrice.toFixed(2)} MXN (pendiente)`,
              });
            }
          }
        } else {
          const remainingMin = getToleranceRemainingMinutes(activeStay.tolerance_started_at);
          toast.success("Regreso dentro de tolerancia", {
            description: `Hab. ${room.number}: Regresó a tiempo (quedaban ${remainingMin} min)`,
          });
        }

        await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {
          current_people: newCurrentPeople,
          tolerance_started_at: null,
          tolerance_type: null,
        });
      } else {
        // Persona NUEVA
        const previousTotalPeople = activeStay.total_people ?? current;
        const newTotalPeople = previousTotalPeople + 1;
        const shouldChargeExtra = newCurrentPeople > 2 || previousTotalPeople >= 2;

        await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {
          current_people: newCurrentPeople,
          total_people: newTotalPeople,
        });

        if (shouldChargeExtra) {
          const extraPrice = room.room_types!.extra_person_price ?? 0;
          if (extraPrice > 0) {
            const productResult = await getOrCreateServiceProduct();
            if (!productResult.success) { toast.error("Error al registrar el cargo"); return; }

            const currentShiftId = await getReceptionShiftId(supabase);
            const itemResult = await createServiceItem(activeStay.sales_order_id, extraPrice, "EXTRA_PERSON", 1, false, "", currentShiftId);
            if (!itemResult.success) { toast.error("Error al registrar el cargo"); return; }

            const chargeResult = await createPendingCharge(supabase, activeStay.sales_order_id, extraPrice, "PERSONA_EXTRA", "PEX", currentShiftId);

            toast.success("Persona extra registrada", {
              description: `Hab. ${room.number}: ${newCurrentPeople} personas (histórico: ${newTotalPeople}). +${formatCurrency(extraPrice)} (pendiente)`,
            });

            // ─── Audit Log ─────────────────────────────────────────
            logFinancialAction("EXTRA_PERSON", {
              roomNumber: room.number,
              amount: extraPrice,
              stayId: activeStay.id,
              salesOrderId: activeStay.sales_order_id,
              description: `Persona extra con cargo en Hab. ${room.number}: $${extraPrice.toFixed(2)}. Personas: ${current}→${newCurrentPeople}`,
              extra: { previous_people: current, new_people: newCurrentPeople, total_historic: newTotalPeople },
            });

            await notifyActiveValets(supabase, '👤 Persona Extra Registrada',
              `Habitación ${room.number}: Se registró persona extra. Saldo pendiente: ${formatCurrency(chargeResult.newRemaining || extraPrice)}.`,
              { type: 'NEW_EXTRA', consumptionId: itemResult.data, roomNumber: room.number, stayId: activeStay.id }
            );
          } else {
            toast.warning("No se configuró precio de persona extra");
          }
        } else {
          toast.success("Persona agregada", {
            description: `Hab. ${room.number}: ${newCurrentPeople} personas (histórico: ${newTotalPeople})`,
          });

          // ─── Audit Log ─────────────────────────────────────────
          logFinancialAction("ADD_PERSON", {
            roomNumber: room.number,
            stayId: activeStay.id,
            description: `Persona agregada (sin cargo) en Hab. ${room.number}. Personas: ${current}→${newCurrentPeople}`,
            extra: { previous_people: current, new_people: newCurrentPeople, total_historic: newTotalPeople },
          });

          await notifyActiveValets(supabase, '👤 Persona Agregada',
            `Habitación ${room.number}: Se agregó una persona. Total actual: ${newCurrentPeople}.`,
            { type: 'PERSON_ENTRY', roomNumber: room.number, stayId: activeStay.id }
          );
        }
      }
    });
  };

  /**
   * Quitar persona (salida definitiva).
   */
  const handleRemovePerson = async (room: Room) => {
    if (!checkAuthorization("Remover Persona")) return;
    if (room.status !== "OCUPADA") { toast.info("Esta habitación no está ocupada"); return; }

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa"); return; }

    const current = activeStay.current_people ?? 2;
    if (current <= 1) {
      toast.error("No se puede quitar la última persona", {
        description: "Si la habitación quedará vacía, usa 'Salida' para hacer checkout.",
      });
      return;
    }

    await withAction(ctx, "Error al remover persona", async () => {
      const newCurrentPeople = current - 1;

      await apiClient.patch(`/rooms/stays/single/${activeStay.id}`, { current_people: newCurrentPeople });

      toast.success("Persona removida", {
        description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''}`,
      });

      // ─── Audit Log ───────────────────────────────────────────
      logFinancialAction("REMOVE_PERSON", {
        roomNumber: room.number,
        stayId: activeStay.id,
        description: `Persona removida de Hab. ${room.number}. Personas: ${current}→${newCurrentPeople}`,
        extra: { previous_people: current, new_people: newCurrentPeople },
      });

      // ─── Flow Event ───────────────────────────────────────────
      findActiveFlow(activeStay.id).then(flowId => {
        if (flowId) {
          logFlowEvent(flowId, {
            event_type: "PERSON_REMOVED",
            description: `Persona removida. Personas: ${current}→${newCurrentPeople}`,
            metadata: { previous: current, new_count: newCurrentPeople },
          });
        }
      });

      await notifyActiveValets('👤 Persona Salió',
        `Habitación ${room.number}: Salió una persona. Total actual: ${newCurrentPeople}.`,
        { type: 'PERSON_EXIT', roomNumber: room.number, stayId: activeStay.id }
      );
    });
  };

  /**
   * Toggle de salida/regreso con tolerancia (1 hora).
   */
  const handlePersonLeftReturning = async (room: Room) => {
    if (!checkAuthorization("Tolerancia Salida/Regreso")) return;
    if (room.status !== "OCUPADA") { toast.error("No se puede aplicar tolerancia a una habitación no ocupada"); return; }

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa"); return; }
    if (!room.room_types) { toast.error("Configuración incompleta"); return; }
    if (room.room_types.is_hotel) { toast.info("Tolerancia no disponible", { description: "Esta función solo aplica para habitaciones tipo motel" }); return; }

    await withAction(ctx, "Error al procesar tolerancia", async () => {
      // CASO 1: Tolerancia activa → persona REGRESA
      if (activeStay.tolerance_started_at) {
        const current = activeStay.current_people ?? 2;
        const newCurrentPeople = current + 1;

        const toleranceStart = new Date(activeStay.tolerance_started_at);
        const minutesElapsed = Math.floor((Date.now() - toleranceStart.getTime()) / 60000);
        const minutesRemaining = Math.max(0, 60 - minutesElapsed);

        await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {
          current_people: newCurrentPeople,
          tolerance_started_at: null,
          tolerance_type: null,
        });

        toast.success("✅ Persona regresó a tiempo", {
          description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''}. Regresó en ${minutesElapsed} min (quedaban ${minutesRemaining} min).`,
        });

        // ─── Audit Log ─────────────────────────────────────────
        logFinancialAction("TOLERANCE", {
          roomNumber: room.number,
          stayId: activeStay.id,
          description: `Persona regresó dentro de tolerancia en Hab. ${room.number}. Tiempo: ${minutesElapsed}min de 60min`,
          extra: { action: "RETURN", minutes_elapsed: minutesElapsed, minutes_remaining: minutesRemaining },
        });

        await notifyActiveValets(supabase, '👤 Persona Regresó',
          `Habitación ${room.number}: La persona regresó dentro del tiempo de tolerancia.`,
          { type: 'PERSON_RETURN', roomNumber: room.number, stayId: activeStay.id }
        );
        return;
      }

      // CASO 2: No hay tolerancia → persona SALE
      const current = activeStay.current_people ?? 2;
      if (current <= 0) { toast.error("No hay personas en la habitación"); return; }

      const newCurrentPeople = current - 1;
      const toleranceType = newCurrentPeople === 0 ? 'ROOM_EMPTY' : 'PERSON_LEFT';

      await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {
        current_people: newCurrentPeople,
        tolerance_started_at: new Date().toISOString(),
        tolerance_type: toleranceType,
      });

      const exitTime = new Date();
      const returnDeadline = new Date(Date.now() + 3600000);
      const expiryTime = returnDeadline.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

      if (newCurrentPeople === 0) {
        toast.warning("⏱️ Tolerancia iniciada - Habitación vacía", {
          description: `Hab. ${room.number}: Tiene hasta las ${expiryTime} para regresar. Después se cobrará habitación completa (${formatCurrency(room.room_types!.base_price ?? 0)}).`,
          duration: 5000,
        });
      } else {
        toast.warning("⏱️ Tolerancia iniciada - Persona salió", {
          description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''} en habitación. Tiene hasta las ${expiryTime} para regresar.`,
          duration: 5000,
        });
      }

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction("TOLERANCE", {
        roomNumber: room.number,
        stayId: activeStay.id,
        amount: toleranceType === 'ROOM_EMPTY' ? (room.room_types!.base_price ?? 0) : (room.room_types!.extra_person_price ?? 0),
        description: `Tolerancia iniciada en Hab. ${room.number}. Tipo: ${toleranceType}. Personas: ${current}→${newCurrentPeople}. Límite: ${expiryTime}`,
        extra: { action: "START", tolerance_type: toleranceType, deadline: expiryTime, previous_people: current, new_people: newCurrentPeople },
        severity: "WARNING",
      });

      // ─── Flow Event ─────────────────────────────────────────────
      findActiveFlow(activeStay.id).then(flowId => {
        if (flowId) {
          logFlowEvent(flowId, {
            event_type: "TOLERANCE_STARTED",
            description: `Tolerancia iniciada (${toleranceType}). Personas: ${current}→${newCurrentPeople}. Límite: ${expiryTime}`,
            metadata: { tolerance_type: toleranceType, deadline: expiryTime, previous: current, new_count: newCurrentPeople },
          });
        }
      });

      // Imprimir ticket de tolerancia (fire-and-forget)
      const PRINT_SERVER_URL = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';
      fetch(`${PRINT_SERVER_URL}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tolerance',
          data: {
            roomNumber: room.number,
            exitTime: exitTime.toISOString(),
            returnDeadline: returnDeadline.toISOString(),
            people: newCurrentPeople,
            toleranceType,
          }
        })
      }).catch(err => logger.warn('No se pudo imprimir ticket de tolerancia', err));

      await notifyActiveValets(supabase, '⏱️ Tolerancia Iniciada',
        `Habitación ${room.number}: Salió una persona con derecho a regreso (1h).`,
        { type: 'TOLERANCE_STARTED', roomNumber: room.number, stayId: activeStay.id }
      );
    });
  };

  return { handleAddPerson, handleRemovePerson, handlePersonLeftReturning };
}
