"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { toast } from "sonner";
import { Room, RoomStay } from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { logger } from "@/lib/utils/logger";
import { formatCurrency } from "@/lib/utils/formatters";
import { getOrCreateServiceProduct, createServiceItem, updateUnpaidItems, createDamageItem } from "@/lib/services/product-service";
import { EXIT_TOLERANCE_MS } from "@/lib/constants/room-constants";

// Generar referencia única para pagos
export function generatePaymentReference(prefix: string = "PAY"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Helper para obtener el turno activo del usuario actual
export async function getCurrentShiftId(supabase: any): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Obtener empleado asociado al usuario
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!employee) return null;

    // Obtener turno activo (status = 'active' según schema real de la tabla)
    const { data: session } = await supabase
      .from("shift_sessions")
      .select("id")
      .eq("employee_id", employee.id)
      .in("status", ["active", "open"])
      .maybeSingle();

    return session?.id || null;
  } catch (error) {
    console.error("Error getting current shift:", error);
    return null;
  }
}

// FIX: Helper para obtener SIEMPRE el turno de recepción activo
// Prioriza:
// 1. Turno de recepción activo (role = 'receptionist' o 'admin'/'manager')
// 2. Turno actual del usuario si no hay recepción (fallback)
export async function getReceptionShiftId(supabase: any): Promise<string | null> {
  try {
    // Buscar cualquier sesión activa de un recepcionista
    const { data: receptionSessions, error } = await supabase
      .from("shift_sessions")
      .select(`
        id,
        employees!inner (
          role
        )
      `)
      .in("status", ["active", "open"])
      .or("role.eq.receptionist,role.eq.admin,role.eq.manager", { foreignTable: "employees" })
      .order("clock_in_at", { ascending: false }) // Tomar el más reciente si hay varios
      .limit(1);

    if (receptionSessions && receptionSessions.length > 0) {
      return receptionSessions[0].id;
    }

    // Si no hay recepcionista activo, retornar null para evitar que se asigne a un cochero
    return null;
  } catch (error) {
    console.error("Error getting reception shift:", error);
    return null;
  }
}

// Helper para obtener employee_id del usuario actual
export async function getCurrentEmployeeId(supabase: any): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    return employee?.id || null;
  } catch (err) {
    console.error("Error getting current employee id:", err);
    return null;
  }
}

/**
 * Obtener el employee_id de la recepcionista en turno activo.
 * Se usa para asignar pagos/órdenes al empleado de recepción,
 * independientemente de quién esté operando el tablero (admin, manager, etc).
 * Si no hay recepcionista activa, hace fallback al empleado actual.
 */
export async function getReceptionEmployeeId(supabase: any): Promise<string | null> {
  try {
    // Buscar sesión activa de recepción y obtener el employee_id
    const { data: receptionSessions } = await supabase
      .from("shift_sessions")
      .select(`
        id,
        employee_id,
        employees!inner (
          role
        )
      `)
      .in("status", ["active", "open"])
      .or("role.eq.receptionist,role.eq.admin,role.eq.manager", { foreignTable: "employees" })
      .order("clock_in_at", { ascending: false })
      .limit(1);

    if (receptionSessions && receptionSessions.length > 0) {
      return receptionSessions[0].employee_id;
    }

    // Fallback: si no hay recepcionista, usar el empleado actual
    return await getCurrentEmployeeId(supabase);
  } catch (err) {
    console.error("Error getting reception employee id:", err);
    return await getCurrentEmployeeId(supabase);
  }
}

// Helper para obtener la estancia activa
export function getActiveStay(room: Room): RoomStay | null {
  return (room.room_stays || []).find((stay) => stay.status === "ACTIVA") || null;
}

// Constante para la tolerancia en milisegundos (1 hora)
const TOLERANCE_MS = 60 * 60 * 1000; // 1 hora

// Helper para verificar si la tolerancia ha expirado
export function isToleranceExpired(toleranceStartedAt: string | null | undefined): boolean {
  if (!toleranceStartedAt) return false;
  const started = new Date(toleranceStartedAt);
  const now = new Date();
  return (now.getTime() - started.getTime()) >= TOLERANCE_MS;
}

// Helper para calcular minutos restantes de tolerancia
export function getToleranceRemainingMinutes(toleranceStartedAt: string | null | undefined): number {
  if (!toleranceStartedAt) return 60;
  const started = new Date(toleranceStartedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - started.getTime();
  const remainingMs = Math.max(0, TOLERANCE_MS - elapsedMs);
  return Math.ceil(remainingMs / 60000);
}

// Helper para actualizar totales de una orden de venta
async function updateSalesOrderTotals(
  supabase: ReturnType<typeof createClient>,
  salesOrderId: string,
  additionalAmount: number
): Promise<{ success: boolean; newRemaining?: number }> {
  const { data: orderData, error: orderError } = await supabase
    .from("sales_orders")
    .select("subtotal, tax, paid_amount, remaining_amount")
    .eq("id", salesOrderId)
    .single();

  if (orderError || !orderData) {
    console.error("Error fetching sales order:", orderError);
    return { success: false };
  }

  const subtotal = Number(orderData.subtotal) || 0;
  const tax = Number(orderData.tax) || 0;
  const paidAmount = Number(orderData.paid_amount) || 0;
  const currentRemaining = Number(orderData.remaining_amount) || 0;

  const newSubtotal = subtotal + additionalAmount;
  const newTotal = newSubtotal + tax;
  // El remaining debe ser el actual + el cargo adicional (no recalcular desde paid_amount)
  const newRemaining = currentRemaining + additionalAmount;

  const { error: updateError } = await supabase
    .from("sales_orders")
    .update({
      subtotal: newSubtotal,
      total: newTotal,
      remaining_amount: newRemaining,
    })
    .eq("id", salesOrderId);

  if (updateError) {
    console.error("Error updating sales order:", updateError);
    return { success: false };
  }

  return { success: true, newRemaining };
}

/**
 * Helper para actualizar pagos pendientes existentes
 * Retorna el monto restante después de actualizar todos los pagos pendientes
 */
async function updatePendingPaymentsHelper(
  supabase: any,
  salesOrderId: string,
  payments: PaymentEntry[],
  totalPaid: number,
  referencePrefix: string = "PAG"
): Promise<number> {
  // Buscar pagos pendientes existentes para esta orden
  const { data: pendingPayments, error: pendingError } = await supabase
    .from("payments")
    .select("id, amount, concept")
    .eq("sales_order_id", salesOrderId)
    .eq("status", "PENDIENTE")
    .is("parent_payment_id", null)
    .order("created_at", { ascending: true });

  if (pendingError) {
    logger.error("Error fetching pending payments", pendingError);
    return totalPaid; // Retornar todo el monto si hay error
  }

  if (!pendingPayments || pendingPayments.length === 0) {
    logger.info("No pending payments found", { salesOrderId });
    return totalPaid; // No hay pagos pendientes, retornar todo el monto
  }

  logger.info("Found pending payments to update", {
    count: pendingPayments.length,
    payments: pendingPayments,
    totalPaid
  });

  const validPayments = payments.filter(p => p.amount > 0);
  const isMultipago = validPayments.length > 1;
  let remainingToPay = totalPaid;

  // Actualizar pagos pendientes existentes
  for (const pending of pendingPayments) {
    if (remainingToPay <= 0) break;

    const amountForThis = Math.min(pending.amount, remainingToPay);
    remainingToPay -= amountForThis;

    if (isMultipago) {
      // Multipago: Actualizar el pago pendiente a PAGADO y agregar subpagos
      await supabase
        .from("payments")
        .update({
          status: "PAGADO",
          payment_method: "PENDIENTE", // Mantener PENDIENTE para indicar que es multipago
        })
        .eq("id", pending.id);

      // Crear subpagos proporcionales para este pago pendiente
      const proportion = amountForThis / totalPaid;

        // Obtener turno para los subpagos nuevos (Recepción)
        const currentShiftId = await getReceptionShiftId(supabase);
        const currentEmployeeId = await getReceptionEmployeeId(supabase);
        
        const subpayments = validPayments.map(p => ({
        sales_order_id: salesOrderId,
        amount: Math.round(p.amount * proportion * 100) / 100,
        payment_method: p.method,
        reference: p.reference || generatePaymentReference("SUB"),
        concept: pending.concept, // Mantener el concepto original
        status: "PAGADO",
        payment_type: "PARCIAL",
        parent_payment_id: pending.id,
        shift_session_id: currentShiftId, // Vincular subpagos al turno actual
        collected_by: currentEmployeeId, // IMPORTANTE: vincular al empleado
        // Agregar terminal si es pago con tarjeta
        ...(p.method === "TARJETA" && p.terminal ? { terminal_code: p.terminal } : {}),
        // Agregar detalles de tarjeta
        ...(p.method === "TARJETA" && p.cardLast4 ? { card_last_4: p.cardLast4 } : {}),
        ...(p.method === "TARJETA" && p.cardType ? { card_type: p.cardType } : {}),
      }));

      const { error: subError } = await supabase
        .from("payments")
        .insert(subpayments);

      if (subError) {
        logger.error("Error inserting subpayments for pending payment", subError);
      }
    } else {
      // Pago único - actualizar el pago pendiente directamente
      const p = validPayments[0];

      // Obtener turno actual para actualizar el pago (Recepción)
      const currentShiftId = await getReceptionShiftId(supabase);
      const currentEmployeeId = await getReceptionEmployeeId(supabase);

      const updateData: any = {
        status: "PAGADO",
        payment_method: p.method,
        reference: p.reference || generatePaymentReference(referencePrefix),
        // Agregar terminal si es pago con tarjeta
        ...(p.method === "TARJETA" && p.terminal ? { terminal_code: p.terminal } : {}),
        // Agregar detalles de tarjeta
        ...(p.method === "TARJETA" && p.cardLast4 ? { card_last_4: p.cardLast4 } : {}),
        ...(p.method === "TARJETA" && p.cardType ? { card_type: p.cardType } : {}),
      };

      if (currentShiftId) {
        updateData.shift_session_id = currentShiftId; // Vincular al turno actual al momento de pagar
      }
      if (currentEmployeeId) {
        updateData.collected_by = currentEmployeeId;
      }

      await supabase
        .from("payments")
        .update(updateData)
        .eq("id", pending.id);

      logger.info("Updated pending payment (single payment)", {
        paymentId: pending.id,
        updates: {
          status: "PAGADO",
          payment_method: p.method,
          reference: p.reference || generatePaymentReference(referencePrefix)
        }
      });
    }

    logger.info("Updated pending payment to PAGADO", {
      paymentId: pending.id,
      concept: pending.concept,
      amount: pending.amount,
    });
  }

  // FIX: Actualizar remaining_amount y paid_amount en sales_orders
  // El monto aplicado a pagos pendientes es: totalPaid - remainingToPay
  const paidAmountApplied = totalPaid - remainingToPay;
  if (paidAmountApplied > 0) {
    // Obtenemos los valores actuales para calcular los nuevos
    const { data: currentOrder } = await supabase
      .from("sales_orders")
      .select("remaining_amount, paid_amount")
      .eq("id", salesOrderId)
      .single();

    if (currentOrder) {
      const newRemaining = Math.max(0, (Number(currentOrder.remaining_amount) || 0) - paidAmountApplied);
      // Se removió actualización de paid_amount ya que recepción no cobra directamente
      // const newPaid = (Number(currentOrder.paid_amount) || 0) + paidAmountApplied;

      await supabase
        .from("sales_orders")
        .update({
          remaining_amount: newRemaining,
          // paid_amount: newPaid,
        })
        .eq("id", salesOrderId);

      logger.info("Updated sales_order totals after pending payment", {
        salesOrderId,
        paidAmountApplied,
        newRemaining,
        // newPaid,
      });
    }
  }

  return remainingToPay; // Retornar el monto que sobró
}

import { notifyActiveValets } from "@/lib/services/valet-notification-service";

export interface UseRoomActionsReturn {
  actionLoading: boolean;
  handleAddPerson: (room: Room) => Promise<void>; // Persona nueva entra (cobra extra si >2)
  handleRemovePerson: (room: Room) => Promise<void>; // Persona sale definitivamente
  handlePersonLeftReturning: (room: Room) => Promise<void>; // Persona salió pero regresa (tolerancia 1h)
  handleAddDamageCharge: (room: Room, amount: number, description: string) => Promise<void>; // Agregar cargo por daño

  handleAddCustomHours: (room: Room, hours: number, isCourtesy?: boolean, courtesyReason?: string) => Promise<void>; // Agregar horas personalizadas
  handleRenewRoom: (room: Room) => Promise<void>; // Renovar habitación con precio base
  handleAdd4HourPromo: (room: Room) => Promise<void>; // Promoción de 4 horas
  updateRoomStatus: (
    room: Room,
    newStatus: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA",
    successMessage: string,
    notes?: string
  ) => Promise<void>;
  prepareCheckout: (room: Room) => Promise<{
    salesOrderId: string;
    remainingAmount: number;
  } | null>;
  processCheckout: (
    room: Room,
    checkoutInfo: { salesOrderId: string; remainingAmount: number },
    amount: number,
    payments?: PaymentEntry[],
    checkoutValetId?: string | null
  ) => Promise<boolean>;
  requestVehicle: (stayId: string) => Promise<boolean>;
  handleAuthorizeValetCheckout: (room: Room) => Promise<boolean>;
  handleCancelValetCheckout: (room: Room) => Promise<boolean>;
}

export function useRoomActions(onRefresh: () => Promise<void>): UseRoomActionsReturn {
  const [actionLoading, setActionLoading] = useState(false);
  const { isReceptionist, isAdmin, isManager } = useUserRole();

  const checkAuthorization = (actionName: string) => {
    if (!isReceptionist && !isAdmin && !isManager) {
      toast.error("Acceso denegado", {
        description: `Solo los recepcionistas pueden realizar la acción: ${actionName}`
      });
      return false;
    }
    return true;
  };

  /**
   * Agregar persona a la habitación
   * 
   * Comportamiento:
   * - Si hay tolerancia activa: La persona está REGRESANDO
   *   - Si regresa a tiempo: Solo incrementa current_people
   *   - Si tolerancia expiró: Cobra según tipo (habitación o persona extra)
   * - Si NO hay tolerancia: Es persona NUEVA
   *   - Incrementa current_people Y total_people
   *   - Cobra extra si total > 2 personas diferentes
   * 
   * @param room - Habitación donde se agrega la persona
   */
  const handleAddPerson = async (room: Room) => {
    if (!checkAuthorization("Agregar Persona")) return;

    if (room.status !== "OCUPADA") {
      logger.warn("Cannot add person to non-occupied room", { roomId: room.id, status: room.status });
      return;
    }

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa", {
        description: "Verifica que la habitación esté correctamente ocupada"
      });
      return;
    }

    if (!room.room_types) {
      toast.error("Configuración incompleta", {
        description: "No se encontró el tipo de habitación"
      });
      return;
    }

    const maxPeople = room.room_types.max_people ?? 2;
    const current = activeStay.current_people ?? 2;
    const next = current + 1;

    // Validación: No exceder capacidad máxima del tipo de habitación
    if (next > maxPeople) {
      toast.error("Capacidad máxima alcanzada", {
        description: `Esta habitación ${room.room_types.name} permite máximo ${maxPeople} personas`,
      });
      logger.warn("Attempt to exceed room capacity", {
        roomId: room.id,
        current,
        next,
        maxPeople
      });
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      const newCurrentPeople = next;

      // Si hay tolerancia activa y regresa la misma persona
      if (activeStay.tolerance_started_at) {
        const toleranceExpired = isToleranceExpired(activeStay.tolerance_started_at);

        if (toleranceExpired) {
          // Tolerancia expiró - cobrar según tipo
          if (activeStay.tolerance_type === 'ROOM_EMPTY') {
            const basePrice = room.room_types.base_price ?? 0;
            if (basePrice > 0) {
              await updateSalesOrderTotals(supabase, activeStay.sales_order_id, basePrice);

              // Registrar cargo por tolerancia expirada (habitación vacía)
              await supabase.from("payments").insert({
                sales_order_id: activeStay.sales_order_id,
                amount: basePrice,
                payment_method: "PENDIENTE",
                reference: generatePaymentReference("TOL"),
                concept: "TOLERANCIA_EXPIRADA",
                status: "PENDIENTE",
                payment_type: "COMPLETO",
                shift_session_id: await getReceptionShiftId(supabase) // Vincular al turno de recepción
              });

              toast.warning("Tolerancia expirada - Habitación cobrada", {
                description: `Hab. ${room.number}: +$${basePrice.toFixed(2)} MXN (pendiente)`,
              });
            }
          } else if (activeStay.tolerance_type === 'PERSON_LEFT') {
            const extraPrice = room.room_types.extra_person_price ?? 0;
            if (extraPrice > 0) {
              await updateSalesOrderTotals(supabase, activeStay.sales_order_id, extraPrice);

              // Registrar cargo por persona extra (tolerancia expirada)
              await supabase.from("payments").insert({
                sales_order_id: activeStay.sales_order_id,
                amount: extraPrice,
                payment_method: "PENDIENTE",
                reference: generatePaymentReference("PEX"),
                concept: "PERSONA_EXTRA",
                status: "PENDIENTE",
                payment_type: "COMPLETO",
              });

              toast.warning("Tolerancia expirada - Persona extra cobrada", {
                description: `Hab. ${room.number}: +$${extraPrice.toFixed(2)} MXN (pendiente)`,
              });
            }
          }
        } else {
          // Regresó a tiempo
          const remainingMin = getToleranceRemainingMinutes(activeStay.tolerance_started_at);
          toast.success("Regreso dentro de tolerancia", {
            description: `Hab. ${room.number}: Regresó a tiempo (quedaban ${remainingMin} min)`,
          });
        }

        // Limpiar tolerancia (NO incrementar total_people, es la misma persona)
        await supabase
          .from("room_stays")
          .update({
            current_people: newCurrentPeople,
            // total_people NO se modifica - es la misma persona regresando
            tolerance_started_at: null,
            tolerance_type: null,
          })
          .eq("id", activeStay.id);
      } else {
        // Persona NUEVA entrando - SIEMPRE incrementar total_people
        const previousTotalPeople = activeStay.total_people ?? current;
        const newTotalPeople = previousTotalPeople + 1;  // ✅ Siempre +1 para persona nueva

        // Cobrar extra si:
        // 1. current_people > 2 (más de 2 personas actuales), O
        // 2. total_people >= 2 (ya pasaron 2 personas diferentes, cualquier nueva es extra)
        const shouldChargeExtra = newCurrentPeople > 2 || previousTotalPeople >= 2;

        await supabase
          .from("room_stays")
          .update({
            current_people: newCurrentPeople,
            total_people: newTotalPeople,  // ✅ Siempre incrementa
          })
          .eq("id", activeStay.id);

        if (shouldChargeExtra) {
          const extraPrice = room.room_types.extra_person_price ?? 0;
          if (extraPrice > 0) {
            const updateResult = await updateSalesOrderTotals(supabase, activeStay.sales_order_id, extraPrice);
            logger.debug("Sales order totals updated for extra person", { updateResult, salesOrderId: activeStay.sales_order_id });

            // Obtener o crear producto de servicio usando el servicio centralizado
            const productResult = await getOrCreateServiceProduct();
            if (!productResult.success) {
              logger.error("Failed to get/create service product", productResult.error);
              toast.error("Error al registrar el cargo");
              return;
            }

            // Crear item de servicio para el cobro
            const itemResult = await createServiceItem(
              activeStay.sales_order_id,
              extraPrice,
              "EXTRA_PERSON",
              1
            );

            if (!itemResult.success) {
              logger.error("Error creating service item for extra person", itemResult.error);
              toast.error("Error al registrar el cargo");
              return;
            }

            // Registrar el cargo como pago pendiente con concepto PERSONA_EXTRA
            const { error: paymentError } = await supabase.from("payments").insert({
              sales_order_id: activeStay.sales_order_id,
              amount: extraPrice,
              payment_method: "PENDIENTE",
              reference: generatePaymentReference("PEX"),
              concept: "PERSONA_EXTRA",
              status: "PENDIENTE",
              payment_type: "COMPLETO",
              shift_session_id: await getReceptionShiftId(supabase),
            });

            if (paymentError) {
              logger.error("Error inserting pending payment for extra person", paymentError);
            }

            toast.success("Persona extra registrada", {
              description: `Hab. ${room.number}: ${newCurrentPeople} personas (histórico: ${newTotalPeople}). +${formatCurrency(extraPrice)} (pendiente)`,
            });

            // Notificación estandarizada a valets activos
            await notifyActiveValets(
              supabase,
              '👤 Persona Extra Registrada',
              `Habitación ${room.number}: Se registró persona extra. Saldo pendiente: ${formatCurrency(updateResult.newRemaining || extraPrice)}.`,
              {
                type: 'NEW_EXTRA',
                consumptionId: itemResult.data,
                roomNumber: room.number,
                stayId: activeStay.id
              }
            );

          } else {
            toast.warning("No se configuró precio de persona extra");
          }

        } else {
          toast.success("Persona agregada", {
            description: `Hab. ${room.number}: ${newCurrentPeople} personas (histórico: ${newTotalPeople})`,
          });

          // Notificación estandarizada a valets activos (Sin cobro)
          await notifyActiveValets(
            supabase,
            '👤 Persona Agregada',
            `Habitación ${room.number}: Se agregó una persona. Total actual: ${newCurrentPeople}.`,
            {
              type: 'PERSON_ENTRY',
              roomNumber: room.number,
              stayId: activeStay.id
            }
          );
        }

      }

      await onRefresh();
    } catch (error) {
      logger.error("Error adding person to room", error);
      toast.error("Error al agregar persona");
    } finally {
      setActionLoading(false);
    }
  };

  /**
 * Quitar persona de la habitación (salida definitiva, sin intención de regresar)
 * 
 * Comportamiento:
 * - Reduce current_people en 1
 * - NO modifica total_people (es un contador histórico acumulativo)
 * - NO crea tolerancia
 * - NO genera reembolsos (política: el cargo es permanente)
 * 
 * Nota: Esta acción es para personas que se van y NO regresarán.
 * Para personas que salen temporalmente, usar "Persona Salió/Regresa"
 * 
 * @param room - Habitación de donde se quita la persona
 */
  const handleRemovePerson = async (room: Room) => {
    if (!checkAuthorization("Remover Persona")) return;

    if (room.status !== "OCUPADA") {
      logger.warn("Cannot remove person from non-occupied room", { roomId: room.id, status: room.status });
      toast.info("Esta habitación no está ocupada");
      return;
    }

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa", {
        description: "Verifica que la habitación esté correctamente ocupada"
      });
      return;
    }

    const current = activeStay.current_people ?? 2;

    // Validación: Debe quedar al menos 1 persona (si quedan 0, debe ser checkout)
    if (current <= 1) {
      toast.error("No se puede quitar la última persona", {
        description: "Si la habitación quedará vacía, usa 'Salida' para hacer checkout.",
      });
      logger.warn("Attempt to remove last person", { roomId: room.id, currentPeople: current });
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      const newCurrentPeople = current - 1;

      await supabase
        .from("room_stays")
        .update({ current_people: newCurrentPeople })
        .eq("id", activeStay.id);

      logger.info("Person removed from room", {
        roomId: room.id,
        roomNumber: room.number,
        previousCount: current,
        newCount: newCurrentPeople
      });


      toast.success("Persona removida", {
        description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''}`,
      });

      // Notificación estandarizada a valets activos
      await notifyActiveValets(
        supabase,
        '👤 Persona Salió',
        `Habitación ${room.number}: Salió una persona. Total actual: ${newCurrentPeople}.`,
        {
          type: 'PERSON_EXIT',
          roomNumber: room.number,
          stayId: activeStay.id
        }
      );


      await onRefresh();
    } catch (error) {
      logger.error("Error removing person from room", error);
      toast.error("Error al remover persona");
    } finally {
      setActionLoading(false);
    }
  };

  /**
 * Toggle de salida/regreso con tolerancia (1 hora)
 * 
 * Comportamiento:
 * - Si NO hay tolerancia activa → Persona SALE (inicia tolerancia)
 *   - Reduce current_people
 *   - Establece tolerance_started_at y tolerance_type
 *   - Si current_people = 0: tipo ROOM_EMPTY (cobra habitación completa si expira)
 *   - Si current_people > 0: tipo PERSON_LEFT (cobra persona extra si expira)
 * 
 * - Si SÍ hay tolerancia activa → Persona REGRESA (cancela tolerancia)
 *   - Incrementa current_people
 *   - Limpia tolerance_started_at y tolerance_type
 *   - NO modifica total_people (es la misma persona)
 * 
 * Tolerancia: 1 hora para regresar sin cargo
 * Si expira: Se cobra al agregar persona (ver handleAddPerson)
 * 
 * @param room - Habitación donde se aplica la acción
 */
  const handlePersonLeftReturning = async (room: Room) => {
    if (!checkAuthorization("Tolerancia Salida/Regreso")) return;

    if (room.status !== "OCUPADA") {
      logger.warn("Cannot toggle tolerance on non-occupied room", { roomId: room.id, status: room.status });
      toast.error("No se puede aplicar tolerancia a una habitación no ocupada");
      return;
    }

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa", {
        description: "Verifica que la habitación esté correctamente ocupada"
      });
      return;
    }

    if (!room.room_types) {
      toast.error("Configuración incompleta", {
        description: "No se encontró el tipo de habitación"
      });
      return;
    }

    // No aplica para habitaciones de hotel (solo motel)
    if (room.room_types.is_hotel) {
      toast.info("Tolerancia no disponible", {
        description: "Esta función solo aplica para habitaciones tipo motel"
      });
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      // CASO 1: Si hay tolerancia activa → la persona REGRESA (cancelar tolerancia)
      if (activeStay.tolerance_started_at) {
        const current = activeStay.current_people ?? 2;
        const newCurrentPeople = current + 1;

        // Calcular tiempo de tolerancia usado
        const toleranceStart = new Date(activeStay.tolerance_started_at);
        const elapsed = Date.now() - toleranceStart.getTime();
        const minutesElapsed = Math.floor(elapsed / 60000);
        const minutesRemaining = Math.max(0, 60 - minutesElapsed);

        // NO incrementar total_people porque es la misma persona que ya había entrado
        await supabase
          .from("room_stays")
          .update({
            current_people: newCurrentPeople,
            // total_people NO se modifica - es la misma persona regresando
            tolerance_started_at: null,  // Limpiar tolerancia
            tolerance_type: null,         // Limpiar tipo
          })
          .eq("id", activeStay.id);

        logger.info("Person returned within tolerance", {
          roomId: room.id,
          roomNumber: room.number,
          newCount: newCurrentPeople,
          toleranceUsedMinutes: minutesElapsed
        });


        toast.success("✅ Persona regresó a tiempo", {
          description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''}. Regresó en ${minutesElapsed} min (quedaban ${minutesRemaining} min).`,
        });

        // Notificación estandarizada a valets activos
        await notifyActiveValets(
          supabase,
          '👤 Persona Regresó',
          `Habitación ${room.number}: La persona regresó dentro del tiempo de tolerancia.`,
          {
            type: 'PERSON_RETURN',
            roomNumber: room.number,
            stayId: activeStay.id
          }
        );


        await onRefresh();
        return;
      }

      // CASO 2: No hay tolerancia → la persona SALE (iniciar tolerancia)
      const current = activeStay.current_people ?? 2;

      // Validación: Debe haber al menos 1 persona para que salga
      if (current <= 0) {
        toast.error("No hay personas en la habitación", {
          description: "La habitación ya está vacía"
        });
        logger.warn("Attempt to start tolerance with 0 people", { roomId: room.id });
        return;
      }

      const newCurrentPeople = current - 1;
      const toleranceType = newCurrentPeople === 0 ? 'ROOM_EMPTY' : 'PERSON_LEFT';

      await supabase
        .from("room_stays")
        .update({
          current_people: newCurrentPeople,
          tolerance_started_at: new Date().toISOString(), // Iniciar tolerancia
          tolerance_type: toleranceType,
        })
        .eq("id", activeStay.id);

      logger.info("Tolerance started for person leaving", {
        roomId: room.id,
        roomNumber: room.number,
        toleranceType,
        newCount: newCurrentPeople,
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      });

      if (newCurrentPeople === 0) {
        const expiryTime = new Date(Date.now() + 3600000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        toast.warning("⏱️ Tolerancia iniciada - Habitación vacía", {
          description: `Hab. ${room.number}: Tiene hasta las ${expiryTime} para regresar. Después se cobrará habitación completa (${formatCurrency(room.room_types.base_price ?? 0)}).`,
          duration: 5000,
        });
      } else {
        const expiryTime = new Date(Date.now() + 3600000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        toast.warning("⏱️ Tolerancia iniciada - Persona salió", {
          description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''} en habitación. Tiene hasta las ${expiryTime} para regresar. Después se cobrará persona extra (${formatCurrency(room.room_types.extra_person_price ?? 0)}).`,
          duration: 5000,
        });
      }

      // Notificación estandarizada a valets activos
      await notifyActiveValets(
        supabase,
        '⏱️ Tolerancia Iniciada',
        `Habitación ${room.number}: Salió una persona con derecho a regreso (1h).`,
        {
          type: 'TOLERANCE_STARTED',
          roomNumber: room.number,
          stayId: activeStay.id
        }
      );

      await onRefresh();
    } catch (error) {
      logger.error("Error in tolerance handling", error);
      toast.error("Error al procesar tolerancia");
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Agregar cargo por daño
   */
  const handleAddDamageCharge = async (room: Room, amount: number, description: string) => {
    if (!checkAuthorization("Registrar Daño")) return;
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa");
      return;
    }

    if (amount <= 0 || !description) {
      toast.error("Datos inválidos para el cargo");
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      // 1. Crear item de daño
      const itemResult = await createDamageItem(
        activeStay.sales_order_id,
        amount,
        description
      );

      if (!itemResult.success) {
        toast.error("Error al registrar el daño");
        return;
      }

      // 2. Actualizar totales de la orden
      const updateResult = await updateSalesOrderTotals(supabase, activeStay.sales_order_id, amount);

      if (!updateResult.success) {
        // Log pero continuar
        logger.error("Failed to update totals after creating damage item", { salesOrderId: activeStay.sales_order_id });
      }

      // 3. Crear pago pendiente
      const { error: paymentError } = await supabase.from("payments").insert({
        sales_order_id: activeStay.sales_order_id,
        amount: amount,
        payment_method: "PENDIENTE",
        reference: generatePaymentReference("DMG"),
        concept: "DAMAGE_CHARGE",
        status: "PENDIENTE",
        payment_type: "COMPLETO",
        shift_session_id: await getReceptionShiftId(supabase),
        notes: description
      });

      if (paymentError) {
        logger.error("Error creating pending payment for damage", paymentError);
      }

      toast.success("Cargo por daño registrado", {
        description: `Hab. ${room.number}: ${formatCurrency(amount)} - ${description}`,
      });

      // Notificar a cocheros para cobro y verificación
      // Notificar a cocheros activos estandarizado
      await notifyActiveValets(
        supabase,
        '🛠️ Cargo por Daño',
        `Habitación ${room.number}: Se registró un daño ($${amount.toFixed(2)}). Descripción: ${description}`,
        {
          type: 'NEW_EXTRA',
          consumptionId: itemResult.data,
          roomNumber: room.number,
          stayId: activeStay.id
        }
      );

      await onRefresh();

    } catch (error) {
      logger.error("Error adding damage charge", error);
      toast.error("Error al registrar cargo por daño");
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Agregar horas personalizadas con pago
   */
  const handleAddCustomHours = async (room: Room, hours: number, isCourtesy?: boolean, courtesyReason?: string) => {
    if (!checkAuthorization("Agregar Horas")) return;
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación");
      return;
    }

    if (!room.room_types?.extra_hour_price || room.room_types.extra_hour_price <= 0) {
      toast.error("No se configuró el precio de hora extra para este tipo");
      return;
    }

    if (hours <= 0) {
      toast.error("El número de horas debe ser mayor a 0");
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      const extraHourPrice = room.room_types.extra_hour_price;
      const totalPrice = isCourtesy ? 0 : extraHourPrice * hours;

      // Obtener o crear producto de servicio
      const productResult = await getOrCreateServiceProduct();
      if (!productResult.success) {
        logger.error("Failed to get/create service product", productResult.error);
        toast.error("Error al registrar el cargo");
        return;
      }

        // Crear items de servicio para cada hora
        let lastItemId = "";
        for (let i = 0; i < hours; i++) {
          const itemRes = await createServiceItem(
            activeStay.sales_order_id,
            extraHourPrice,
            "EXTRA_HOUR",
            1,
            isCourtesy,
            courtesyReason
          );
          if (itemRes.success) lastItemId = itemRes.data;
        }

        // Si no es cortesía, siempre crear un pago PENDIENTE para que el cochero lo cobre
        if (!isCourtesy && totalPrice > 0) {
          const currentShiftId = await getReceptionShiftId(supabase);
          
          await supabase.from("payments").insert({
            sales_order_id: activeStay.sales_order_id,
            amount: totalPrice,
            payment_method: "PENDIENTE",
            reference: generatePaymentReference("HEX"),
            concept: "EXTRA_HOUR",
            status: "PENDIENTE",
            payment_type: "COMPLETO",
            shift_session_id: currentShiftId,
          });

          logger.info("Created PENDIENTE payment for custom hours", {
            salesOrderId: activeStay.sales_order_id,
            totalPrice,
          });
        }

        // FIX Auditoría #2: Actualizar subtotal/total/remaining de la orden
        if (!isCourtesy && totalPrice > 0) {
          await updateSalesOrderTotals(supabase, activeStay.sales_order_id, totalPrice);
        }

        // FIX Auditoría #3: Leer expected_check_out_at FRESCO de la DB para evitar race condition
        const { data: freshStayData } = await supabase
          .from("room_stays")
          .select("expected_check_out_at")
          .eq("id", activeStay.id)
          .single();

        if (freshStayData?.expected_check_out_at) {
          const currentCheckout = new Date(freshStayData.expected_check_out_at);
          currentCheckout.setHours(currentCheckout.getHours() + hours);

          await supabase
            .from("room_stays")
            .update({ expected_check_out_at: currentCheckout.toISOString() })
            .eq("id", activeStay.id);
        }

        toast.success("Horas agregadas", {
          description: `Hab. ${room.number}: +${hours} hora(s) - ${isCourtesy ? 'Cortesía' : `$${totalPrice.toFixed(2)} MXN`}`,
        });

        // Notificar a cocheros si hay cobro
        if (!isCourtesy && totalPrice > 0) {
          // Notificar a cocheros activos estandarizado
          await notifyActiveValets(
            supabase,
            '⏰ Cobro de Horas Extra',
            `Habitación ${room.number}: Cobrar ${hours} hora(s) extra ($${totalPrice.toFixed(2)} MXN).`,
            {
              type: 'NEW_EXTRA',
              consumptionId: lastItemId,
              roomNumber: room.number,
              stayId: activeStay.id
            }
          );
        }
      await onRefresh();
    } catch (error) {
      logger.error("Error adding custom hours", error);
      toast.error("Error al agregar horas");
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Renovar habitación con precio base
   */
  const handleRenewRoom = async (room: Room) => {
    if (!checkAuthorization("Renovar Habitación")) return;
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación");
      return;
    }

    if (!room.room_types?.base_price || room.room_types.base_price <= 0) {
      toast.error("No se configuró el precio base para este tipo");
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      const basePrice = room.room_types.base_price;

      // Crear item de renovación
      const productResult = await getOrCreateServiceProduct();
      if (!productResult.success) {
        logger.error("Failed to get/create service product", productResult.error);
        toast.error("Error al registrar el cargo");
        return;
      }

        const itemRes = await createServiceItem(
          activeStay.sales_order_id,
          basePrice,
          "RENEWAL",
          1
        );
        const consumptionId = itemRes.success ? itemRes.data : undefined;

        // Siempre crear un pago PENDIENTE para renovación
        const currentShiftId = await getReceptionShiftId(supabase);
        
        await supabase.from("payments").insert({
          sales_order_id: activeStay.sales_order_id,
          amount: basePrice,
          payment_method: "PENDIENTE",
          reference: generatePaymentReference("REN"),
          concept: "RENEWAL",
          status: "PENDIENTE",
          payment_type: "COMPLETO",
          shift_session_id: currentShiftId,
        });

        // FIX Auditoría #5: Actualizar subtotal/total/remaining de la orden
        await updateSalesOrderTotals(supabase, activeStay.sales_order_id, basePrice);

        logger.info("Created PENDIENTE payment for renewal", {
          salesOrderId: activeStay.sales_order_id,
          basePrice,
        });

        // FIX Auditoría #3: Leer expected_check_out_at FRESCO de la DB
        const { data: freshRenewalStay } = await supabase
          .from("room_stays")
          .select("expected_check_out_at")
          .eq("id", activeStay.id)
          .single();

        if (freshRenewalStay?.expected_check_out_at) {
          const currentCheckout = new Date(freshRenewalStay.expected_check_out_at);
          const now = new Date();

          // Determinar si estamos en período de fin de semana (Viernes 6am - Domingo 6am)
          const day = now.getDay();
          const hour = now.getHours();
          let isWeekendPeriod = false;

          if (day === 5 && hour >= 6) {
            isWeekendPeriod = true;
          } else if (day === 6) {
            isWeekendPeriod = true;
          } else if (day === 0 && hour < 6) {
            isWeekendPeriod = true;
          }

          const hours = isWeekendPeriod ? (room.room_types.weekend_hours ?? 4) : (room.room_types.weekday_hours ?? 4);
          currentCheckout.setHours(currentCheckout.getHours() + hours);

          await supabase
            .from("room_stays")
            .update({ expected_check_out_at: currentCheckout.toISOString() })
            .eq("id", activeStay.id);
        }

        toast.success("Habitación renovada", {
          description: `Hab. ${room.number}: Renovación completa - $${basePrice.toFixed(2)} MXN`,
        });


        // Notificación estandarizada a valets activos
        await notifyActiveValets(
          supabase,
          '🔄 Cobro de Renovación',
          `Habitación ${room.number}: Cobrar renovación ($${basePrice.toFixed(2)} MXN).`,
          {
            type: 'NEW_EXTRA',
            consumptionId: consumptionId,
            roomNumber: room.number,
            stayId: activeStay.id
          }
        );


      await onRefresh();
    } catch (error) {
      logger.error("Error renewing room", error);
      toast.error("Error al renovar habitación");
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Agregar promoción de 4 horas
   */
  const handleAdd4HourPromo = async (room: Room) => {
    if (!checkAuthorization("Aplicar Promoción")) return;
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación");
      return;
    }

    if (!room.room_types?.name) {
      toast.error("No se encontró el tipo de habitación");
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      // FIX #12: Fetch promo price from database instead of hardcoded
      const { data: pricingData, error: pricingError } = await supabase
        .from('pricing_config')
        .select('price')
        .eq('room_type_name', room.room_types.name)
        .eq('promo_type', '4H_PROMO')
        .eq('is_active', true)
        .single();

      if (pricingError || !pricingData) {
        logger.error("No pricing found for room type", {
          roomType: room.room_types.name,
          error: pricingError
        });
        toast.error("No hay precio de promoción configurado", {
          description: `Tipo: ${room.room_types.name}. Contacta al administrador.`
        });
        return;
      }

      const promoPrice = pricingData.price;

      // Crear item de promoción
      const productResult = await getOrCreateServiceProduct();
      if (!productResult.success) {
        logger.error("Failed to get/create service product", productResult.error);
        toast.error("Error al registrar el cargo");
        return;
      }

        const itemRes = await createServiceItem(
          activeStay.sales_order_id,
          promoPrice,
          "PROMO_4H",
          1
        );
        const consumptionId = itemRes.success ? itemRes.data : undefined;

        // Siempre crear un pago PENDIENTE para la promoción
        const currentShiftId = await getReceptionShiftId(supabase);
        
        await supabase.from("payments").insert({
          sales_order_id: activeStay.sales_order_id,
          amount: promoPrice,
          payment_method: "PENDIENTE",
          reference: generatePaymentReference("P4H"),
          concept: "PROMO_4H",
          status: "PENDIENTE",
          payment_type: "COMPLETO",
          shift_session_id: currentShiftId,
        });

        // FIX Auditoría #6: Actualizar subtotal/total/remaining de la orden
        await updateSalesOrderTotals(supabase, activeStay.sales_order_id, promoPrice);

        logger.info("Created PENDIENTE payment for 4h promo", {
          salesOrderId: activeStay.sales_order_id,
          promoPrice,
        });

        // FIX Auditoría #3: Leer expected_check_out_at FRESCO de la DB
        const { data: freshPromoStay } = await supabase
          .from("room_stays")
          .select("expected_check_out_at")
          .eq("id", activeStay.id)
          .single();

        if (freshPromoStay?.expected_check_out_at) {
          const currentCheckout = new Date(freshPromoStay.expected_check_out_at);
          currentCheckout.setHours(currentCheckout.getHours() + 4);

          await supabase
            .from("room_stays")
            .update({ expected_check_out_at: currentCheckout.toISOString() })
            .eq("id", activeStay.id);
        }

        toast.success("Promoción 4 horas aplicada", {
          description: `Hab. ${room.number}: +4 horas - $${promoPrice.toFixed(2)} MXN`,
        });





        // Notificación estandarizada a valets activos
        await notifyActiveValets(
          supabase,
          '🏷️ Cobro de Promoción 4H',
          `Habitación ${room.number}: Cobrar promoción de 4 horas ($${promoPrice.toFixed(2)} MXN).`,
          {
            type: 'NEW_EXTRA',
            consumptionId: consumptionId,
            roomNumber: room.number,
            stayId: activeStay.id
          }
        );


      await onRefresh();
    } catch (error) {
      logger.error("Error adding 4-hour promo", error);
      toast.error("Error al aplicar promoción");
    } finally {
      setActionLoading(false);
    }
  };

  // handleAddExtraHour REMOVIDA - Usar handleAddCustomHours(room, 1, payments) en su lugar

  const updateRoomStatus = async (
    room: Room,
    newStatus: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA",
    successMessage: string,
    notes?: string
  ) => {
    if (!checkAuthorization("Cambiar Estado de Habitación")) return;
    setActionLoading(true);
    const supabase = createClient();

    try {
      const updateData: any = { status: newStatus };
      if (notes !== undefined) {
        updateData.notes = notes;
      } else if (newStatus === "LIBRE") {
        // Limpiar notas si se libera la habitación
        updateData.notes = null;
      }

      const { error } = await supabase
        .from("rooms")
        .update(updateData)
        .eq("id", room.id);

      if (error) {
        console.error("Error updating room status:", error);
        toast.error("No se pudo actualizar el estado de la habitación");
        return;
      }

      // SOP: Si la habitación se libera (LIMPIA o LIBRE), cerrar cualquier estancia activa
      if (newStatus === "LIBRE") {
        const { error: stayError } = await supabase
          .from("room_stays")
          .update({ status: "FINALIZADA", actual_check_out_at: new Date().toISOString() })
          .eq("room_id", room.id)
          .eq("status", "ACTIVA");

        if (stayError) {
          console.error("Error finalizing stay on room free:", stayError);
          // No bloqueamos el flujo principal si esto falla, pero lo logueamos
        } else {
          logger.info("Stay finalized automatically on room free", { roomNumber: room.number });
        }
      }

      toast.success(successMessage);
      await onRefresh();
    } catch (error) {
      console.error("Error updating room status:", error);
      toast.error("Ocurrió un error al actualizar la habitación");
    } finally {
      setActionLoading(false);
    }
  };

  const prepareCheckout = async (room: Room) => {
    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación");
      return null;
    }

    const supabase = createClient();

    try {
      // FIX Auditoría #1: Usar el RPC atómico en lugar de calcular horas manualmente.
      // Esto es seguro porque el RPC usa FOR UPDATE (idempotente) y hora del servidor.
      // Si ya se cobraron las horas, el RPC no hará nada (devuelve hours_added = 0).
      if (room.room_types?.extra_hour_price && room.room_types.extra_hour_price > 0) {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('process_extra_hours_v2', {
          p_stay_id: activeStay.id
        });

        if (rpcError) {
          console.error("[prepareCheckout] Error calling RPC:", rpcError);
        } else if (rpcResult?.success && rpcResult.hours_added > 0) {
          toast.success("Horas extra registradas", {
            description: `${rpcResult.hours_added} hora(s) extra en Hab. ${room.number}`,
          });
        }
      }

      // Validar ID de orden
      if (!activeStay.sales_order_id) {
        console.error("Critical: Active stay has no sales_order_id", activeStay);
        toast.error("Error crítico: Estancia sin orden de venta");
        return null;
      }

      // Leer saldo pendiente actualizado
      const { data: order, error } = await supabase
        .from("sales_orders")
        .select("remaining_amount")
        .eq("id", activeStay.sales_order_id)
        .single();

      if (error || !order) {
        console.error("Error fetching sales order:", error, "ID:", activeStay.sales_order_id);
        toast.error("No se pudo obtener el saldo pendiente. Ver consola.");
        return null;
      }

      return {
        salesOrderId: activeStay.sales_order_id,
        remainingAmount: Number(order.remaining_amount) || 0,
      };
    } catch (e) {
      console.error("Error preparing checkout:", e);
      toast.error("No se pudo preparar el check-out");
      return null;
    }
  };

  const processCheckout = async (
    room: Room,
    checkoutInfo: { salesOrderId: string; remainingAmount: number },
    amount: number,
    payments?: PaymentEntry[],
    checkoutValetId?: string | null
  ): Promise<boolean> => {
    if (!checkAuthorization("Finalizar Salida")) return false;
    setActionLoading(true);
    const supabase = createClient();
    const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || amount;

    try {
      // 1. REVALIDAR TOLERANCIA Y VERIFICAR ESTADO (Strict Workflow)
      const { data: freshStay, error: stayError } = await supabase
        .from("room_stays")
        .select("tolerance_started_at, tolerance_type, id, vehicle_plate, checkout_valet_employee_id")
        .eq("sales_order_id", checkoutInfo.salesOrderId)
        .eq("status", "ACTIVA")
        .single();

      if (!stayError && freshStay) {
        // Validación de Tolerancia
        if (freshStay.tolerance_started_at && freshStay.tolerance_type) {
          if (isToleranceExpired(freshStay.tolerance_started_at)) {
            setActionLoading(false);
            toast.error("La tolerancia ha expirado", {
              description: "Se requiere cobrar hora extra. Por favor, cierre y vuelva a abrir el checkout.",
              duration: 6000
            });
            return false;
          }
        }

        // Validación de Salida de Vehículo (Strict Checkout Workflow)
        // SI hay placa registrada, DEBE haber un cochero de salida asignado (Verificado)
        if (freshStay.vehicle_plate && !freshStay.checkout_valet_employee_id) {
          setActionLoading(false);
          logger.warn("Checkout blocked due to unverified vehicle exit", {
            salesOrderId: checkoutInfo.salesOrderId,
            plate: freshStay.vehicle_plate
          });
          toast.error("Salida de vehículo no verificada", {
            description: "El cochero debe verificar la salida del vehículo antes de finalizar.",
            duration: 6000
          });
          return false;
        }

      } else {
        toast.error("No se encontró la estancia activa o ya fue finalizada.");
        return false;
      }

      // 1.5. VALIDACIÓN DE ENTREGAS PENDIENTES (Strict Consumption Workflow)
      // Bloquear checkout si hay productos de consumo que no han sido entregados
      const { data: pendingDeliveries } = await supabase
        .from("sales_order_items")
        .select("id")
        .eq("sales_order_id", checkoutInfo.salesOrderId)
        .eq("concept_type", "CONSUMPTION")
        .not("delivery_status", "is", null) // Solo validar si tiene estado de entrega
        .neq("delivery_status", "DELIVERED")
        .neq("delivery_status", "COMPLETED")
        .neq("delivery_status", "CANCELLED");

      if (pendingDeliveries && pendingDeliveries.length > 0) {
        setActionLoading(false);
        logger.warn("Checkout blocked due to undelivered items", {
          salesOrderId: checkoutInfo.salesOrderId,
          count: pendingDeliveries.length
        });
        toast.error("Entregas pendientes", {
          description: "No se puede finalizar. Hay productos sin entregar por el valet.",
          duration: 5000
        });
        return false;
      }

      // 2. PRIVACIDAD (Desactivar notificaciones)
      try {
        await fetch('/api/guest/unsubscribe-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_number: room.number }),
        });
      } catch (privacyError) {
        console.error("Error disabling notifications:", privacyError);
      }

      // 3. ACTUALIZAR ITEMS (Estado a PAGADO para evitar duplicados en reportes)
      // Esto es seguro hacerlo antes porque si falla el checkout, siguen estando "pagados" (o por pagar)
      // pero asociados a una orden abierta.
      const paymentMethod = payments && payments.length > 0
        ? (payments.length > 1 ? "MULTIPAGO" : payments[0].method)
        : "EFECTIVO";

      await updateUnpaidItems(checkoutInfo.salesOrderId, "EXTRA_PERSON", paymentMethod);
      await updateUnpaidItems(checkoutInfo.salesOrderId, "EXTRA_HOUR", paymentMethod);
      await updateUnpaidItems(checkoutInfo.salesOrderId, "ROOM_BASE", paymentMethod);
      await updateUnpaidItems(checkoutInfo.salesOrderId, "TOLERANCE_EXPIRED", paymentMethod);

      // 4. PREPARAR PAGOS PARA RPC
      // Primero limpiamos los pagos pendientes existentes
      let remainingAfterPending = totalPaid;
      if (payments && payments.length > 0) {
        const validPayments = payments.filter(p => p.amount > 0);
        remainingAfterPending = await updatePendingPaymentsHelper(
          supabase,
          checkoutInfo.salesOrderId,
          validPayments,
          totalPaid,
          "CHK"
        );
      }

      // Preparamos los "Nuevos Pagos" que la RPC debe insertar
      // Solo si sobra dinero después de cubrir los pendientes
      // Y SOLO si la orden no tiene pagos confirmados previos (evitar duplicados)
      const newPaymentsToInsert: any[] = [];
      const currentShiftId = await getReceptionShiftId(supabase);
      const currentEmployeeId = await getReceptionEmployeeId(supabase);

      // Verificar si ya existen pagos confirmados (PAGADO) para esta orden
      // Si los hay, NO crear nuevos — el dinero ya fue registrado al check-in
      let hasExistingConfirmedPayments = false;
      if (remainingAfterPending > 0) {
        const { count } = await supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("sales_order_id", checkoutInfo.salesOrderId)
          .eq("status", "PAGADO")
          .neq("concept", "CHECKOUT");

        hasExistingConfirmedPayments = (count || 0) > 0;
      }

      if (remainingAfterPending > 0 && !hasExistingConfirmedPayments && payments && payments.length > 0) {
        const validPayments = payments.filter(p => p.amount > 0);
        const isMultipago = validPayments.length > 1;

        if (isMultipago) {
          // Lógica compleja de multipago: Creamos un "dummy" entry en el array para que la RPC lo procese?
          // La RPC espera un array flat de pagos.
          // Para simplificar la RPC, le enviaremos los subpagos desglosados directamente.
          // Ojo: En el código original creábamos un PARENT pago. 
          // Para mantener la atomicidad real, la RPC debería soportar parent/child, pero eso complica el JSON.
          // ESTRATEGIA: Insertamos pagos individuales en la RPC. Si se requiere agrupación visual, se maneja después.
          // Por consistencia con updatePendingPaymentsHelper, usaremos lógica simplificada:

          // Calculamos proporción para los nuevos pagos
          const proportion = remainingAfterPending / totalPaid; // Cuánto de lo pagado es "nuevo"

          validPayments.forEach(p => {
            newPaymentsToInsert.push({
              sales_order_id: checkoutInfo.salesOrderId,
              amount: Number((p.amount * proportion).toFixed(2)),
              payment_method: p.method,
              reference: p.reference || generatePaymentReference("CHK"),
              concept: "CHECKOUT",
              status: "PAGADO",
              payment_type: "PARCIAL", // Marcamos como parciales para indicar desglose
              shift_session_id: currentShiftId,
              collected_by: currentEmployeeId,
              terminal_code: p.terminal,
              card_last_4: p.cardLast4,
              card_type: p.cardType
            });
          });

        } else {
          // Pago Único
          const p = validPayments[0];
          newPaymentsToInsert.push({
            sales_order_id: checkoutInfo.salesOrderId,
            amount: remainingAfterPending,
            payment_method: p.method,
            reference: p.reference || generatePaymentReference("CHK"),
            concept: "CHECKOUT",
            status: "PAGADO",
            payment_type: "COMPLETO",
            shift_session_id: currentShiftId,
            collected_by: currentEmployeeId,
            terminal_code: p.terminal,
            card_last_4: p.cardLast4,
            card_type: p.cardType
          });
        }
      }


      // 5. LLAMADA ATÓMICA RPC (COMMIT)
      // Si esto falla, NADA se guarda (excepto los items actualizados y pagos pendientes, que son safe)
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_checkout_transaction', {
        p_stay_id: freshStay!.id,
        p_sales_order_id: checkoutInfo.salesOrderId,
        p_payment_data: newPaymentsToInsert,
        p_checkout_valet_id: checkoutValetId || null
      });

      if (rpcError) {
        logger.error("RPC Checkout Failed", rpcError);
        toast.error("Error crítico en checkout", { description: rpcError.message });
        return false;
      }

      if (rpcData && (rpcData as any).success === false) {
        toast.error("Error en checkout", { description: (rpcData as any).error });
        return false;
      }

      // 6. ÉXITO
      const remainingTotal = Math.max(0, checkoutInfo.remainingAmount - totalPaid);
      toast.success("Check-out completado exitosamente", {
        description: remainingTotal > 0
          ? `Saldo restante: $${remainingTotal.toFixed(2)}`
          : `Hab. ${room.number} → SUCIA`
      });

      await onRefresh();
      return true;

    } catch (error) {
      logger.error("Error unhandled in checkout", error);
      toast.error("Error inesperado en checkout");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const requestVehicle = async (stayId: string): Promise<boolean> => {
    setActionLoading(true);
    const supabase = createClient();
    try {
      // 1. Obtener la estancia para saber quién es el valet y si tiene placas registradas
      const { data: stay, error: stayError } = await supabase
        .from('room_stays')
        .select('valet_employee_id, vehicle_requested_at, vehicle_plate, room:rooms(number)')
        .eq('id', stayId)
        .single();

      if (stayError || !stay) throw new Error("No se encontró la estancia");

      // FIX #8: Verificar si ya se solicitó el vehículo
      if (stay.vehicle_requested_at) {
        toast.info("Vehículo ya solicitado", {
          description: "El vehículo para esta habitación ya fue solicitado anteriormente."
        });
        return true; // No es error, solo ya está solicitado
      }

      // 3. Registrar solicitud en DB (timestamp)
      const { error } = await supabase
        .from('room_stays')
        .update({ vehicle_requested_at: new Date().toISOString() })
        .eq('id', stayId);

      if (error) throw error;

      // 4. Crear notificación contextual para todos los cocheros activos
      const roomNumber = (stay.room as any)?.number || "Desconocida";
      const hasPlate = !!stay.vehicle_plate;

      const title = hasPlate ? '🚗 Solicitar Auto' : '🚗 Registro Pendiente';
      const message = hasPlate
        ? `Recepción solicita el vehículo de la Habitación ${roomNumber} (Placas: ${stay.vehicle_plate})`
        : `Recepción te recuerda registrar el vehículo de la Habitación ${roomNumber}`;

      await notifyActiveValets(
        supabase,
        title,
        message,
        { type: hasPlate ? 'VEHICLE_REQUEST' : 'system_alert', stay_id: stayId, room_number: roomNumber }
      );



      toast.success("Recordatorio enviado al cochero 🔔");
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Error al enviar recordatorio");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleAuthorizeValetCheckout = async (room: Room): Promise<boolean> => {
    setActionLoading(true);
    const supabase = createClient();
    try {
      const activeStay = getActiveStay(room);
      if (!activeStay) throw new Error("No hay estancia activa");

      // 1. Autorizar la salida poniendo vehicle_requested_at
      const { error } = await supabase
        .from('room_stays')
        .update({
          vehicle_requested_at: new Date().toISOString()
        })
        .eq('id', activeStay.id);

      if (error) throw error;

      // Notificación estandarizada a valets activos
      await notifyActiveValets(
        supabase,
        '✅ Salida Autorizada',
        `Habitación ${room.number}: Recepción autorizó la salida.`,
        {
          type: 'CHECKOUT_REQUEST',
          stayId: activeStay.id,
          roomNumber: room.number
        }
      );

      toast.success("Salida autorizada ✅");
      await onRefresh();
      return true;
    } catch (error) {
      console.error("Error authorizing valet checkout:", error);
      toast.error("Error al autorizar la salida");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelValetCheckout = async (room: Room): Promise<boolean> => {
    setActionLoading(true);
    const supabase = createClient();
    try {
      const activeStay = getActiveStay(room);
      if (!activeStay) throw new Error("No hay estancia activa");

      // 1. Cancelar la solicitud (limpiar timestamps)
      const { error } = await supabase
        .from('room_stays')
        .update({
          valet_checkout_requested_at: null,
          vehicle_requested_at: null,
          checkout_valet_employee_id: null
        })
        .eq('id', activeStay.id);

      if (error) throw error;

      // 2. Notificar a valets
      await notifyValetRequestCancelled(supabase, room.number, activeStay.id);

      toast.success("Solicitud cancelada correctamente");
      await onRefresh();
      return true;
    } catch (error) {
      console.error("Error cancelling valet checkout:", error);
      toast.error("Error al cancelar la solicitud");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  return {
    actionLoading,
    handleAddPerson,
    handleRemovePerson,
    handlePersonLeftReturning,
    handleAddDamageCharge,
    // handleAddExtraHour removida - usar handleAddCustomHours
    handleAddCustomHours,
    handleRenewRoom,
    handleAdd4HourPromo,
    updateRoomStatus,
    prepareCheckout,
    processCheckout,
    requestVehicle,
    handleAuthorizeValetCheckout,
    handleCancelValetCheckout,
  };
}

/**
 * Helper para notificar a valets de la cancelación
 */
async function notifyValetRequestCancelled(supabase: any, roomNumber: string, stayId: string) {
    await notifyActiveValets(
        supabase,
        '🚫 Solicitud Cancelada',
        `Recepción canceló la solicitud de salida de la Habitación ${roomNumber}.`,
        {
            type: 'CHECKOUT_CANCELLED',
            stayId: stayId,
            roomNumber: roomNumber
        }
    );
}
