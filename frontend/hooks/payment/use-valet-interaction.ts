"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface UseValetInteractionProps {
  salesOrderId: string;
  items?: any[];
}

export function useValetInteraction({ salesOrderId, items = [] }: UseValetInteractionProps) {
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

      // Fetch real valet payments from the database (including PENDIENTE for auto-extra-hour)
      const { data: paymentsData } = await supabase
        .from("payments")
        .select(`
          *,
          employees (
            first_name,
            last_name
          )
        `)
        .eq("sales_order_id", salesOrderId)
        .in("status", ["COBRADO_POR_VALET", "PENDIENTE"])
        .is("confirmed_at", null);

      if (stayData || (paymentsData && paymentsData.length > 0)) {
        // ¿Está el cochero llenando el formulario de cobro apenas?
        // RELAX: Si ya hay items cargados (ej. hora extra auto), no bloqueamos con el view de espera
        const hasExtraHour = items.some(i => i.concept_type === 'EXTRA_HOUR');
        const hasOrderItems = items && items.length > 0;
        
        // No esperamos al valet si ya hay una hora extra o consumos que cobrar
        const isWaiting = stayData?.status === 'ACTIVA' && !stayData?.checkout_payment_data && !hasOrderItems && !hasExtraHour;
        const hasPendingValetItems = items.some(i => !i.is_paid && i.delivery_status === 'pending_delivery');
        
        setIsWaitingForValet(isWaiting || (hasPendingValetItems && !hasOrderItems));
        setWaitingReason(hasPendingValetItems ? 'items' : isWaiting ? 'check-in' : null);

        // Si ya hay datos de cobro enviados por el cochero, los transformamos al reporte visual
        if (stayData.checkout_payment_data && Array.isArray(stayData.checkout_payment_data)) {
          const cpdArray = stayData.checkout_payment_data as any[];
          const totalAmount = cpdArray.reduce((sum, p) => sum + Number(p.amount || 0), 0);
          
          const conceptLabels: Record<string, string> = {
             'ENTRADA': 'Cobro de Habitación (Entrada)',
             'EXTRA_HOUR': 'Cobro de Hora Extra',
             'EXTRA_PERSON': 'Cobro de Persona Extra',
             'DAMAGE_CHARGE': 'Cargo por Daños',
             'PAGO_POR_CONCEPTOS': 'Cobro de Conceptos Varios'
          };

          const uniqueConcepts = Array.from(new Set(cpdArray.map(p => p.concept).filter(Boolean)));
          const itemDescription = uniqueConcepts.length > 0 
            ? uniqueConcepts.map(c => conceptLabels[c as string] || `Cobro de ${c}`)
            : ['Cobro de Habitación (Entrada)'];

          const isCheckInReport = uniqueConcepts.includes('ENTRADA') || uniqueConcepts.length === 0;

          // Construimos un "reporte" virtual tal cual lo espera el UI "ValetReportsSection"
          const report = {
            id: 'check-in-fixed', // pseudo-id
            sales_order_id: salesOrderId,
            room_stay_id: stayData.id,
            amount: totalAmount,
            total_amount: totalAmount,
            tip_amount: 0, 
            payment_amount: totalAmount,
            payment_method: cpdArray[0]?.method || "EFECTIVO",
            itemIds: [], // Aplica a toda la cuenta
            note: isCheckInReport ? "Datos registrados por Cochero en Recepción" : "Cobro especial informado por valet",
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            isCheckIn: isCheckInReport, 
            valetName: "Cochero en Turno",
            itemDescription: itemDescription,
            payments: cpdArray.map((p: any) => ({
              amount: Number(p.amount) || 0,
              method: p.method || "EFECTIVO",
              card_type: p.cardType || "",
              card_last_4: p.cardLast4 || "",
              terminal_code: p.terminal || "",
              reference: p.reference || ""
            }))
          };

          // Filtrar el reporte si el concepto ya está pagado
          const isStale = isCheckInReport && items.some(i => i.concept_type === 'ROOM_BASE' && i.is_paid);
          
          if (!isStale) {
            setValetReports([report]);
          } else {
            setValetReports([]);
          }
        } else if (stayData.checkout_payment_data) {
          // Fallback en caso de que guardaron un objeto en vez de arreglo
          const cpd = stayData.checkout_payment_data as any;
          const report = {
            id: 'check-in-fixed',
            sales_order_id: salesOrderId,
            room_stay_id: stayData.id,
            amount: cpd.totalAmount || 0,
            total_amount: cpd.totalAmount || 0,
            tip_amount: cpd.tipAmount || 0,
            payment_amount: cpd.totalAmount || 0,
            payment_method: cpd.paymentMethod || "EFECTIVO",
            itemIds: cpd.itemIds || [],
            note: "Datos registrados por Cochero en Recepción",
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            isCheckIn: true, // Forzar a true para diseño verde de entrada 
            valetName: "Cochero en Turno",
            itemDescription: ["Cobro de Habitación (Entrada)"],
            payments: cpd.payments || [{
              amount: cpd.totalAmount || 0,
              method: cpd.paymentMethod || "EFECTIVO",
              card_type: cpd.cardType || "",
              card_last_4: cpd.cardLast4 || "",
              terminal_code: cpd.terminal || ""
            }]
          };

          if (report.tip_amount) report.payments[0].tipAmount = report.tip_amount;
          
          const isStale = items.some(i => i.concept_type === 'ROOM_BASE' && i.is_paid);
          if (!isStale) {
            setValetReports([report]);
          } else {
            setValetReports([]);
          }
        } else {
           setValetReports([]);
        }

        // Set valetPayments only from REAL database records to avoid duplication
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

  const corroborateValetPayment = async (paymentIds: string[]) => {
    try {
      // Filtrar IDs que son UUIDs reales para la base de datos
      const realIds = paymentIds.filter(id => id.includes('-') && id.length > 20 && !id.startsWith('check-in') && !id.startsWith('report-'));
      
      if (realIds.length > 0) {
        const supabase = createClient();
        const { error } = await supabase
          .from("valet_receipt_reports")
          .update({ is_corroborated: true, corroborated_at: new Date().toISOString() })
          .in("id", realIds);

        if (error) throw error;
      }

      setCorroboratedIds(prev => {
        const next = new Set(prev);
        paymentIds.forEach(id => next.add(id));
        return next;
      });

      // Update valetPayments visually so OrderItemsList unlocks
      setValetPayments(prev => prev.map(vp => {
        if (paymentIds.includes(vp.id) || paymentIds.some(pid => vp.id.includes(pid))) {
           return { ...vp, confirmed_at: new Date().toISOString() };
        }
        return vp;
      }));

      toast.success("Pago corroborado");
      if (realIds.length > 0) {
        fetchValetData();
      }
    } catch (error) {
      console.error("Error corroborating:", error);
      toast.error("Error al corroborar");
    }
  };

  const applyValetPaymentData = (report: any) => {
    // Bridge for UI callback
  };

  const applyValetReportData = (report: any) => {
    // Bridge for UI callback
  };

  return {
    valetPayments,
    valetReports,
    corroboratedIds,
    isWaitingForValet,
    waitingReason,
    fetchValetData,
    corroborateValetPayment,
    applyValetPaymentData,
    applyValetReportData,
    setCorroboratedIds
  };
}
