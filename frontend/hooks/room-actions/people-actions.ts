/**
 * People-related room actions: add, remove, tolerance.
 */
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { logger } from "@/lib/utils/logger";
import { formatCurrency } from "@/lib/utils/formatters";
import { getOrCreateServiceProduct, createServiceItem } from "@/lib/services/product-service";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";
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
      const supabase = createClient();
      const newCurrentPeople = next;

      // Persona REGRESANDO con tolerancia activa
      if (activeStay.tolerance_started_at) {
        const toleranceExpired = isToleranceExpired(activeStay.tolerance_started_at);

        if (toleranceExpired) {
          const currentShiftId = await getReceptionShiftId(supabase);

          if (activeStay.tolerance_type === 'ROOM_EMPTY') {
            const basePrice = room.room_types!.base_price ?? 0;
            if (basePrice > 0) {
              await createPendingCharge(supabase, activeStay.sales_order_id, basePrice, "TOLERANCIA_EXPIRADA", "TOL", currentShiftId);
              toast.warning("Tolerancia expirada - Habitación cobrada", {
                description: `Hab. ${room.number}: +$${basePrice.toFixed(2)} MXN (pendiente)`,
              });
            }
          } else if (activeStay.tolerance_type === 'PERSON_LEFT') {
            const extraPrice = room.room_types!.extra_person_price ?? 0;
            if (extraPrice > 0) {
              await createPendingCharge(supabase, activeStay.sales_order_id, extraPrice, "PERSONA_EXTRA", "PEX");
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

        await supabase.from("room_stays").update({
          current_people: newCurrentPeople,
          tolerance_started_at: null,
          tolerance_type: null,
        }).eq("id", activeStay.id);
      } else {
        // Persona NUEVA
        const previousTotalPeople = activeStay.total_people ?? current;
        const newTotalPeople = previousTotalPeople + 1;
        const shouldChargeExtra = newCurrentPeople > 2 || previousTotalPeople >= 2;

        await supabase.from("room_stays").update({
          current_people: newCurrentPeople,
          total_people: newTotalPeople,
        }).eq("id", activeStay.id);

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
      const supabase = createClient();
      const newCurrentPeople = current - 1;

      await supabase.from("room_stays").update({ current_people: newCurrentPeople }).eq("id", activeStay.id);

      toast.success("Persona removida", {
        description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''}`,
      });

      await notifyActiveValets(supabase, '👤 Persona Salió',
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
      const supabase = createClient();

      // CASO 1: Tolerancia activa → persona REGRESA
      if (activeStay.tolerance_started_at) {
        const current = activeStay.current_people ?? 2;
        const newCurrentPeople = current + 1;

        const toleranceStart = new Date(activeStay.tolerance_started_at);
        const minutesElapsed = Math.floor((Date.now() - toleranceStart.getTime()) / 60000);
        const minutesRemaining = Math.max(0, 60 - minutesElapsed);

        await supabase.from("room_stays").update({
          current_people: newCurrentPeople,
          tolerance_started_at: null,
          tolerance_type: null,
        }).eq("id", activeStay.id);

        toast.success("✅ Persona regresó a tiempo", {
          description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''}. Regresó en ${minutesElapsed} min (quedaban ${minutesRemaining} min).`,
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

      await supabase.from("room_stays").update({
        current_people: newCurrentPeople,
        tolerance_started_at: new Date().toISOString(),
        tolerance_type: toleranceType,
      }).eq("id", activeStay.id);

      const expiryTime = new Date(Date.now() + 3600000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

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

      await notifyActiveValets(supabase, '⏱️ Tolerancia Iniciada',
        `Habitación ${room.number}: Salió una persona con derecho a regreso (1h).`,
        { type: 'TOLERANCE_STARTED', roomNumber: room.number, stayId: activeStay.id }
      );
    });
  };

  return { handleAddPerson, handleRemovePerson, handlePersonLeftReturning };
}
