"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room, RoomStay } from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { logger } from "@/lib/utils/logger";
import { formatCurrency } from "@/lib/utils/formatters";
import { getOrCreateServiceProduct, createServiceItem, updateUnpaidItems } from "@/lib/services/product-service";

// Generar referencia única para pagos
function generatePaymentReference(prefix: string = "PAY"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Helper para obtener el turno activo del usuario actual
async function getCurrentShiftId(supabase: any): Promise<string | null> {
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
      .eq("status", "active")
      .maybeSingle();

    return session?.id || null;
  } catch (error) {
    console.error("Error getting current shift:", error);
    return null;
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

      // Obtener turno actual para los subpagos nuevos
      // Nota: getCurrentShiftId debería pasarse o estar disponible. Como es helper aislado, podemos requerir pasarlo o usar supabase.
      // Modificamos slightly para usar el supabase client que ya viene
      const { data: { user } } = await supabase.auth.getUser();
      let currentShiftId = null;
      if (user) {
        const { data: emp } = await supabase.from("employees").select("id").eq("auth_user_id", user.id).single();
        if (emp) {
          const { data: sess } = await supabase.from("shift_sessions").select("id").eq("employee_id", emp.id).eq("status", "open").maybeSingle();
          currentShiftId = sess?.id;
        }
      }

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

      // Obtener turno actual para actualizar el pago
      const { data: { user } } = await supabase.auth.getUser();
      let currentShiftId = null;
      if (user) {
        const { data: emp } = await supabase.from("employees").select("id").eq("auth_user_id", user.id).single();
        if (emp) {
          const { data: sess } = await supabase.from("shift_sessions").select("id").eq("employee_id", emp.id).eq("status", "open").maybeSingle();
          currentShiftId = sess?.id;
        }
      }

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

  return remainingToPay; // Retornar el monto que sobró
}

export interface UseRoomActionsReturn {
  actionLoading: boolean;
  handleAddPerson: (room: Room) => Promise<void>; // Persona nueva entra (cobra extra si >2)
  handleRemovePerson: (room: Room) => Promise<void>; // Persona sale definitivamente
  handlePersonLeftReturning: (room: Room) => Promise<void>; // Persona salió pero regresa (tolerancia 1h)

  handleAddCustomHours: (room: Room, hours: number, payments: PaymentEntry[]) => Promise<void>; // Agregar horas personalizadas
  handleRenewRoom: (room: Room, payments: PaymentEntry[]) => Promise<void>; // Renovar habitación con precio base
  handleAdd4HourPromo: (room: Room, payments: PaymentEntry[]) => Promise<void>; // Promoción de 4 horas
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
}

export function useRoomActions(onRefresh: () => Promise<void>): UseRoomActionsReturn {
  const [actionLoading, setActionLoading] = useState(false);

  // Agregar persona nueva (siempre cobra extra si >2)
  const handleAddPerson = async (room: Room) => {
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación");
      return;
    }

    if (!room.room_types) {
      toast.error("No se encontró el tipo de habitación");
      return;
    }

    const maxPeople = room.room_types.max_people ?? 2;
    const current = activeStay.current_people ?? 2;
    const next = current + 1;

    if (next > maxPeople) {
      toast.error("Límite de personas excedido", {
        description: `Máximo ${maxPeople} personas para ${room.room_types.name}`,
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
                shift_session_id: await getCurrentShiftId(supabase) // Vincular al turno
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
              shift_session_id: await getCurrentShiftId(supabase),
            });

            if (paymentError) {
              logger.error("Error inserting pending payment for extra person", paymentError);
            }

            toast.success("Persona extra registrada", {
              description: `Hab. ${room.number}: ${newCurrentPeople} personas (histórico: ${newTotalPeople}). +${formatCurrency(extraPrice)} (pendiente)`,
            });
          } else {
            toast.warning("No se configuró precio de persona extra");
          }
        } else {
          toast.success("Persona agregada", {
            description: `Hab. ${room.number}: ${newCurrentPeople} personas (histórico: ${newTotalPeople})`,
          });
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
   * Quitar persona de la habitación (se fue definitivamente, sin tolerancia)
   * Esta función reduce el contador de personas actuales
   * Nota: No reduce total_people (histórico de personas diferentes que han estado)
   */
  const handleRemovePerson = async (room: Room) => {
    if (room.status !== "OCUPADA") {
      logger.warn("Cannot remove person from non-occupied room", { roomId: room.id, status: room.status });
      return;
    }

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación");
      return;
    }

    const current = activeStay.current_people ?? 2;

    // Validar que haya al menos 1 persona
    if (current <= 1) {
      toast.error("Debe haber al menos 1 persona en la habitación", {
        description: "Usa 'Salida' para hacer checkout si no queda nadie.",
      });
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

      await onRefresh();
    } catch (error) {
      logger.error("Error removing person from room", error);
      toast.error("Error al remover persona");
    } finally {
      setActionLoading(false);
    }
  };

  // Persona salió pero va a regresar (inicia tolerancia) O persona regresa (cancela tolerancia)
  const handlePersonLeftReturning = async (room: Room) => {
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación");
      return;
    }

    if (!room.room_types) {
      toast.error("No se encontró el tipo de habitación");
      return;
    }

    // No aplica para hotel/torre
    if (room.room_types.is_hotel) {
      toast.info("Esta función no aplica para habitaciones de hotel");
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      // CASO 1: Si hay tolerancia activa → la persona REGRESA (cancelar tolerancia)
      if (activeStay.tolerance_started_at) {
        const current = activeStay.current_people ?? 2;
        const newCurrentPeople = current + 1;
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
          newCount: newCurrentPeople
        });

        toast.success("Persona regresó a tiempo", {
          description: `Hab. ${room.number}: ${newCurrentPeople} persona${newCurrentPeople !== 1 ? 's' : ''}. Tolerancia cancelada.`,
        });

        await onRefresh();
        return;
      }

      // CASO 2: No hay tolerancia → la persona SALE (iniciar tolerancia)
      const current = activeStay.current_people ?? 2;
      if (current <= 0) {
        toast.error("No hay personas en la habitación");
        return;
      }

      const newCurrentPeople = current - 1;
      const toleranceType = newCurrentPeople === 0 ? 'ROOM_EMPTY' : 'PERSON_LEFT';

      await supabase
        .from("room_stays")
        .update({
          current_people: newCurrentPeople,
          tolerance_started_at: new Date().toISOString(),
          tolerance_type: toleranceType,
        })
        .eq("id", activeStay.id);

      logger.info("Tolerance started for person leaving", {
        roomId: room.id,
        roomNumber: room.number,
        toleranceType,
        newCount: newCurrentPeople
      });

      if (newCurrentPeople === 0) {
        toast.warning("Tolerancia iniciada - Habitación vacía", {
          description: `Hab. ${room.number}: 1 hora para regresar. Después se cobra habitación completa.`,
        });
      } else {
        toast.warning("Tolerancia iniciada - Persona salió", {
          description: `Hab. ${room.number}: 1 hora para regresar. Después se cobra persona extra.`,
        });
      }

      await onRefresh();
    } catch (error) {
      logger.error("Error in tolerance handling", error);
      toast.error("Error al procesar tolerancia");
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Agregar horas personalizadas con pago
   */
  const handleAddCustomHours = async (room: Room, hours: number, payments: PaymentEntry[]) => {
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
      const totalPrice = extraHourPrice * hours;
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

      // Actualizar totales de la orden
      const result = await updateSalesOrderTotals(supabase, activeStay.sales_order_id, totalPrice);

      if (result.success) {
        // Obtener o crear producto de servicio
        const productResult = await getOrCreateServiceProduct();
        if (!productResult.success) {
          logger.error("Failed to get/create service product", productResult.error);
          toast.error("Error al registrar el cargo");
          return;
        }

        // Crear items de servicio para cada hora
        for (let i = 0; i < hours; i++) {
          await createServiceItem(
            activeStay.sales_order_id,
            extraHourPrice,
            "EXTRA_HOUR",
            1
          );
        }

        // Procesar el pago
        const remainingAfterPending = await updatePendingPaymentsHelper(
          supabase,
          activeStay.sales_order_id,
          payments,
          totalPaid,
          "HEX"
        );

        // Note: No bloqueamos por remainingAfterPending > 0
        if (remainingAfterPending > 0) {
          logger.warn("Remaining amount after custom hours payment", { remainingAfterPending, totalPaid });
        }

        // Actualizar paid_amount en sales_orders
        await supabase
          .from("sales_orders")
          .update({
            paid_amount: supabase.rpc('increment', { x: totalPaid }),
            remaining_amount: supabase.rpc('decrement', { x: totalPaid }),
          })
          .eq("id", activeStay.sales_order_id);

        // Extender expected_check_out_at según las horas agregadas
        if (activeStay.expected_check_out_at) {
          const currentCheckout = new Date(activeStay.expected_check_out_at);
          currentCheckout.setHours(currentCheckout.getHours() + hours);

          await supabase
            .from("room_stays")
            .update({ expected_check_out_at: currentCheckout.toISOString() })
            .eq("id", activeStay.id);
        }

        toast.success("Horas agregadas", {
          description: `Hab. ${room.number}: +${hours} hora(s) - $${totalPrice.toFixed(2)} MXN`,
        });
        await onRefresh();
      } else {
        toast.error("No se pudo agregar las horas");
      }
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
  const handleRenewRoom = async (room: Room, payments: PaymentEntry[]) => {
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
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

      // Actualizar totales de la orden
      const result = await updateSalesOrderTotals(supabase, activeStay.sales_order_id, basePrice);

      if (result.success) {
        // Crear item de renovación
        const productResult = await getOrCreateServiceProduct();
        if (!productResult.success) {
          logger.error("Failed to get/create service product", productResult.error);
          toast.error("Error al registrar el cargo");
          return;
        }

        await createServiceItem(
          activeStay.sales_order_id,
          basePrice,
          "RENEWAL",
          1
        );

        // Procesar el pago
        const remainingAfterPending = await updatePendingPaymentsHelper(
          supabase,
          activeStay.sales_order_id,
          payments,
          totalPaid,
          "REN"
        );

        // Note: No bloqueamos por remainingAfterPending > 0 porque el pago se procesó correctamente
        if (remainingAfterPending > 0) {
          logger.warn("Remaining amount after renewal payment", { remainingAfterPending, totalPaid });
        }

        // Extender expected_check_out_at según las horas del tipo
        if (activeStay.expected_check_out_at) {
          const currentCheckout = new Date(activeStay.expected_check_out_at);
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
        await onRefresh();
      } else {
        toast.error("No se pudo renovar la habitación");
      }
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
  const handleAdd4HourPromo = async (room: Room, payments: PaymentEntry[]) => {
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

    // Importar constantes en el scope
    const FOUR_HOUR_PROMO_PRICES: Record<string, number> = {
      "Alberca": 1000,
      "Jacuzzi y Sauna": 600,
      "Jacuzzi": 440,
      "Sencilla": 300,
      "Torre": 270,
    };

    const promoPrice = FOUR_HOUR_PROMO_PRICES[room.room_types.name];
    if (!promoPrice || promoPrice <= 0) {
      toast.error("No hay precio de promoción configurado para este tipo");
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

      // Actualizar totales de la orden
      const result = await updateSalesOrderTotals(supabase, activeStay.sales_order_id, promoPrice);

      if (result.success) {
        // Crear item de promoción
        const productResult = await getOrCreateServiceProduct();
        if (!productResult.success) {
          logger.error("Failed to get/create service product", productResult.error);
          toast.error("Error al registrar el cargo");
          return;
        }

        await createServiceItem(
          activeStay.sales_order_id,
          promoPrice,
          "PROMO_4H",
          1
        );

        // Procesar el pago
        const remainingAfterPending = await updatePendingPaymentsHelper(
          supabase,
          activeStay.sales_order_id,
          payments,
          totalPaid,
          "P4H"
        );

        // Note: No bloqueamos por remainingAfterPending > 0
        if (remainingAfterPending > 0) {
          logger.warn("Remaining amount after 4h promo payment", { remainingAfterPending, totalPaid });
        }

        // Extender expected_check_out_at en 4 horas
        if (activeStay.expected_check_out_at) {
          const currentCheckout = new Date(activeStay.expected_check_out_at);
          currentCheckout.setHours(currentCheckout.getHours() + 4);

          await supabase
            .from("room_stays")
            .update({ expected_check_out_at: currentCheckout.toISOString() })
            .eq("id", activeStay.id);
        }

        toast.success("Promoción 4 horas aplicada", {
          description: `Hab. ${room.number}: +4 horas - $${promoPrice.toFixed(2)} MXN`,
        });
        await onRefresh();
      } else {
        toast.error("No se pudo aplicar la promoción");
      }
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
      // Calcular horas extra automáticas
      let extraHours = 0;
      if (activeStay.expected_check_out_at && room.room_types) {
        const expected = new Date(activeStay.expected_check_out_at);
        const now = new Date();
        const diffMs = now.getTime() - expected.getTime();
        if (diffMs > 0) {
          extraHours = Math.ceil(diffMs / (60 * 60 * 1000));
        }
      }

      // Agregar horas extra al total si aplica
      if (extraHours > 0 && room.room_types?.extra_hour_price && room.room_types.extra_hour_price > 0) {
        const extraAmount = extraHours * room.room_types.extra_hour_price;
        const result = await updateSalesOrderTotals(supabase, activeStay.sales_order_id, extraAmount);
        if (result.success) {
          toast.success("Horas extra registradas", {
            description: `${extraHours} hora(s) extra en Hab. ${room.number}`,
          });
        }
      }

      // Leer saldo pendiente actualizado
      const { data: order, error } = await supabase
        .from("sales_orders")
        .select("remaining_amount")
        .eq("id", activeStay.sales_order_id)
        .single();

      if (error || !order) {
        console.error("Error fetching sales order:", error);
        toast.error("No se pudo obtener el saldo pendiente");
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
    setActionLoading(true);
    const supabase = createClient();
    const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || amount;

    try {
      // REVALIDAR TOLERANCIA: Obtener datos frescos de la estancia
      const { data: freshStay, error: stayError } = await supabase
        .from("room_stays")
        .select("tolerance_started_at, tolerance_type")
        .eq("sales_order_id", checkoutInfo.salesOrderId)
        .eq("status", "active")
        .single();

      if (!stayError && freshStay) {
        // Verificar si la tolerancia expiró DURANTE el modal
        if (freshStay.tolerance_started_at && freshStay.tolerance_type) {
          const toleranceExpired = isToleranceExpired(freshStay.tolerance_started_at);

          if (toleranceExpired) {
            // Tolerancia expiró mientras el modal estaba abierto
            setActionLoading(false);
            toast.error("La tolerancia ha expirado", {
              description: "Se requiere cobrar hora extra. Por favor, cierre y vuelva a abrir el checkout.",
              duration: 6000
            });
            return false; // Abortar checkout
          }
        }
      }

      // PRIVACIDAD: Desactivar notificaciones para esta habitación
      try {
        await fetch('/api/guest/unsubscribe-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_number: room.number }),
        });
      } catch (privacyError) {
        console.error("Error disabling notifications:", privacyError);
        // No bloqueamos el checkout por esto, pero lo logueamos
      }

      const finalizeStay = async () => {
        const activeStay = getActiveStay(room);
        if (activeStay) {
          await supabase
            .from("room_stays")
            .update({
              status: "FINALIZADA",
              actual_check_out_at: new Date().toISOString(),
              checkout_valet_employee_id: checkoutValetId || null,
            })
            .eq("id", activeStay.id);
        }

        await supabase
          .from("rooms")
          .update({ status: "SUCIA" })
          .eq("id", room.id);

        await supabase
          .from("sales_orders")
          .update({ status: "ENDED" })
          .eq("id", checkoutInfo.salesOrderId);
      };

      // Insertar pagos en la tabla payments
      if (payments && payments.length > 0) {
        const validPayments = payments.filter(p => p.amount > 0);

        // 1. Primero actualizar pagos pendientes existentes
        const remainingAfterPending = await updatePendingPaymentsHelper(
          supabase,
          checkoutInfo.salesOrderId,
          validPayments,
          totalPaid,
          "CHK" // Prefix para checkout
        );

        logger.info("Pending payments updated in checkout", {
          totalPaid,
          remainingAfterPending,
          salesOrderId: checkoutInfo.salesOrderId
        });

        // 2. Solo crear nuevo pago si sobra monto después de actualizar pendientes
        if (remainingAfterPending > 0) {
          const isMultipago = validPayments.length > 1;

          if (isMultipago) {
            // MULTIPAGO: Crear cargo principal + subpagos
            const currentShiftId = await getCurrentShiftId(supabase);
            const { data: mainPayment, error: mainError } = await supabase
              .from("payments")
              .insert({
                sales_order_id: checkoutInfo.salesOrderId,
                amount: remainingAfterPending,  // ✅ Usar monto restante
                payment_method: "PENDIENTE",
                reference: generatePaymentReference("CHK"),
                concept: "CHECKOUT",
                status: "PAGADO",
                payment_type: "COMPLETO",
                shift_session_id: currentShiftId,
              })
              .select("id")
              .single();

            if (mainError) {
              logger.error("Error inserting main payment", mainError);
            } else if (mainPayment) {
              // currentShiftId ya obtenido arriba
              const subpayments = validPayments.map(p => ({
                sales_order_id: checkoutInfo.salesOrderId,
                amount: p.amount,
                payment_method: p.method,
                reference: p.reference || generatePaymentReference("SUB"),
                concept: "CHECKOUT",
                status: "PAGADO",
                payment_type: "PARCIAL",
                parent_payment_id: mainPayment.id,
                shift_session_id: currentShiftId, // Vinculado al turno
                // Agregar terminal si es pago con tarjeta
                ...(p.method === "TARJETA" && p.terminal ? { terminal_code: p.terminal } : {}),
              }));

              const { error: subError } = await supabase
                .from("payments")
                .insert(subpayments);

              if (subError) {
                logger.error("Error inserting subpayments", subError);
              }
            }
          } else if (validPayments.length === 1) {
            // PAGO ÚNICO
            const p = validPayments[0];
            const currentShiftId = await getCurrentShiftId(supabase);
            const { error: paymentsError } = await supabase
              .from("payments")
              .insert({
                sales_order_id: checkoutInfo.salesOrderId,
                amount: remainingAfterPending,  // ✅ Usar monto restante
                payment_method: p.method,
                reference: p.reference || generatePaymentReference("CHK"),
                concept: "CHECKOUT",
                status: "PAGADO",
                payment_type: "COMPLETO",
                shift_session_id: currentShiftId,
                // Agregar terminal si es pago con tarjeta
                ...(p.method === "TARJETA" && p.terminal ? { terminal_code: p.terminal } : {}),
              });

            if (paymentsError) {
              console.error("Error inserting payment:", paymentsError);
            }
          }
        }
      }

      // Determinar método de pago para actualizar items
      const paymentMethod = payments && payments.length > 0
        ? (payments.length > 1 ? "MULTIPAGO" : payments[0].method)
        : "EFECTIVO";

      // Actualizar items no pagados a pagados (evita duplicados)
      await updateUnpaidItems(checkoutInfo.salesOrderId, "EXTRA_PERSON", paymentMethod);
      await updateUnpaidItems(checkoutInfo.salesOrderId, "EXTRA_HOUR", paymentMethod);
      await updateUnpaidItems(checkoutInfo.salesOrderId, "ROOM_BASE", paymentMethod);
      await updateUnpaidItems(checkoutInfo.salesOrderId, "TOLERANCE_EXPIRED", paymentMethod);

      if (checkoutInfo.remainingAmount <= 0 || totalPaid <= 0) {
        await finalizeStay();
        toast.success("Check-out completado", {
          description: `Hab. ${room.number} → SUCIA`,
        });
      } else {
        const { data, error } = await supabase.rpc("process_payment", {
          order_id: checkoutInfo.salesOrderId,
          payment_amount: totalPaid,
        });

        if (error) {
          logger.error("Error processing payment", error);
          toast.error("Error al procesar el pago");
          return false;
        }

        const result = (data as any)?.[0];
        if (result?.success === false) {
          toast.error(result.message || "No se pudo procesar el pago");
          return false;
        }

        const { data: orderAfter } = await supabase
          .from("sales_orders")
          .select("remaining_amount")
          .eq("id", checkoutInfo.salesOrderId)
          .single();

        const remaining = Number(orderAfter?.remaining_amount) || 0;

        if (remaining <= 0) {
          await finalizeStay();
          toast.success("Check-out completado", {
            description: `Hab. ${room.number} → SUCIA`,
          });
        } else {
          const methodsSummary = payments?.map(p => `${p.method}: $${p.amount.toFixed(2)}`).join(', ') || '';
          toast.success("Pago registrado", {
            description: `Pagado: $${totalPaid.toFixed(2)} (${methodsSummary}). Saldo: $${remaining.toFixed(2)}`,
          });
        }
      }

      await onRefresh();
      return true;
    } catch (error) {
      logger.error("Error during checkout", error);
      toast.error("Error al realizar el check-out");
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
    // handleAddExtraHour removida - usar handleAddCustomHours
    handleAddCustomHours,
    handleRenewRoom,
    handleAdd4HourPromo,
    updateRoomStatus,
    prepareCheckout,
    processCheckout,
  };
}
