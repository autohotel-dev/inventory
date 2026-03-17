"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { CONCEPT_LABELS, OrderItem } from "./payment-constants";
import { formatCurrency } from "./utils";

interface HistoricalValetPaymentsSectionProps {
  valetPayments: any[];
  items: any[];
  selectedItems: Set<string>;
  corroboratedIds: Set<string>;
  confirmingPaymentId: string | null;
  onCorroborate: (paymentIds: string[]) => void;
  onApplyData: (payments: any[]) => void;
}

export function HistoricalValetPaymentsSection({
  valetPayments,
  items,
  selectedItems,
  corroboratedIds,
  confirmingPaymentId,
  onCorroborate,
  onApplyData,
}: HistoricalValetPaymentsSectionProps) {
  console.log("HistoricalValetPaymentsSection render:", { valetPayments, selectedItemsSize: selectedItems.size });
  if (valetPayments.length === 0) return null;

  const groupsMap = new Map<string, any>();
  valetPayments.forEach(p => {
    // Strict guard: only group payments actually collected by a valet
    if (!p.collected_by || p.status !== 'COBRADO_POR_VALET') return;

    const empKey = p.collected_by;
    const timeWindow = 1000 * 60 * 10;
    const timeKey = Math.floor(new Date(p.collected_at).getTime() / timeWindow);
    const key = `${empKey}-${timeKey}`;

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        payments: [],
        totalAmount: 0,
        employeeName: p.employees ? `${p.employees.first_name} ${p.employees.last_name}` : 'Desconocido',
        collectedAt: p.collected_at || p.created_at || new Date().toISOString()
      });
    }
    const group = groupsMap.get(key);
    group.payments.push(p);
    group.totalAmount += p.amount;
  });

  const visibleGroups = Array.from(groupsMap.values()).filter(group => {
    const selectedConcepts = new Set(
      Array.from(selectedItems)
        .map(id => items.find(i => i.id === id)?.concept_type)
        .filter(Boolean)
    );

    const conceptMapping: Record<string, string[]> = {
      'PERSONA_EXTRA': ['EXTRA_PERSON'],
      'EXTRA_PERSON': ['EXTRA_PERSON'],
      'HORA_EXTRA': ['EXTRA_HOUR'],
      'EXTRA_HOUR': ['EXTRA_HOUR'],
      'ESTANCIA': ['ROOM_BASE', 'STAY'],
      'ENTRADA': ['ROOM_BASE', 'STAY'],
      'TOLERANCIA_EXPIRADA': ['TOLERANCE_EXPIRED'],
      'DAMAGE_CHARGE': ['DAMAGE_CHARGE'],
      'DAÑO': ['DAMAGE_CHARGE'],
      'VALET_DAMAGE': ['DAMAGE_CHARGE'],
      'CONSUMO': ['CONSUMPTION', 'PRODUCT'],
      'RENEWAL': ['RENEWAL', 'STAY', 'EXTRA_HOUR'],
      'PRODUCT': ['PRODUCT']
    };

    // If we have selected items but couldn't identify their concepts, show all (safety)
    if (selectedConcepts.size === 0) return true;

    return group.payments.some((p: any) => {
      // If payment has no concept, show it when something is selected (safety)
      if (!p.concept) return true;

      const mapped = conceptMapping[p.concept] || [p.concept];
      const hasMatch = mapped.some(m => selectedConcepts.has(m));
      
      console.log(`Payment concept ${p.concept} mapped to ${mapped}. Selected concepts:`, Array.from(selectedConcepts), `Match: ${hasMatch}`);
      return hasMatch;
    });
  });

  console.log("Visible groups:", visibleGroups.length);
  if (visibleGroups.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 shadow-[0_0_15px_-5px_rgba(99,102,241,0.3)]">
        <AlertTriangle className="h-5 w-5" />
        <p className="text-xs font-bold uppercase tracking-wider">Información de cobros informados por Cochero</p>
      </div>

      <div className="space-y-2">
        {visibleGroups.map((group, groupIdx) => {
          const allCorroborated = group.payments.every((p: any) => p.confirmed_at || corroboratedIds.has(p.id));
          const reportDate = new Date(group.collectedAt);

          return (
            <div
              key={`group-${groupIdx}`}
              className="flex items-center justify-between p-4 border rounded-lg bg-zinc-900/50 border-indigo-500/10 hover:border-indigo-500/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1">
                    {group.payments.map((p: any) => (
                      <Badge key={p.id} variant="outline" className="border-indigo-500/50 text-indigo-400 bg-indigo-500/10 px-2 h-5 text-[10px]">
                        {p.payment_method} {formatCurrency(p.amount)}
                      </Badge>
                    ))}
                  </div>
                  <span className="font-bold text-2xl text-white">
                    {formatCurrency(group.totalAmount)}
                  </span>
                </div>
                <div className="w-px h-10 bg-zinc-800 mx-2" />
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(group.payments.map((p: any) => p.concept))).filter(c => !!c).map((concept: any) => {
                      const conceptStr = String(concept || 'PAGO');
                      const label = CONCEPT_LABELS[conceptStr] || conceptStr;
                      const isRenewal = conceptStr === 'RENEWAL' || conceptStr === 'STAY' || conceptStr === 'EXTRA_HOUR';
                      return (
                        <Badge key={`concept-${conceptStr}`} variant="secondary" className={cn("text-[10px] uppercase font-bold tracking-tighter py-0", isRenewal ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-zinc-800 text-zinc-300")}>
                          {isRenewal ? "RENOVACIÓN" : label}
                        </Badge>
                      );
                    })}
                  </div>
                  <span className="text-xs text-zinc-400">Cobrado por <span className="text-indigo-400/80 font-medium">{group.employeeName}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-zinc-500 italic">
                  {reportDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex gap-2">
                  {!allCorroborated ? (
                    <Button 
                      size="sm" 
                      className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold h-10 px-4 shadow-lg shadow-[#8b5cf6]/20" 
                      onClick={() => onCorroborate(group.payments.map((p: any) => p.id))} 
                      disabled={confirmingPaymentId !== null}
                    >
                      {confirmingPaymentId === group.payments[0].id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-2" />Corroborar Pago</>}
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 shadow-lg shadow-emerald-500/20 animate-in zoom-in-95 duration-200" 
                      onClick={() => onApplyData(group.payments)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />Utilizar Datos de Pago
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
