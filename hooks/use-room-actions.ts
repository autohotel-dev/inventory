"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room, RoomStay } from "@/components/sales/room-types";

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
    .select("subtotal, tax, paid_amount")
    .eq("id", salesOrderId)
    .single();

  if (orderError || !orderData) {
    console.error("Error fetching sales order:", orderError);
    return { success: false };
  }

  const subtotal = Number(orderData.subtotal) || 0;
  const tax = Number(orderData.tax) || 0;
  const paidAmount = Number(orderData.paid_amount) || 0;

  const newSubtotal = subtotal + additionalAmount;
  const newTotal = newSubtotal + tax;
  const newRemaining = Math.max(newTotal - paidAmount, 0);

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

export interface UseRoomActionsReturn {
  actionLoading: boolean;
  handleAddPerson: (room: Room) => Promise<void>; // Persona nueva entra (cobra extra si >2)
  handleRemovePerson: (room: Room) => Promise<void>; // Persona sale definitivamente
  handlePersonLeftReturning: (room: Room) => Promise<void>; // Persona salió pero regresa (tolerancia 1h)
  handleAddExtraHour: (room: Room) => Promise<void>;
  updateRoomStatus: (
    room: Room,
    newStatus: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA",
    successMessage: string
  ) => Promise<void>;
  prepareCheckout: (room: Room) => Promise<{
    salesOrderId: string;
    remainingAmount: number;
  } | null>;
  processCheckout: (
    room: Room,
    checkoutInfo: { salesOrderId: string; remainingAmount: number },
    amount: number,
    paymentMethod?: string
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
      const newTotalPeople = Math.max(activeStay.total_people ?? current, newCurrentPeople);

      // Si hay tolerancia activa y regresa la misma persona
      if (activeStay.tolerance_started_at) {
        const toleranceExpired = isToleranceExpired(activeStay.tolerance_started_at);
        
        if (toleranceExpired) {
          // Tolerancia expiró - cobrar según tipo
          if (activeStay.tolerance_type === 'ROOM_EMPTY') {
            const basePrice = room.room_types.base_price ?? 0;
            if (basePrice > 0) {
              await updateSalesOrderTotals(supabase, activeStay.sales_order_id, basePrice);
              toast.warning("Tolerancia expirada - Habitación cobrada", {
                description: `Hab. ${room.number}: +$${basePrice.toFixed(2)} MXN`,
              });
            }
          } else if (activeStay.tolerance_type === 'PERSON_LEFT') {
            const extraPrice = room.room_types.extra_person_price ?? 0;
            if (extraPrice > 0) {
              await updateSalesOrderTotals(supabase, activeStay.sales_order_id, extraPrice);
              toast.warning("Tolerancia expirada - Persona extra cobrada", {
                description: `Hab. ${room.number}: +$${extraPrice.toFixed(2)} MXN`,
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

        // Limpiar tolerancia
        await supabase
          .from("room_stays")
          .update({
            current_people: newCurrentPeople,
            total_people: newTotalPeople,
            tolerance_started_at: null,
            tolerance_type: null,
          })
          .eq("id", activeStay.id);
      } else {
        // Persona nueva entrando
        // Cobrar extra si:
        // 1. current_people > 2 (más de 2 personas actuales), O
        // 2. total_people >= 2 (ya pasaron 2 personas diferentes, cualquier nueva es extra)
        const previousTotalPeople = activeStay.total_people ?? current;
        const shouldChargeExtra = newCurrentPeople > 2 || previousTotalPeople >= 2;

        await supabase
          .from("room_stays")
          .update({
            current_people: newCurrentPeople,
            total_people: newTotalPeople,
          })
          .eq("id", activeStay.id);

        if (shouldChargeExtra) {
          const extraPrice = room.room_types.extra_person_price ?? 0;
          if (extraPrice > 0) {
            await updateSalesOrderTotals(supabase, activeStay.sales_order_id, extraPrice);
            toast.success("Persona extra registrada", {
              description: `Hab. ${room.number}: ${newCurrentPeople} personas (histórico: ${newTotalPeople}). +$${extraPrice.toFixed(2)} MXN`,
            });
          } else {
            toast.warning("No se configuró precio de persona extra");
          }
        } else {
          toast.success("Persona agregada", {
            description: `Hab. ${room.number}: ${newCurrentPeople} personas`,
          });
        }
      }

      await onRefresh();
    } catch (error) {
      console.error("Error adding person:", error);
      toast.error("Error al agregar persona");
    } finally {
      setActionLoading(false);
    }
  };

  // Quitar persona (se fue definitivamente, sin tolerancia)
  const handleRemovePerson = async (room: Room) => {
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación");
      return;
    }

    const current = activeStay.current_people ?? 2;
    if (current <= 1) {
      toast.error("Debe haber al menos 1 persona en la habitación", {
        description: "Usa 'Salida' para hacer checkout si no queda nadie.",
      });
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      await supabase
        .from("room_stays")
        .update({ current_people: current - 1 })
        .eq("id", activeStay.id);

      toast.success("Persona removida", {
        description: `Hab. ${room.number}: ${current - 1} personas`,
      });

      await onRefresh();
    } catch (error) {
      console.error("Error removing person:", error);
      toast.error("Error al remover persona");
    } finally {
      setActionLoading(false);
    }
  };

  // Persona salió pero va a regresar (inicia tolerancia de 1 hora, solo motel)
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

    const current = activeStay.current_people ?? 2;
    if (current <= 0) {
      toast.error("No hay personas en la habitación");
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
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
      console.error("Error starting tolerance:", error);
      toast.error("Error al iniciar tolerancia");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddExtraHour = async (room: Room) => {
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

    setActionLoading(true);
    const supabase = createClient();

    try {
      const extraHourPrice = room.room_types.extra_hour_price;
      const result = await updateSalesOrderTotals(supabase, activeStay.sales_order_id, extraHourPrice);

      if (result.success) {
        toast.success("Hora extra agregada", {
          description: `Hab. ${room.number}: +${extraHourPrice.toFixed(2)} MXN`,
        });
        await onRefresh();
      } else {
        toast.error("No se pudo agregar la hora extra");
      }
    } catch (error) {
      console.error("Error adding extra hour:", error);
      toast.error("Error al agregar la hora extra");
    } finally {
      setActionLoading(false);
    }
  };

  const updateRoomStatus = async (
    room: Room,
    newStatus: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA",
    successMessage: string
  ) => {
    setActionLoading(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("rooms")
        .update({ status: newStatus })
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
    paymentMethod?: string
  ): Promise<boolean> => {
    setActionLoading(true);
    const supabase = createClient();

    try {
      const finalizeStay = async () => {
        const activeStay = getActiveStay(room);
        if (activeStay) {
          await supabase
            .from("room_stays")
            .update({
              status: "FINALIZADA",
              actual_check_out_at: new Date().toISOString(),
            })
            .eq("id", activeStay.id);
        }

        await supabase
          .from("rooms")
          .update({ status: "SUCIA" })
          .eq("id", room.id);

        const updateData: Record<string, any> = { status: "ENDED" };
        if (paymentMethod) {
          updateData.payment_method = paymentMethod;
        }
        await supabase
          .from("sales_orders")
          .update(updateData)
          .eq("id", checkoutInfo.salesOrderId);
      };

      if (checkoutInfo.remainingAmount <= 0 || amount <= 0) {
        await finalizeStay();
        toast.success("Check-out completado", {
          description: `Hab. ${room.number} → SUCIA`,
        });
      } else {
        // Actualizar método de pago antes de procesar
        if (paymentMethod) {
          await supabase
            .from("sales_orders")
            .update({ payment_method: paymentMethod })
            .eq("id", checkoutInfo.salesOrderId);
        }

        const { data, error } = await supabase.rpc("process_payment", {
          order_id: checkoutInfo.salesOrderId,
          payment_amount: amount,
        });

        if (error) {
          console.error("Error processing payment:", error);
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
          toast.success("Pago registrado", {
            description: `Saldo restante: ${remaining.toFixed(2)} MXN`,
          });
        }
      }

      await onRefresh();
      return true;
    } catch (error) {
      console.error("Error during checkout:", error);
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
    handleAddExtraHour,
    updateRoomStatus,
    prepareCheckout,
    processCheckout,
  };
}
