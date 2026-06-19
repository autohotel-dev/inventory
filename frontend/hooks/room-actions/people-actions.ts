import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { logger } from "@/lib/utils/logger";
import { formatCurrency } from "@/lib/utils/formatters";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";
import { logFinancialAction } from "@/lib/audit-logger";
import { findActiveFlow, logFlowEvent } from "@/lib/flow-logger";
import { sendPrintJobSilent } from "@/lib/print";
import {
  getActiveStay,
  isToleranceExpired,
  getToleranceRemainingMinutes,
  getReceptionShiftId,
  generatePaymentReference,
  withAction,
  RoomActionContext,
} from "./room-action-helpers";

export function createPeopleActions(ctx: RoomActionContext) {
  const { checkAuthorization } = ctx;

  /**
   * Agregar persona(s) NUEVA(s) a la habitación.
   * Solo para personas genuinamente nuevas, NO para regresos de tolerancia.
   * @param count Número de personas a agregar (default: 1)
   */
  const handleAddPerson = async (room: Room, count: number = 1) => {
    if (!checkAuthorization("Agregar Persona")) return;
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa"); return; }
    if (!room.room_types) { toast.error("Configuración incompleta"); return; }

    const maxPeople = room.room_types.max_people ?? 2;
    const current = activeStay.current_people ?? 2;
    const newCurrentPeople = current + count;

    if (newCurrentPeople > maxPeople) {
      toast.error("Capacidad máxima alcanzada", {
        description: `Esta habitación ${room.room_types.name} permite máximo ${maxPeople} personas. Actual: ${current}, intentando agregar: ${count}`,
      });
      return;
    }

    await withAction(ctx, "Error al agregar persona", async () => {
      const supabase = createClient();

      const previousTotalPeople = activeStay.total_people ?? current;
      const newTotalPeople = previousTotalPeople + count;
      const baseCapacity = room.room_types!.base_capacity ?? 2;

      // Calcular cuántas personas requieren cobro extra
      const alreadyOverCapacity = previousTotalPeople >= baseCapacity;
      const chargeableCount = alreadyOverCapacity
        ? count // Todas las nuevas se cobran
        : Math.max(0, newTotalPeople - baseCapacity); // Solo las que exceden

      if (chargeableCount > 0) {
        const extraPrice = room.room_types!.extra_person_price ?? 0;
        if (extraPrice > 0) {
          const currentShiftId = await getReceptionShiftId(supabase);
          const totalCharge = extraPrice * chargeableCount;

          // RPC atómico: crea item + cargo + actualiza totales + actualiza personas
          const { data: rpc, error: rpcError } = await supabase.rpc("process_extra_charge", {
            p_stay_id: activeStay.id,
            p_charge_type: "EXTRA_PERSON",
            p_amount: extraPrice,
            p_quantity: chargeableCount,
            p_hours_to_extend: 0,
            p_shift_session_id: currentShiftId,
            p_payment_reference: generatePaymentReference("PEX"),
            p_new_current_people: newCurrentPeople,
            p_new_total_people: newTotalPeople,
          });

          if (rpcError || !rpc?.success) {
            throw new Error(rpcError?.message || rpc?.error || "Error al registrar persona extra");
          }

          toast.success(`${count} persona${count > 1 ? 's' : ''} extra registrada${count > 1 ? 's' : ''}`, {
            description: `Hab. ${room.number}: ${newCurrentPeople} personas (histórico: ${newTotalPeople}). +${formatCurrency(totalCharge)} (pendiente)`,
          });

          // ─── Audit Log ─────────────────────────────────────────
          logFinancialAction("EXTRA_PERSON", {
            roomNumber: room.number,
            amount: totalCharge,
            stayId: activeStay.id,
            salesOrderId: activeStay.sales_order_id,
            description: `${chargeableCount} persona(s) extra con cargo en Hab. ${room.number}: $${totalCharge.toFixed(2)}. Personas: ${current}→${newCurrentPeople}`,
            extra: { previous_people: current, new_people: newCurrentPeople, total_historic: newTotalPeople, charged_count: chargeableCount },
          });

          await notifyActiveValets(supabase, '👤 Persona Extra Registrada',
            `Habitación ${room.number}: Se registró ${chargeableCount} persona(s) extra. Cargo pendiente: ${formatCurrency(totalCharge)}.`,
            { type: 'NEW_EXTRA', consumptionId: rpc.item_id, roomNumber: room.number, stayId: activeStay.id }
          );
        } else {
          toast.warning("No se configuró precio de persona extra");
        }
      } else {
        // Sin cargo — solo actualizar personas
        await supabase.from("room_stays").update({
          current_people: newCurrentPeople,
          total_people: newTotalPeople,
        }).eq("id", activeStay.id);

        toast.success(`${count} persona${count > 1 ? 's' : ''} agregada${count > 1 ? 's' : ''}`, {
          description: `Hab. ${room.number}: ${newCurrentPeople} personas (histórico: ${newTotalPeople})`,
        });

        // ─── Audit Log ─────────────────────────────────────────
        logFinancialAction("ADD_PERSON", {
          roomNumber: room.number,
          stayId: activeStay.id,
          description: `${count} persona(s) agregada(s) (sin cargo) en Hab. ${room.number}. Personas: ${current}→${newCurrentPeople}`,
          extra: { previous_people: current, new_people: newCurrentPeople, total_historic: newTotalPeople, count },
        });

        await notifyActiveValets(supabase, '👤 Persona Agregada',
          `Habitación ${room.number}: Se agregaron ${count} persona(s). Total actual: ${newCurrentPeople}.`,
          { type: 'PERSON_ENTRY', roomNumber: room.number, stayId: activeStay.id }
        );
      }
    });
  };

  /**
   * Quitar persona(s) (salida definitiva, sin tolerancia).
   * @param count Número de personas a quitar (default: 1)
   */
  const handleRemovePerson = async (room: Room, count: number = 1) => {
    if (!checkAuthorization("Remover Persona")) return;
    if (room.status !== "OCUPADA") { toast.info("Esta habitación no está ocupada"); return; }

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa"); return; }

    const current = activeStay.current_people ?? 2;
    if (current - count < 1) {
      toast.error("No se puede quitar — quedaría vacía", {
        description: "Si la habitación quedará vacía, usa 'Salida' para hacer checkout.",
      });
      return;
    }

    await withAction(ctx, "Error al remover persona", async () => {
      const supabase = createClient();
      const newCurrentPeople = current - count;

      await supabase.from("room_stays").update({ current_people: newCurrentPeople }).eq("id", activeStay.id);

      toast.success(`${count} persona${count > 1 ? 's' : ''} removida${count > 1 ? 's' : ''}`, {
        description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''}`,
      });

      // ─── Audit Log ───────────────────────────────────────────
      logFinancialAction("REMOVE_PERSON", {
        roomNumber: room.number,
        stayId: activeStay.id,
        description: `${count} persona(s) removida(s) de Hab. ${room.number}. Personas: ${current}→${newCurrentPeople}`,
        extra: { previous_people: current, new_people: newCurrentPeople, count },
      });

      // ─── Flow Event ───────────────────────────────────────────
      findActiveFlow(activeStay.id).then(flowId => {
        if (flowId) {
          logFlowEvent(flowId, {
            event_type: "PERSON_REMOVED",
            description: `${count} persona(s) removida(s). Personas: ${current}→${newCurrentPeople}`,
            metadata: { previous: current, new_count: newCurrentPeople, removed_count: count },
          });
        }
      });

      await notifyActiveValets(supabase, '👤 Persona Salió',
        `Habitación ${room.number}: Salieron ${count} persona(s). Total actual: ${newCurrentPeople}.`,
        { type: 'PERSON_EXIT', roomNumber: room.number, stayId: activeStay.id }
      );
    });
  };

  /**
   * Personas salen con tolerancia de 1 hora para regresar.
   * @param count Número de personas que salen (default: 1)
   */
  const handlePersonLeaveWithTolerance = async (room: Room, count: number = 1) => {
    if (!checkAuthorization("Tolerancia Salida/Regreso")) return;
    if (room.status !== "OCUPADA") { toast.error("No se puede aplicar tolerancia a una habitación no ocupada"); return; }

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa"); return; }
    if (!room.room_types) { toast.error("Configuración incompleta"); return; }
    if (room.room_types.is_hotel) { toast.info("Tolerancia no disponible", { description: "Esta función solo aplica para habitaciones tipo motel" }); return; }

    const current = activeStay.current_people ?? 2;
    if (count > current) {
      toast.error("No pueden salir más personas de las que hay", {
        description: `Hay ${current} persona(s) y se intentan sacar ${count}.`,
      });
      return;
    }

    // Si ya hay tolerancia activa, sumar al conteo existente
    const existingPeopleOut = activeStay.tolerance_people_out ?? 0;

    await withAction(ctx, "Error al procesar tolerancia", async () => {
      const supabase = createClient();
      const newCurrentPeople = current - count;
      const newPeopleOut = existingPeopleOut + count;
      const toleranceType = newCurrentPeople === 0 ? 'ROOM_EMPTY' : 'PERSON_LEFT';

      // Si no había tolerancia, iniciar nueva. Si ya había, mantener el reloj original.
      const toleranceStartedAt = activeStay.tolerance_started_at || new Date().toISOString();

      await supabase.from("room_stays").update({
        current_people: newCurrentPeople,
        tolerance_started_at: toleranceStartedAt,
        tolerance_type: toleranceType,
        tolerance_people_out: newPeopleOut,
      }).eq("id", activeStay.id);

      const returnDeadline = activeStay.tolerance_started_at
        ? new Date(new Date(activeStay.tolerance_started_at).getTime() + 3600000)
        : new Date(Date.now() + 3600000);
      const expiryTime = returnDeadline.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

      if (newCurrentPeople === 0) {
        toast.warning("⏱️ Tolerancia iniciada - Habitación vacía", {
          description: `Hab. ${room.number}: ${newPeopleOut} persona(s) fuera. Tienen hasta las ${expiryTime} para regresar. Después se cobrará habitación completa (${formatCurrency(room.room_types!.base_price ?? 0)}).`,
          duration: 5000,
        });
      } else {
        toast.warning(`⏱️ Tolerancia — ${count} persona(s) salieron`, {
          description: `Hab. ${room.number}: ${newCurrentPeople} adentro, ${newPeopleOut} fuera. Tienen hasta las ${expiryTime} para regresar.`,
          duration: 5000,
        });
      }

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction("TOLERANCE", {
        roomNumber: room.number,
        stayId: activeStay.id,
        amount: toleranceType === 'ROOM_EMPTY' ? (room.room_types!.base_price ?? 0) : (room.room_types!.extra_person_price ?? 0),
        description: `Tolerancia: ${count} persona(s) salieron de Hab. ${room.number}. Tipo: ${toleranceType}. Personas: ${current}→${newCurrentPeople}. Fuera total: ${newPeopleOut}. Límite: ${expiryTime}`,
        extra: { action: "START", tolerance_type: toleranceType, deadline: expiryTime, previous_people: current, new_people: newCurrentPeople, people_out: newPeopleOut, leaving_count: count },
        severity: "WARNING",
      });

      // ─── Flow Event ─────────────────────────────────────────────
      findActiveFlow(activeStay.id).then(flowId => {
        if (flowId) {
          logFlowEvent(flowId, {
            event_type: "TOLERANCE_STARTED",
            description: `Tolerancia: ${count} persona(s) salieron (${toleranceType}). Personas: ${current}→${newCurrentPeople}. Fuera: ${newPeopleOut}. Límite: ${expiryTime}`,
            metadata: { tolerance_type: toleranceType, deadline: expiryTime, previous: current, new_count: newCurrentPeople, people_out: newPeopleOut },
          });
        }
      });

      // Imprimir ticket de tolerancia (fire-and-forget)
      sendPrintJobSilent('tolerance', {
        roomNumber: room.number,
        exitTime: new Date().toISOString(),
        returnDeadline: returnDeadline.toISOString(),
        people: newCurrentPeople,
        peopleOut: newPeopleOut,
        toleranceType,
      });

      await notifyActiveValets(supabase, '⏱️ Tolerancia Iniciada',
        `Habitación ${room.number}: Salieron ${count} persona(s) con derecho a regreso (1h). Total fuera: ${newPeopleOut}.`,
        { type: 'TOLERANCE_STARTED', roomNumber: room.number, stayId: activeStay.id }
      );
    });
  };

  /**
   * Personas regresan de tolerancia activa.
   * Si la tolerancia expiró, se cobra penalización (precio persona extra × N) sin sumar total_people.
   * @param count Número de personas que regresan (default: 1)
   */
  const handlePersonReturn = async (room: Room, count: number = 1) => {
    if (!checkAuthorization("Tolerancia Salida/Regreso")) return;
    if (room.status !== "OCUPADA") { toast.error("No se puede procesar regreso en habitación no ocupada"); return; }

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa"); return; }
    if (!room.room_types) { toast.error("Configuración incompleta"); return; }
    if (!activeStay.tolerance_started_at) { toast.error("No hay tolerancia activa"); return; }

    const peopleOut = activeStay.tolerance_people_out ?? 1; // Fallback a 1 por backward compatibility
    if (count > peopleOut) {
      toast.error("No pueden regresar más personas de las que salieron", {
        description: `Solo hay ${peopleOut} persona(s) fuera con tolerancia.`,
      });
      return;
    }

    await withAction(ctx, "Error al procesar regreso", async () => {
      const supabase = createClient();
      const current = activeStay.current_people ?? 2;
      const newCurrentPeople = current + count;
      const newPeopleOut = peopleOut - count;

      const toleranceStart = new Date(activeStay.tolerance_started_at!);
      const minutesElapsed = Math.floor((Date.now() - toleranceStart.getTime()) / 60000);
      const minutesRemaining = Math.max(0, 60 - minutesElapsed);
      const toleranceExpired = isToleranceExpired(activeStay.tolerance_started_at);

      if (toleranceExpired) {
        // ── Cobro de penalización por tolerancia expirada ──
        const currentShiftId = await getReceptionShiftId(supabase);

        if (activeStay.tolerance_type === 'ROOM_EMPTY' && current === 0) {
          // Habitación estaba vacía → cobrar precio base de habitación
          const basePrice = room.room_types!.base_price ?? 0;
          if (basePrice > 0) {
            const { data: rpc, error: rpcError } = await supabase.rpc("process_extra_charge", {
              p_stay_id: activeStay.id,
              p_charge_type: "EXTRA_PERSON",
              p_amount: basePrice,
              p_quantity: 1,
              p_hours_to_extend: 0,
              p_shift_session_id: currentShiftId,
              p_payment_reference: generatePaymentReference("TOL"),
              p_new_current_people: newCurrentPeople,
              p_new_total_people: activeStay.total_people ?? newCurrentPeople, // NO incrementar
            });

            if (rpcError || !rpc?.success) {
              throw new Error(rpcError?.message || rpc?.error || "Error al cobrar penalización");
            }

            toast.warning("⏱️ Tolerancia expirada — Habitación cobrada", {
              description: `Hab. ${room.number}: +${formatCurrency(basePrice)} (pendiente). Regresaron en ${minutesElapsed} min (tolerancia: 60 min).`,
              duration: 6000,
            });
          }
        } else {
          // Personas salieron → cobrar penalización por cada persona que regresa tarde
          const extraPrice = room.room_types!.extra_person_price ?? 0;
          if (extraPrice > 0) {
            const totalPenalty = extraPrice * count;
            const { data: rpc, error: rpcError } = await supabase.rpc("process_extra_charge", {
              p_stay_id: activeStay.id,
              p_charge_type: "EXTRA_PERSON",
              p_amount: extraPrice,
              p_quantity: count,
              p_hours_to_extend: 0,
              p_shift_session_id: currentShiftId,
              p_payment_reference: generatePaymentReference("TOL"),
              p_new_current_people: newCurrentPeople,
              p_new_total_people: activeStay.total_people ?? newCurrentPeople, // NO incrementar
            });

            if (rpcError || !rpc?.success) {
              throw new Error(rpcError?.message || rpc?.error || "Error al cobrar penalización");
            }

            toast.warning(`⏱️ Tolerancia expirada — Penalización: ${count} persona(s)`, {
              description: `Hab. ${room.number}: +${formatCurrency(totalPenalty)} (${count} × ${formatCurrency(extraPrice)}). Regresaron en ${minutesElapsed} min (tolerancia: 60 min).`,
              duration: 6000,
            });
          }
        }

        // Audit expired return
        logFinancialAction("TOLERANCE", {
          roomNumber: room.number,
          stayId: activeStay.id,
          amount: activeStay.tolerance_type === 'ROOM_EMPTY'
            ? (room.room_types!.base_price ?? 0)
            : (room.room_types!.extra_person_price ?? 0) * count,
          description: `Tolerancia EXPIRADA en Hab. ${room.number}. Tipo: ${activeStay.tolerance_type}. Regresaron: ${count}. Tiempo: ${minutesElapsed}min de 60min`,
          extra: { action: "RETURN_EXPIRED", tolerance_type: activeStay.tolerance_type, minutes_elapsed: minutesElapsed, returning_count: count, people_still_out: newPeopleOut },
          severity: "WARNING",
        });
      } else {
        // ── Regreso dentro de tolerancia — sin cargo ──
        toast.success(`✅ ${count} persona(s) regresaron a tiempo`, {
          description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''}. Regresaron en ${minutesElapsed} min (quedaban ${minutesRemaining} min).`,
        });

        // Audit on-time return
        logFinancialAction("TOLERANCE", {
          roomNumber: room.number,
          stayId: activeStay.id,
          description: `${count} persona(s) regresaron dentro de tolerancia en Hab. ${room.number}. Tiempo: ${minutesElapsed}min de 60min`,
          extra: { action: "RETURN", minutes_elapsed: minutesElapsed, minutes_remaining: minutesRemaining, returning_count: count, people_still_out: newPeopleOut },
        });
      }

      // ── Actualizar estado ──
      // Si aún quedan personas fuera, mantener tolerancia activa
      if (newPeopleOut > 0) {
        const newToleranceType = newCurrentPeople === 0 ? 'ROOM_EMPTY' : 'PERSON_LEFT';
        await supabase.from("room_stays").update({
          current_people: newCurrentPeople,
          tolerance_people_out: newPeopleOut,
          tolerance_type: newToleranceType,
          // tolerance_started_at se MANTIENE — el reloj sigue corriendo
        }).eq("id", activeStay.id);
      } else {
        // Todas las personas regresaron — limpiar tolerancia
        await supabase.from("room_stays").update({
          current_people: newCurrentPeople,
          tolerance_started_at: null,
          tolerance_type: null,
          tolerance_people_out: 0,
        }).eq("id", activeStay.id);
      }

      // ─── Flow Event ─────────────────────────────────────────────
      findActiveFlow(activeStay.id).then(flowId => {
        if (flowId) {
          logFlowEvent(flowId, {
            event_type: toleranceExpired ? "TOLERANCE_EXPIRED" : "PERSON_ADDED",
            description: `${count} persona(s) regresaron ${toleranceExpired ? 'TARDE' : 'a tiempo'}. Personas: ${current}→${newCurrentPeople}. Aún fuera: ${newPeopleOut}`,
            metadata: { returning_count: count, people_out: newPeopleOut, elapsed_minutes: minutesElapsed, expired: toleranceExpired },
          });
        }
      });

      await notifyActiveValets(supabase, toleranceExpired ? '⏱️ Regreso Tardío' : '👤 Persona Regresó',
        toleranceExpired
          ? `Habitación ${room.number}: ${count} persona(s) regresaron FUERA del tiempo de tolerancia (${minutesElapsed} min). Aún fuera: ${newPeopleOut}.`
          : `Habitación ${room.number}: ${count} persona(s) regresaron dentro del tiempo de tolerancia. Aún fuera: ${newPeopleOut}.`,
        { type: 'PERSON_RETURN', roomNumber: room.number, stayId: activeStay.id }
      );
    });
  };

  // ── Backward compatibility wrapper ──
  // handlePersonLeftReturning mantiene la firma original como toggle
  // pero ahora delega a las funciones especializadas
  const handlePersonLeftReturning = async (room: Room) => {
    const activeStay = getActiveStay(room);
    if (activeStay?.tolerance_started_at) {
      // Hay tolerancia activa → persona regresa (1 persona por compatibilidad)
      await handlePersonReturn(room, 1);
    } else {
      // No hay tolerancia → persona sale (1 persona por compatibilidad)
      await handlePersonLeaveWithTolerance(room, 1);
    }
  };

  return {
    handleAddPerson,
    handleRemovePerson,
    handlePersonLeftReturning,
    handlePersonLeaveWithTolerance,
    handlePersonReturn,
  };
}
