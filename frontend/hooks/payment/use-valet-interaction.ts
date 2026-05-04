import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { VALET_CONCEPTS, CONCEPT_LABELS, VALET_TO_SYSTEM_MAP, OrderItem } from "@/components/sales/payment/payment-constants";
import { findActiveFlow, logFlowEvent } from "@/lib/flow-logger";

interface UseValetInteractionProps {
  salesOrderId: string;
  items?: OrderItem[];
  employeeId?: string | null;
}

export function useValetInteraction({ salesOrderId, items = [], employeeId }: UseValetInteractionProps) {
  const [valetPayments, setValetPayments] = useState<any[]>([]);
  const [valetReports, setValetReports] = useState<any[]>([]);
  const [corroboratedIds, setCorroboratedIds] = useState<Set<string>>(new Set());
  const [isWaitingForValet, setIsWaitingForValet] = useState(false);
  const [waitingReason, setWaitingReason] = useState<'check-in' | 'items' | null>(null);

  const fetchValetData = useCallback(async () => {
    if (!salesOrderId) return;
    try {
      const supabase = createClient();
      
      const { data: stayData } = await supabase
        .from("room_stays")
        .select("status, checkout_payment_data, id")
        .eq("sales_order_id", salesOrderId)
        .maybeSingle();

      const { data: paymentsData } = await supabase
        .from("payments")
        .select(`
          *,
          employees!payments_collected_by_fkey (
            first_name,
            last_name
          )
        `)
        .eq("sales_order_id", salesOrderId)
        .in("status", ["COBRADO_POR_VALET", "CORROBORADO_RECEPCION"])
        .not("collected_by", "is", null);

      if (stayData || (paymentsData && paymentsData.length > 0)) {
        const hasValetConcept = items.some(i => VALET_CONCEPTS.includes(i.concept_type || ''));
        const hasOrderItems = items && items.length > 0;
        
        const isWaiting = stayData?.status === 'ACTIVA' && !stayData?.checkout_payment_data && !hasOrderItems && !hasValetConcept;
        const hasPendingValetItems = items.some(i => !i.is_paid && i.delivery_status === 'pending_delivery');
        
        setIsWaitingForValet(isWaiting || (hasPendingValetItems && !hasOrderItems));
        setWaitingReason(hasPendingValetItems ? 'items' : isWaiting ? 'check-in' : null);

        // Process checkout_payment_data into a report
        const reports: any[] = [];
        if (stayData?.checkout_payment_data) {
          const cpdRaw = stayData.checkout_payment_data;
          const cpdArray = Array.isArray(cpdRaw) ? cpdRaw : [cpdRaw];
          const totalAmount = cpdArray.reduce((sum, p) => sum + Number(p.amount || p.totalAmount || 0), 0);
          
          if (totalAmount > 0) {
            const uniqueConcepts = Array.from(new Set(cpdArray.map(p => p.concept || p.concept_type).filter(Boolean)));
            const itemDescription = uniqueConcepts.length > 0 
              ? uniqueConcepts.map(c => CONCEPT_LABELS[c as string] || `Cobro de ${c}`)
              : ['Cobro de Habitación (Entrada)'];

          const isCheckInReport = uniqueConcepts.some(c => ['ENTRADA', 'ESTANCIA', 'STAY'].includes(c as string)) || 
                                  uniqueConcepts.length === 0;

          reports.push({
            id: 'check-in-fixed',
            sales_order_id: salesOrderId,
            room_stay_id: stayData.id,
            amount: totalAmount,
            payment_method: cpdArray[0]?.method || cpdArray[0]?.paymentMethod || "EFECTIVO",
            itemIds: [],
            note: isCheckInReport ? "Datos registrados por Cochero en Recepción" : "Cobro especial informado por cochero",
            timestamp: new Date().toISOString(),
            isCheckIn: isCheckInReport, 
            valetName: "Cochero en Turno",
            itemDescription,
            payments: cpdArray.map((p: any) => ({
              amount: Number(p.amount || p.totalAmount) || 0,
              method: p.method || p.paymentMethod || "EFECTIVO",
              card_type: p.cardType || "",
              card_last_4: p.cardLast4 || "",
              terminal_code: p.terminal || "",
              reference: p.reference || "",
              concept: p.concept || p.concept_type // Mantener concepto original
            }))
          });
        }
      }
        
        // Filter out stale reports: If all items related to this report are paid, hide it
        const filteredReports = reports.filter(r => {
            // For check-in reports, hide if the main ROOM_BASE is paid
            if (r.isCheckIn) {
              return !items.some(i => (i.concept_type === 'ROOM_BASE' || i.concept_type === 'STAY') && i.is_paid);
            }

            // For specific reports, check if the items they mention are paid
            if (r.payments && r.payments.length > 0) {
              const reportConcepts = r.payments.map((p: any) => p.concept).filter(Boolean);
              if (reportConcepts.length > 0) {
                // Find items on order that match these concepts
                const relatedUnpaidItems = items.filter(item => {
                  if (item.is_paid) return false;
                  // Map valet concept to system concept
                  return reportConcepts.some((rc: string) => {
                    const mapped = VALET_TO_SYSTEM_MAP[rc] || [rc];
                    return mapped.includes(item.concept_type);
                  });
                });
                // If there are NO unpaid items related to this report's concepts, hide the report
                return relatedUnpaidItems.length > 0;
              }
            }
            return true;
        });

        setValetReports(filteredReports);
        setValetPayments(paymentsData || []);
      } else {
        setIsWaitingForValet(false);
        setValetReports([]);
        setValetPayments([]);
      }
    } catch (error) {
      console.error("Error fetching valet data:", error);
    }
  }, [salesOrderId, items]);

  useEffect(() => {
    fetchValetData();
  }, [fetchValetData]);

  const corroborateValetPayment = async (paymentIds: string[]) => {
    try {
      const supabase = createClient();
      
      const realIds = paymentIds.filter(id => id.includes('-') && id.length > 20 && !id.startsWith('check-in'));
      
      // Update real payments in payments table
      if (realIds.length > 0) {
        const { error } = await supabase
          .from("payments")
          .update({ 
            status: 'CORROBORADO_RECEPCION', // Status intermedio: recepcionista corroboró pero no ha procesado pago
            confirmed_at: new Date().toISOString(),
            confirmed_by: employeeId // From props
          })
          .in("id", realIds);
        if (error) throw error;
      }

      // Handle virtual report check-in-fixed
      if (paymentIds.includes('check-in-fixed')) {
          // Find if there are any ENTRADA payments recorded by valet for this order
          const { error } = await supabase
            .from("payments")
            .update({ 
                status: 'CORROBORADO_RECEPCION', // Status intermedio
                confirmed_at: new Date().toISOString(),
                confirmed_by: employeeId
            })
            .eq("sales_order_id", salesOrderId)
            .eq("status", "COBRADO_POR_VALET")
            .not("collected_by", "is", null);
          
          if (error) console.error("Error corroborating virtual report payments:", error);
      }

      setCorroboratedIds(prev => {
        const next = new Set(prev);
        paymentIds.forEach(id => next.add(id));
        return next;
      });

      setValetPayments(prev => prev.map(vp => {
        if (paymentIds.includes(vp.id)) return { ...vp, confirmed_at: new Date().toISOString() };
        return vp;
      }));

      toast.success("Pago corroborado");

      // ─── Flow Event ─────────────────────────────────────────────
      try {
        const supabase2 = createClient();
        const { data: stayForFlow } = await supabase2
          .from("room_stays")
          .select("id")
          .eq("sales_order_id", salesOrderId)
          .eq("status", "ACTIVA")
          .maybeSingle();
        if (stayForFlow) {
          findActiveFlow(stayForFlow.id).then(flowId => {
            if (flowId) {
              logFlowEvent(flowId, {
                event_type: "PAYMENT_CORROBORATED",
                description: `Pago del cochero corroborado por recepción`,
                metadata: { payment_ids: paymentIds },
              });
            }
          });
        }
      } catch (flowErr) {
        console.error("[flow-logger] corroborate:", flowErr);
      }

      fetchValetData();
    } catch (error) {
      console.error("Error corroborating:", error);
      toast.error("Error al corroborar");
    }
  };


  // Función para aplicar datos de pagos de cochero al formulario
  const applyValetPaymentData = (reports: any[]) => {
    console.log('🔍 FRONTEND DEBUG: applyValetPaymentData llamado');
    console.log('  - Reports recibidos:', reports.length);
    reports.forEach((r, i) => {
      console.log(`  - Report ${i}: collected_by=${r.collected_by}, id=${r.id}`);
    });
    
    if (!reports || reports.length === 0) return;
    const newPayments = reports.map((p: any, i: number) => ({
      id: Date.now().toString() + i,
      amount: Number(p.amount),
      method: p.payment_method || p.method || "EFECTIVO",
      cardLast4: p.card_last_4 || p.cardLast4 || undefined,
      cardType: p.card_type || p.cardType || undefined,
      terminal: p.terminal_code || p.terminal || undefined,
      reference: p.reference || "VALET-HISTORICO",
      // PRESERVAR collected_by del pago original del cochero
      collected_by: p.collected_by,
      original_payment_id: p.id // Guardar referencia al pago original
    }));
    
    console.log('🔍 FRONTEND DEBUG: Nuevos payments creados:');
    newPayments.forEach((p, i) => {
      console.log(`  - New Payment ${i}: collected_by=${p.collected_by}, original_id=${p.original_payment_id}`);
    });
    
    // Esta función necesita ser manejada por el componente que usa el hook
    // Por ahora solo retornamos los datos procesados
    return newPayments;
  };

  // Función para aplicar datos de reporte de cochero
  const applyValetReportData = (report: any) => {
    if (!report || !report.payments) return;
    const newPayments = report.payments.map((p: any, i: number) => ({
      id: Date.now().toString() + i,
      amount: Number(p.amount),
      method: p.method || "EFECTIVO",
      cardLast4: p.card_last_4 || undefined,
      cardType: p.card_type || undefined,
      terminal: p.terminal_code || undefined,
      reference: p.reference || "VALET-REPORTE",
      // PRESERVAR collected_by del pago original del cochero
      collected_by: p.collected_by,
      original_payment_id: p.id // Guardar referencia al pago original
    }));
    
    // Esta función necesita ser manejada por el componente que usa el hook
    // Por ahora solo retornamos los datos procesados
    return { payments: newPayments, tip_amount: report.tip_amount };
  };

  return {
    valetPayments,
    valetReports,
    corroboratedIds,
    isWaitingForValet,
    waitingReason,
    fetchValetData,
    corroborateValetPayment,
    setCorroboratedIds,
    applyValetPaymentData,
    applyValetReportData
  };
}
