"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { CONCEPT_LABELS, VALET_TO_SYSTEM_MAP, OrderItem } from "./payment-constants";
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

    // If no selection, implement Smart Pending Filter:
    // Only show the group if it relates to at least one item that is still UNPAID
    if (selectedConcepts.size === 0) {
      return group.payments.some((p: any) => {
        if (!p.concept) return true; // Safety: show if concept is unknown
        const mappedSystemConcepts = VALET_TO_SYSTEM_MAP[p.concept] || [p.concept];
        return items.some(item => !item.is_paid && mappedSystemConcepts.includes(item.concept_type));
      });
    }

    // Normal filtering when there IS a selection
    return group.payments.some((p: any) => {
      if (!p.concept) return true;
      const mapped = VALET_TO_SYSTEM_MAP[p.concept] || [p.concept];
      return mapped.some(m => selectedConcepts.has(m));
    });
  });

  console.log("Visible groups:", visibleGroups.length);
  if (visibleGroups.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="relative group overflow-hidden flex items-center gap-3 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl text-indigo-400">
        <div className="absolute inset-0 bg-indigo-500/5 transition-opacity group-hover:opacity-10 pointer-events-none" />
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 shrink-0">
          <AlertTriangle className="h-5 w-5 text-indigo-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-0.5">Reportes de Cochero</h4>
          <p className="text-[11px] font-bold text-indigo-300/70">Información sobre cobros realizados en campo por cocheros pendientes de corroborar.</p>
        </div>
      </div>

      <div className="space-y-2">
        {visibleGroups.map((group, groupIdx) => {
          const allCorroborated = group.payments.every((p: any) => p.confirmed_at || corroboratedIds.has(p.id));
          const reportDate = new Date(group.collectedAt);

          return (
            <div
              key={`group-${groupIdx}`}
              className="group flex flex-col p-4 border rounded-2xl bg-zinc-900/40 backdrop-blur-md border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300 gap-4"
            >
              {/* Header Row: Amount & Time */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-indigo-400/60 uppercase tracking-[0.2em] mb-0.5">
                    Monto Informado
                  </span>
                  <span className="font-black text-2xl text-white tracking-tighter drop-shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                    {formatCurrency(group.totalAmount)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] uppercase font-black text-zinc-600 tracking-[0.2em] mb-0.5">Captura</span>
                  <span className="text-sm font-black text-zinc-400 tracking-tight bg-zinc-800/50 px-2 py-0.5 rounded-lg border border-white/5">
                    {reportDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent" />

              {/* Content Row: Badges & Employee */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {group.payments.map((p: any) => (
                    <Badge 
                      key={p.id} 
                      variant="secondary" 
                      className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20 px-2 py-0.5 text-[9px] font-black tracking-tight"
                    >
                      {p.payment_method}
                    </Badge>
                  ))}
                  {Array.from(new Set(group.payments.map((p: any) => p.concept))).filter(c => !!c).map((concept: any) => (
                    <Badge 
                      key={`concept-${concept}`} 
                      variant="outline" 
                      className="bg-zinc-800/30 text-zinc-500 border-zinc-700/30 px-2 py-0.5 text-[8px] uppercase font-black tracking-widest"
                    >
                      {CONCEPT_LABELS[String(concept)] || String(concept)}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                  <span className="text-zinc-600">Por:</span>
                  <span className="text-zinc-300">
                    {group.employeeName}
                  </span>
                </div>
              </div>

              {/* Action Button: Footer Area */}
              <div className="pt-2">
                {!allCorroborated ? (
                  <Button 
                    size="sm" 
                    className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-black h-10 rounded-xl shadow-lg shadow-[#8b5cf6]/20 transform transition-all active:scale-95 flex items-center justify-center gap-2" 
                    onClick={() => onCorroborate(group.payments.map((p: any) => p.id))} 
                    disabled={confirmingPaymentId !== null}
                  >
                    {confirmingPaymentId === group.payments[0].id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> CORROBORAR MONTO</>}
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black h-10 rounded-xl shadow-lg shadow-emerald-500/20 animate-in zoom-in-95 duration-200 transform transition-all active:scale-95 flex items-center justify-center gap-2" 
                    onClick={() => onApplyData(group.payments)}
                  >
                    <CheckCircle2 className="h-4 w-4" /> UTILIZAR DATOS
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
