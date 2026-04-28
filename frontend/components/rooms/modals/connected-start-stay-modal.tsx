"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Room, RoomType } from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import {
  VehicleInfo,
  RoomStartStayModal,
} from "@/components/sales/room-start-stay-modal";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";
import {
  useRoomActions,
  getReceptionShiftId,
  getReceptionEmployeeId,
  generatePaymentReference,
  getActiveStay,
} from "@/hooks/use-room-actions";

export const calculateExpectedCheckout = (
  roomType: RoomType,
  durationNights: number = 1
) => {
  const now = new Date();

  if (roomType.is_hotel) {
    // Hotel (Torre): check-out siempre a las 12 pm según las noches seleccionadas
    const checkout = new Date(now);
    checkout.setDate(checkout.getDate() + durationNights);
    checkout.setHours(12, 0, 0, 0);
    return checkout;
  }

  // Motel: Determinar si estamos en período de fin de semana o entre semana
  // Fin de semana: Viernes 6:00 AM - Domingo 6:00 AM (8 horas)
  // Entre semana: Domingo 6:00 AM - Viernes 6:00 AM (12 horas)
  const day = now.getDay(); // 0=Domingo, 1=Lunes, ..., 5=Viernes, 6=Sábado
  const hour = now.getHours(); // 0-23

  let isWeekendPeriod = false;

  if (day === 5 && hour >= 6) {
    // Viernes desde las 6:00 AM en adelante
    isWeekendPeriod = true;
  } else if (day === 6) {
    // Todo el sábado
    isWeekendPeriod = true;
  } else if (day === 0 && hour < 6) {
    // Domingo antes de las 6:00 AM
    isWeekendPeriod = true;
  }

  const hours = isWeekendPeriod
    ? roomType.weekend_hours ?? 8
    : roomType.weekday_hours ?? 12;

  const checkout = new Date(now);
  checkout.setHours(checkout.getHours() + hours);
  return checkout;
};

export const formatDateTime = (date: Date) => {
  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface ConnectedStartStayModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectedStartStayModal({
  room,
  isOpen,
  onClose,
  onSuccess,
}: ConnectedStartStayModalProps) {
  const [startStayLoading, setStartStayLoading] = useState(false);
  const { printEntryTicket } = useThermalPrinter();

  const handleStartStay = async (
    initialPeople: number,
    payments: PaymentEntry[],
    vehicle: VehicleInfo,
    durationNights: number = 1
  ) => {
    if (!room || !room.room_types) return;



    setStartStayLoading(true);
    const supabase = createClient();
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const methodsSummary = payments.map((p) => p.method).join(", ");

    try {
      const roomType = room.room_types;
      const now = new Date();

      let expectedCheckout = calculateExpectedCheckout(roomType);
      if (roomType.is_hotel) {
        expectedCheckout = new Date();
        expectedCheckout.setDate(expectedCheckout.getDate() + durationNights);
        expectedCheckout.setHours(12, 0, 0, 0);
      }

      const basePrice = roomType.base_price ?? 0;
      const extraPersonPrice = roomType.extra_person_price ?? 0;

      // Calcular costo extra por personas adicionales (más de 2)
      const extraPeopleCount = Math.max(0, initialPeople - 2);
      const extraPeopleCost = extraPeopleCount * extraPersonPrice;
      const totalPrice =
        (basePrice + extraPeopleCost) * (roomType.is_hotel ? durationNights : 1);

      // Obtener almacén específico para ventas de recepción (ALM002-R)
      const { data: defaultWarehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id, code, is_active")
        .eq("code", "ALM002-R")
        .eq("is_active", true)
        .single();

      if (warehouseError || !defaultWarehouse) {
        toast.error("No se encontró el almacén de recepción", {
          description:
            "Verifica que exista el almacén con código ALM002-R y esté activo.",
        });
        return;
      }

      // Obtener usuario actual (opcional, para created_by)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const currentShiftId = await getReceptionShiftId(supabase);
      const currentEmployeeId = await getReceptionEmployeeId(supabase);

      // FIX #1: Verificar que la habitación siga disponible antes de proceder
      const { data: currentRoomStatus, error: statusCheckError } =
        await supabase
          .from("rooms")
          .select("status")
          .eq("id", room.id)
          .single();

      if (statusCheckError || !currentRoomStatus) {
        toast.error("Error al verificar disponibilidad", {
          description: "No se pudo comprobar el estado actual de la habitación.",
        });
        return;
      }

      if (currentRoomStatus.status !== "LIBRE") {
        toast.error("Habitación no disponible", {
          description: `La habitación ${room.number} ya NO está disponible. Estado actual: ${currentRoomStatus.status}`,
        });
        return;
      }

      // Crear orden de venta básica para la estancia
      const { data: salesOrder, error: orderError } = await supabase
        .from("sales_orders")
        .insert({
          customer_id: null,
          warehouse_id: defaultWarehouse.id,
          currency: "MXN",
          notes: `Estancia ${roomType.name} Hab. ${
            room.number
          }${extraPeopleCount > 0 ? ` (+${extraPeopleCount} extra)` : ""} - Pago: ${methodsSummary}`,
          subtotal: totalPrice,
          tax: 0,
          total: totalPrice,
          status: "OPEN",
          remaining_amount: Math.max(0, totalPrice - totalPaid),
          paid_amount: totalPaid,
          created_by: user?.id ?? null,
          shift_session_id: currentShiftId,
        })
        .select("id")
        .single();

      if (orderError) {
        toast.error("Error al iniciar la estancia", {
          description: "No se pudo crear la orden de venta.",
        });
        return;
      }

      // Insertar items en sales_order_items para cobro granular
      let serviceProductId: string | null = null;
      const { data: serviceProducts } = await supabase
        .from("products")
        .select("id")
        .eq("sku", "SVC-ROOM")
        .limit(1);

      if (serviceProducts && serviceProducts.length > 0) {
        serviceProductId = serviceProducts[0].id;
      } else {
        const { data: newProduct, error: productError } = await supabase
          .from("products")
          .insert({
            name: "Servicio de Habitación",
            sku: "SVC-ROOM",
            description:
              "Servicios de habitación (estancia, horas extra, personas extra)",
            price: 0,
            cost: 0,
            unit: "SVC",
            min_stock: 0,
            is_active: true,
          })
          .select("id")
          .single();

        if (newProduct) {
          serviceProductId = newProduct.id;
        }
      }

      if (serviceProductId) {
        const orderItems = [];

        // Item de habitación base
        orderItems.push({
          sales_order_id: salesOrder.id,
          product_id: serviceProductId,
          qty: roomType.is_hotel ? durationNights : 1,
          unit_price: basePrice,
          concept_type: "ROOM_BASE",
          is_paid: totalPaid >= basePrice,
          paid_at: totalPaid >= basePrice ? new Date().toISOString() : null,
          payment_method:
            totalPaid >= basePrice
              ? payments.length === 1
                ? payments[0].method
                : "MIXTO"
              : null,
        });

        // Items de personas extra (si aplica)
        if (extraPeopleCount > 0 && extraPersonPrice > 0) {
          const qtyPerPerson = roomType.is_hotel ? durationNights : 1;
          for (let i = 0; i < extraPeopleCount; i++) {
            const itemTotal = basePrice + (i + 1) * extraPersonPrice;
            const isPaidUpToThis = totalPaid >= itemTotal;
            orderItems.push({
              sales_order_id: salesOrder.id,
              product_id: serviceProductId,
              qty: qtyPerPerson,
              unit_price: extraPersonPrice,
              concept_type: "EXTRA_PERSON",
              is_paid: isPaidUpToThis,
              paid_at: isPaidUpToThis ? new Date().toISOString() : null,
              payment_method: isPaidUpToThis
                ? payments.length === 1
                  ? payments[0].method
                  : "MIXTO"
                : null,
            });
          }
        }

        const { error: itemsError } = await supabase
          .from("sales_order_items")
          .insert(orderItems);
      }

      // Insertar cargo principal y subpagos si es multipago
      if (payments.length > 0) {
        const totalPaidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const validPayments = payments.filter((p) => p.amount > 0);
        const isMultipago = validPayments.length > 1;
        const isPagado = totalPaidAmount >= basePrice;

        if (isMultipago) {
          // MULTIPAGO: Crear cargo principal + subpagos
          const { data: mainPayment, error: mainError } = await supabase
            .from("payments")
            .insert({
              sales_order_id: salesOrder.id,
              amount: basePrice,
              payment_method: "PENDIENTE",
              reference: generatePaymentReference("EST"),
              concept: "ESTANCIA",
              status: isPagado ? "PAGADO" : "PENDIENTE",
              payment_type: "COMPLETO",
              created_by: user?.id ?? null,
              shift_session_id: currentShiftId,
              employee_id: currentEmployeeId,
            })
            .select("id")
            .single();

          if (mainPayment) {
            const subpayments = validPayments.map((p) => ({
              sales_order_id: salesOrder.id,
              amount: p.amount,
              payment_method: p.method,
              reference: p.reference || generatePaymentReference("SUB"),
              concept: "ESTANCIA",
              status: "PAGADO",
              payment_type: "PARCIAL",
              parent_payment_id: mainPayment.id,
              created_by: user?.id ?? null,
              shift_session_id: currentShiftId,
              employee_id: currentEmployeeId,
              terminal_code: p.method === "TARJETA" ? p.terminal : null,
              card_last_4: p.method === "TARJETA" ? p.cardLast4 : null,
              card_type: p.method === "TARJETA" ? p.cardType : null,
            }));

            await supabase.from("payments").insert(subpayments);
          }
        } else if (validPayments.length === 1) {
          // PAGO ÚNICO
          const p = validPayments[0];
          await supabase.from("payments").insert({
            sales_order_id: salesOrder.id,
            amount: p.amount,
            payment_method: p.method,
            reference: p.reference || generatePaymentReference("EST"),
            concept: "ESTANCIA",
            status: "PAGADO",
            payment_type: "COMPLETO",
            created_by: user?.id ?? null,
            shift_session_id: currentShiftId,
            employee_id: currentEmployeeId,
            terminal_code: p.method === "TARJETA" ? p.terminal : null,
            card_last_4: p.method === "TARJETA" ? p.cardLast4 : null,
            card_type: p.method === "TARJETA" ? p.cardType : null,
          });
        }
      }

      // Crear registro de estancia vinculado al turno
      const { data: stayData, error: stayError } = await supabase
        .from("room_stays")
        .insert({
          room_id: room.id,
          sales_order_id: salesOrder.id,
          check_in_at: now.toISOString(),
          expected_check_out_at: expectedCheckout.toISOString(),
          status: "ACTIVA",
          current_people: initialPeople,
          total_people: initialPeople,
          vehicle_plate: vehicle.plate || null,
          vehicle_brand: vehicle.brand || null,
          vehicle_model: vehicle.model || null,
          valet_employee_id: null,
          checkout_valet_employee_id: null,
          guest_access_token: crypto.randomUUID(),
          shift_session_id: currentShiftId,
        })
        .select()
        .single();

      if (stayError) {
        toast.error("Error al registrar la estancia", {
          description: "La orden se creó, pero hubo un problema registrando la estancia.",
        });
        return;
      }

      // Actualizar estado de la habitación a OCUPADA
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ status: "OCUPADA" })
        .eq("id", room.id);

      if (roomError) {
        toast.error("Error al actualizar la habitación", {
          description: "La estancia se creó, pero no se pudo actualizar el estado de la habitación.",
        });
        return;
      }

      toast.success("Estancia iniciada", {
        description: `Hab. ${room.number} - ${roomType.name} (${initialPeople} persona${
          initialPeople > 1 ? "s" : ""
        }) hasta ${formatDateTime(expectedCheckout)}${
          extraPeopleCost > 0 ? ` - Total: $${totalPrice.toFixed(2)}` : ""
        }`,
      });

      // Imprimir ticket de entrada
      try {
        const methodsSummaryLabel = payments.map((p) => p.method).join(", ");
        await printEntryTicket({
          roomNumber: room.number,
          roomTypeName: roomType.name,
          date: now,
          people: initialPeople,
          vehiclePlate: vehicle.plate || undefined,
          vehicleBrand: vehicle.brand || undefined,
          vehicleModel: vehicle.model || undefined,
          basePrice: basePrice,
          extraPeopleCount: extraPeopleCount > 0 ? extraPeopleCount : undefined,
          extraPeopleCost: extraPeopleCost > 0 ? extraPeopleCost : undefined,
          totalPrice: totalPrice,
          paymentMethod: methodsSummaryLabel || 'EFECTIVO',
          expectedCheckout: expectedCheckout,
        });
      } catch (printError) {
        console.error("Error printing entry ticket:", printError);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error starting stay:", error);
      toast.error("Error al iniciar la estancia", {
        description: "Ocurrió un error inesperado. Intenta nuevamente.",
      });
    } finally {
      setStartStayLoading(false);
    }
  };

  return (
    <RoomStartStayModal
      isOpen={isOpen && !!room}
      roomNumber={room?.number || ""}
      roomType={room?.room_types as RoomType}
      expectedCheckout={room?.room_types ? calculateExpectedCheckout(room.room_types) : new Date()}
      actionLoading={startStayLoading}
      onClose={onClose}
      onConfirm={handleStartStay}
    />
  );
}
