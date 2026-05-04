"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { OrderItem } from "@/components/sales/payment/payment-constants";
import { findActiveFlow, logFlowEvent } from "@/lib/flow-logger";

interface UsePaymentProcessingProps {
  salesOrderId: string;
  items: OrderItem[];
  selectedItems: Set<string>;
  discounts: Record<string, number>;
  onComplete?: () => void;
  onRefreshItems: () => void;
  roomNumber?: string;
}

export function usePaymentProcessing({
  salesOrderId,
  items,
  selectedItems,
  discounts,
  onComplete,
  onRefreshItems,
  roomNumber
}: UsePaymentProcessingProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>(createInitialPayment(0));
  const [tipAmount, setTipAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const processingLockRef = useRef(false);

  const selectedTotal = items
    .filter(i => selectedItems.has(i.id) && !i.is_paid)
    .reduce((sum, i) => sum + (i.total - (discounts[i.id] || 0)), 0);

  const pendingTotal = items
    .filter(i => !i.is_paid)
    .reduce((sum, i) => sum + (i.total - (discounts[i.id] || 0)), 0);

  const processPayment = async () => {
    if (processingLockRef.current) return; // Synchronous double-click guard
    const totalToPay = selectedTotal + tipAmount;
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    if (Math.abs(totalPayments - totalToPay) > 0.01) {
      toast.error(`Los pagos (${totalPayments}) no coinciden con el total (${totalToPay})`);
      return;
    }

    try {
      processingLockRef.current = true;
      setProcessing(true);
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user session");

      // Fetch employee profile to get the public UUID (employees.id)
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!employee) throw new Error("No employee profile found for this user");

      // 1. Marcar ítems seleccionados como pagados
      if (selectedItems.size > 0) {
        const itemIds = Array.from(selectedItems);
        const { error: itemsError } = await supabase
          .from("sales_order_items")
          .update({
            is_paid: true,
            paid_at: new Date().toISOString()
          })
          .in("id", itemIds);

        if (itemsError) throw itemsError;
      }

      // 1.5. Limpiar pagos PENDIENTE (ej. hora extra auto) para evitar duplicados
      // NOTA: Se hace ANTES de procesar pagos para no interferir con la cola del cochero
      await supabase
        .from("payments")
        .delete()
        .eq("sales_order_id", salesOrderId)
        .eq("status", "PENDIENTE");

      // 2. Obtener sesión activa de RECEPCIONISTA para enlazar el pago a la caja correcta
      const { data: session } = await supabase
        .from('shift_sessions')
        .select(`
          id,
          employees!shift_sessions_employee_id_fkey (
            role
          )
        `)
        .eq('employee_id', employee.id)
        .in('status', ['active', 'open'])
        .in('employees.role', ['receptionist', 'admin', 'manager'])
        .maybeSingle();

      // Fallback: if current user has no active shift, find any active reception shift
      let resolvedSession = session;
      if (!resolvedSession) {
        const { data: receptionSession } = await supabase
          .from('shift_sessions')
          .select('id, employees!inner(role)')
          .in('status', ['active', 'open'])
          .or('role.eq.receptionist,role.eq.admin,role.eq.manager', { foreignTable: 'employees' })
          .order('clock_in_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        resolvedSession = receptionSession;
      }
      
      // LOG DE AUDITORÍA: Inicio de proceso de pago
      await supabase.rpc('log_audit', {
        p_event_type: 'PAYMENT_PROCESSING_STARTED',
        p_entity_type: 'SALES_ORDER',
        p_entity_id: salesOrderId,
        p_action: 'UPDATE',
        p_description: `Inicio de procesamiento de ${payments.length} pago(s) para orden ${salesOrderId.slice(0, 8)}...`,
        p_metadata: {
          payment_count: payments.length,
          total_amount: payments.reduce((sum, p) => sum + p.amount, 0),
          employee_id: employee.id,
          session_id: resolvedSession?.id
        },
        p_severity: 'INFO'
      });

      // 3. FIX DUPLICACIÓN: Estrategia de COLA en lugar de match por method+amount
      // Obtenemos TODOS los pagos del cochero como una cola ordenada por fecha
      // Los consumimos secuencialmente, actualizándolos con los datos corregidos de recepción
      // Esto permite que recepción cambie método, monto, terminal, etc. sin crear duplicados
      const { data: existingPayments } = await supabase
        .from("payments")
        .select("id, amount, payment_method, status, shift_session_id, collected_at, collected_by")
        .eq("sales_order_id", salesOrderId)
        .in("status", ["COBRADO_POR_VALET", "CORROBORADO_RECEPCION"])
        .not("collected_by", "is", null)
        .order("created_at", { ascending: true });

      // Cola de pagos del cochero para consumir
      const valetPaymentQueue = [...(existingPayments || [])];
      const validPayments = payments.filter(p => p.amount > 0);
      
      console.log(`🔄 Procesando ${validPayments.length} pago(s) de recepción, ${valetPaymentQueue.length} pago(s) del cochero en cola`);

      for (const p of validPayments) {
        const existingPayment = valetPaymentQueue.shift(); // Tomar el primero de la cola
        
        if (existingPayment) {
          // ACTUALIZAR pago existente del cochero con datos corregidos de recepción
          // Esto permite corregir: método, monto, terminal, tarjeta, referencia
          const oldData = {
            status: existingPayment.status,
            amount: existingPayment.amount,
            payment_method: existingPayment.payment_method,
            shift_session_id: existingPayment.shift_session_id,
            collected_at: existingPayment.collected_at
          };
          
          const newData = {
            amount: p.amount,  // ← Monto corregido por recepción
            payment_method: p.method,  // ← Método corregido por recepción
            status: "PAGADO",
            confirmed_at: new Date().toISOString(),
            confirmed_by: employee.id,
            shift_session_id: resolvedSession?.id || null,
            collected_at: new Date().toISOString(),
            terminal_code: p.terminal || null,
            reference: p.reference || existingPayment.id, // Preservar referencia si no hay nueva
            card_last_4: p.cardLast4 || null,
            card_type: p.cardType || null,
            payment_type: validPayments.length > 1 ? "PARCIAL" : "COMPLETO"
          };
          
          const { error: updateError } = await supabase
            .from("payments")
            .update(newData)
            .eq("id", existingPayment.id);
            
          if (updateError) throw updateError;
          console.log(`✅ Pago del cochero ${existingPayment.id.slice(0,8)} actualizado con datos corregidos`);
          
          // LOG DE AUDITORÍA: Pago actualizado (corrección)
          try {
            await supabase.rpc('log_audit', {
              p_event_type: 'PAYMENT_CORRECTED',
              p_entity_type: 'PAYMENT',
              p_entity_id: existingPayment.id,
              p_action: 'UPDATE',
              p_old_data: oldData,
              p_new_data: newData,
              p_description: `Pago del cochero corregido por recepción: ${existingPayment.payment_method}→${p.method}, $${existingPayment.amount}→$${p.amount}`,
              p_metadata: {
                original_collected_by: existingPayment.collected_by,
                corrected_by: employee.id,
                old_session: existingPayment.shift_session_id,
                new_session: resolvedSession?.id
              },
              p_severity: 'INFO'
            });
          } catch (auditErr) {
            console.warn("Audit log failed (non-blocking):", auditErr);
          }
          
        } else {
          // No hay más pagos del cochero en la cola → INSERTAR nuevo pago
          const insertData = {
            sales_order_id: salesOrderId,
            amount: p.amount,
            payment_method: p.method,
            card_last_4: p.cardLast4 || null,
            card_type: p.cardType || null,
            terminal_code: p.terminal || null,
            reference: p.reference || `PAGO-${Date.now().toString(36).toUpperCase()}`,
            concept: "PAGO_POR_CONCEPTOS",
            status: "PAGADO",
            payment_type: validPayments.length > 1 ? "PARCIAL" : "COMPLETO",
            created_by: user.id,
            shift_session_id: resolvedSession?.id || null,
            collected_at: new Date().toISOString(),
            collected_by: p.collected_by || null
          };
          
          const { error: payError } = await supabase.from("payments").insert(insertData);
          if (payError) throw payError;
          console.log('✅ Nuevo pago insertado (sin pago previo del cochero)');
        }
      }

      // 3.5. Si sobran pagos del cochero (recepción envió menos pagos que el cochero)
      // Marcarlos como PAGADO para que no queden huérfanos
      if (valetPaymentQueue.length > 0) {
        console.log(`⚠️ ${valetPaymentQueue.length} pago(s) sobrantes del cochero → marcando como PAGADO`);
        for (const remaining of valetPaymentQueue) {
          const { error: remainingError } = await supabase
            .from("payments")
            .update({
              status: "PAGADO",
              confirmed_at: new Date().toISOString(),
              confirmed_by: employee.id,
              shift_session_id: resolvedSession?.id || null
            })
            .eq("id", remaining.id);
          
          if (remainingError) {
            console.error(`Error updating remaining valet payment ${remaining.id}:`, remainingError);
            // No lanzamos error - anti-bloqueo: mejor dejar como PAGADO que bloquear el flujo
          }
        }
      }

      // 4. Si hay propina, insertarla
      if (tipAmount > 0) {
         await supabase.from("payments").insert({
            sales_order_id: salesOrderId,
            amount: tipAmount,
            payment_method: payments[0]?.method || "EFECTIVO", // Asumir el método principal
            concept: "PROPINA",
            status: "PAGADO",
            created_by: user.id,
            shift_session_id: resolvedSession?.id || null,
            collected_at: new Date().toISOString()
         });
      }

      // 5. Actualizar los totales del sales_order principal
      const { data: order } = await supabase
        .from("sales_orders")
        .select("total, paid_amount")
        .eq("id", salesOrderId)
        .single();

      if (order) {
        const newPaidAmount = Number(order.paid_amount || 0) + selectedTotal; // No sumar propina al paid_amount de la orden (normalmente la propina es aparte)
        const newRemaining = Math.max(0, Number(order.total || 0) - newPaidAmount);

        const { error: orderError } = await supabase
          .from("sales_orders")
          .update({
            paid_amount: newPaidAmount,
            remaining_amount: newRemaining,
            status: newRemaining <= 0 ? "PAID" : "PARTIAL"
          })
          .eq("id", salesOrderId);
          
        if (orderError) throw orderError;
      }

      // 6. Sincronizar items de venta con los pagos reales
      const { data: syncResult, error: syncError } = await supabase.rpc('sync_payment_items', {
          p_sales_order_id: salesOrderId,
          p_employee_id: employee.id
      });

      if (syncError) {
          console.warn('Error syncing payment items:', syncError);
      } else if (syncResult?.success) {
          console.log('Payment items synced:', syncResult);
      }

      // 7. Limpiar datos de cobro del valet (checkout_payment_data) para que no reaparezcan
      await supabase
        .from("room_stays")
        .update({ checkout_payment_data: null })
        .eq("sales_order_id", salesOrderId);

      // 8. Si la habitación estaba bloqueada (por hora extra o similar), devolver a OCUPADA
      // Mejor obtenemos el room_id directamente de la estancia vinculada a la orden
      const { data: stayData } = await supabase
        .from("room_stays")
        .select("room_id")
        .eq("sales_order_id", salesOrderId)
        .single();

      if (stayData?.room_id) {
        const { data: roomData } = await supabase
          .from("rooms")
          .select("status")
          .eq("id", stayData.room_id)
          .single();

        if (roomData?.status === "BLOQUEADA") {
          await supabase
            .from("rooms")
            .update({ status: "OCUPADA" })
            .eq("id", stayData.room_id);
        }
      }

      toast.success("Pago procesado correctamente");

      // ─── Flow Event ─────────────────────────────────────────────
      try {
        const { data: stayForFlow } = await supabase
          .from("room_stays")
          .select("id")
          .eq("sales_order_id", salesOrderId)
          .eq("status", "ACTIVA")
          .maybeSingle();
        if (stayForFlow) {
          findActiveFlow(stayForFlow.id).then(flowId => {
            if (flowId) {
              logFlowEvent(flowId, {
                event_type: "PAYMENT_CONFIRMED",
                description: `Pago procesado por recepción: $${selectedTotal.toFixed(2)} (${payments.map(p => p.method).join(', ')})`,
                metadata: {
                  amount: selectedTotal,
                  payment_count: payments.filter(p => p.amount > 0).length,
                  methods: payments.filter(p => p.amount > 0).map(p => ({ method: p.method, amount: p.amount })),
                  tip: tipAmount > 0 ? tipAmount : undefined,
                },
              });
            }
          });
        }
      } catch (flowErr) {
        console.error("[flow-logger] payment:", flowErr);
      }

      // Imprimir comprobante de pago (fire-and-forget)
      try {
        const PRINT_SERVER_URL = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';
        const conceptLabels: Record<string, string> = {
          ROOM_BASE: 'Habitación', EXTRA_HOUR: 'Hora Extra', EXTRA_PERSON: 'Persona Extra',
          CONSUMPTION: 'Consumo', PRODUCT: 'Producto', RENEWAL: 'Renovación',
        };
        const paidItems = items
          .filter(i => selectedItems.has(i.id) && !i.is_paid)
          .map(i => ({
            name: i.products?.name || conceptLabels[i.concept_type] || i.concept_type,
            qty: i.qty || 1,
            total: i.total - (discounts[i.id] || 0)
          }));
        const methodsSummary = validPayments.map(p => p.method).join(', ');

        // Desglose detallado de pagos para el ticket
        const paymentDetails = validPayments.map(p => ({
          method: p.method,
          amount: p.amount,
          terminal: p.terminal || undefined,
          cardLast4: p.cardLast4 || undefined,
          cardType: p.cardType || undefined,
          reference: p.reference || undefined,
        }));

        fetch(`${PRINT_SERVER_URL}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'payment',
            data: {
              roomNumber: roomNumber || undefined,
              date: new Date(),
              items: paidItems,
              total: selectedTotal,
              paymentMethod: methodsSummary,
              paymentDetails,
              tipAmount: tipAmount > 0 ? tipAmount : undefined,
              remainingAmount: order ? Math.max(0, Number(order.total || 0) - (Number(order.paid_amount || 0) + selectedTotal)) : undefined
            }
          })
        }).catch(err => console.error('Print payment ticket error (non-blocking):', err));
      } catch (printErr) {
        console.error('Error preparing payment print:', printErr);
      }

      setPayments(createInitialPayment(0));
      setTipAmount(0);
      onRefreshItems();
      onComplete?.();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Error al procesar el pago");
    } finally {
      setProcessing(false);
      processingLockRef.current = false;
    }
  };

  const getPaymentInfo = (item: OrderItem) => {
    if (!item.is_paid) return null;
    return {
      method: item.payment_method || "N/A",
      paidAt: item.paid_at
    };
  };

  return {
    payments,
    tipAmount,
    processing,
    selectedTotal,
    pendingTotal,
    processPayment,
    getPaymentInfo,
    setPayments,
    setTipAmount
  };
}
