"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface UseValetInteractionProps {
  salesOrderId: string;
}

export function useValetInteraction({ salesOrderId }: UseValetInteractionProps) {
  const [valetPayments, setValetPayments] = useState<any[]>([]);
  const [valetReports, setValetReports] = useState<any[]>([]);
  const [corroboratedIds, setCorroboratedIds] = useState<Set<string>>(new Set());
  const [isWaitingForValet, setIsWaitingForValet] = useState(false);

  const fetchValetData = useCallback(async () => {
    if (!salesOrderId) return;
    try {
      const supabase = createClient();
      
      const { data: vPayments } = await supabase
        .from("valet_receipt_reports")
        .select("*")
        .eq("sales_order_id", salesOrderId);

      const { data: vReports } = await supabase
        .from("valet_servicing_reports")
        .select("*")
        .eq("sales_order_id", salesOrderId)
        .order("created_at", { ascending: false });

      setValetPayments(vPayments || []);
      setValetReports(vReports || []);

      const { data: stayData } = await supabase
        .from("room_stays")
        .select("status, checkout_payment_data")
        .eq("sales_order_id", salesOrderId)
        .maybeSingle();

      if (stayData) {
        const isWaiting = stayData.status === 'ACTIVA' && !stayData.checkout_payment_data;
        setIsWaitingForValet(isWaiting);
      } else {
        setIsWaitingForValet(false);
      }
    } catch (error) {
      console.error("Error fetching valet data:", error);
    }
  }, [salesOrderId]);

  const corroborateValetPayment = async (paymentIds: string[]) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("valet_receipt_reports") // Nota: En el original era payments, mantengo consistencia con el dominio
        .update({ is_corroborated: true, corroborated_at: new Date().toISOString() })
        .in("id", paymentIds);

      if (error) throw error;
      setCorroboratedIds(prev => {
        const next = new Set(prev);
        paymentIds.forEach(id => next.add(id));
        return next;
      });
      toast.success("Pago corroborado");
      fetchValetData();
    } catch (error) {
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
    fetchValetData,
    corroborateValetPayment,
    applyValetPaymentData,
    applyValetReportData,
    setCorroboratedIds
  };
}
