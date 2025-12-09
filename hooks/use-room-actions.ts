"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room, RoomStay } from "@/components/sales/room-types";

// Helper para obtener la estancia activa
export function getActiveStay(room: Room): RoomStay | null {
  return (room.room_stays || []).find((stay) => stay.status === "ACTIVA") || null;
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
  handleChangePeople: (room: Room, delta: 1 | -1) => Promise<void>;
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
    amount: number
  ) => Promise<boolean>;
}

export function useRoomActions(onRefresh: () => Promise<void>): UseRoomActionsReturn {
  const [actionLoading, setActionLoading] = useState(false);

  const handleChangePeople = async (room: Room, delta: 1 | -1) => {
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación", {
        description: "Revisa la tabla room_stays: no hay registro ACTIVA vinculado.",
      });
      return;
    }

    if (!room.room_types) {
      toast.error("No se encontró el tipo de habitación", {
        description: "Verifica la relación room_type_id para esta habitación.",
      });
      return;
    }

    const maxPeople = room.room_types.max_people ?? 2;
    const current = activeStay.current_people ?? 2;
    const next = current + delta;

    if (next < 1) {
      toast.error("No puede haber menos de 1 persona en la habitación");
      return;
    }

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

      const { error: stayError } = await supabase
        .from("room_stays")
        .update({
          current_people: newCurrentPeople,
          total_people: newTotalPeople,
        })
        .eq("id", activeStay.id);

      if (stayError) {
        console.error("Error updating people count:", stayError);
        toast.error("No se pudo actualizar el número de personas");
        return;
      }

      // Cobrar persona extra si aplica
      if (delta === 1 && newCurrentPeople > 2) {
        const extraPrice = room.room_types.extra_person_price ?? 0;

        if (extraPrice <= 0) {
          toast.warning("No se configuró el precio de persona extra", {
            description: `Tipo: ${room.room_types.name}`,
          });
        } else {
          const result = await updateSalesOrderTotals(supabase, activeStay.sales_order_id, extraPrice);
          if (result.success) {
            toast.success("Persona extra registrada", {
              description: `Hab. ${room.number}: ${newCurrentPeople} personas. +${extraPrice.toFixed(2)} MXN`,
            });
          } else {
            toast.error("No se pudo actualizar el saldo por persona extra");
          }
        }
      } else {
        toast.success("Personas actualizadas", {
          description: `Hab. ${room.number}: ${newCurrentPeople} personas.`,
        });
      }

      await onRefresh();
    } catch (error) {
      console.error("Error updating people:", error);
      toast.error("Error al actualizar las personas");
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
    amount: number
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

        await supabase
          .from("sales_orders")
          .update({ status: "ENDED" })
          .eq("id", checkoutInfo.salesOrderId);
      };

      if (checkoutInfo.remainingAmount <= 0 || amount <= 0) {
        await finalizeStay();
        toast.success("Check-out completado", {
          description: `Hab. ${room.number} → SUCIA`,
        });
      } else {
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
    handleChangePeople,
    handleAddExtraHour,
    updateRoomStatus,
    prepareCheckout,
    processCheckout,
  };
}
