import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { VALET_CONCEPTS, CONCEPT_LABELS, VALET_TO_SYSTEM_MAP, OrderItem } from "@/components/sales/payment/payment-constants";

interface UseValetInteractionProps {
  salesOrderId: string;
  items?: OrderItem[];
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
        .eq("status", "COBRADO_POR_VALET")
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

          const isCheckInReport = uniqueConcepts.includes('ENTRADA') || uniqueConcepts.length === 0;

          reports.push({
            id: 'check-in-fixed',
            sales_order_id: salesOrderId,
            room_stay_id: stayData.id,
            amount: totalAmount,
            payment_method: cpdArray[0]?.method || cpdArray[0]?.paymentMethod || "EFECTIVO",
            itemIds: [],
            note: isCheckInReport ? "Datos registrados por Cochero en Recepción" : "Cobro especial informado por valet",
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
              reference: p.reference || ""
            }))
          });
        }
      }
        
        // Filter out stale reports
        const filteredReports = reports.filter(r => {
           if (r.isCheckIn) {
             return !items.some(i => i.concept_type === 'ROOM_BASE' && i.is_paid);
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
      const realIds = paymentIds.filter(id => id.includes('-') && id.length > 20 && !id.startsWith('check-in'));
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

      setValetPayments(prev => prev.map(vp => {
        if (paymentIds.includes(vp.id)) return { ...vp, confirmed_at: new Date().toISOString() };
        return vp;
      }));

      toast.success("Pago corroborado");
      if (realIds.length > 0) fetchValetData();
    } catch (error) {
      console.error("Error corroborating:", error);
      toast.error("Error al corroborar");
    }
  };

  return {
    valetPayments,
    valetReports,
    corroboratedIds,
    isWaitingForValet,
    waitingReason,
    fetchValetData,
    corroborateValetPayment,
    setCorroboratedIds
  };
}
