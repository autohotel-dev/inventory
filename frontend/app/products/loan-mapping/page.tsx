"use client";

import { useState } from "react";
import { Utensils } from "lucide-react";
import { PendingLoansTab, usePendingLoans } from "@/components/loans/pending-loans-tab";
import { LoanHistoryTab } from "@/components/loans/loan-history-tab";
import { LoanInventoryTab } from "@/components/loans/loan-inventory-tab";
import { LoanLinksTab } from "@/components/loans/loan-links-tab";
import { LoanCatalogTab } from "@/components/loans/loan-catalog-tab";

type Tab = "pendientes" | "historial" | "inventario" | "vinculos" | "catalogo";
const TABS: { id: Tab; label: string }[] = [
  { id: "pendientes", label: "Pendientes" },
  { id: "historial", label: "Historial" },
  { id: "inventario", label: "Inventario" },
  { id: "vinculos", label: "Vínculos" },
  { id: "catalogo", label: "Catálogo" },
];

export default function LoanMappingPage() {
  const [tab, setTab] = useState<Tab>("pendientes");
  const [reloadKey, setReloadKey] = useState(0);
  const pendingLoans = usePendingLoans();

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* HEADER */}
      <header className="px-6 py-5 border-b border-white/10 bg-white/[0.02] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-6xl mx-auto w-full">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <Utensils className="w-5 h-5 text-amber-500" />
              Artículos en Préstamo
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Loza, cristalería y artículos que se prestan con los consumos: qué falta revisar, qué se perdió y cuántos hay.
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/10 self-start md:self-auto max-w-full overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 h-8 rounded-lg text-sm whitespace-nowrap transition-colors ${tab === t.id ? "bg-amber-500/15 text-amber-300" : "text-white/50 hover:text-white/80"}`}>
                {t.label}
                {t.id === "pendientes" && pendingLoans.totals.missing + pendingLoans.totals.unchecked > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${pendingLoans.totals.missing > 0 ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}`}
                    title={`${pendingLoans.totals.missing} faltantes por decidir · ${pendingLoans.totals.unchecked} sin revisar`}>
                    {pendingLoans.totals.missing + pendingLoans.totals.unchecked}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {tab === "pendientes" && <PendingLoansTab {...pendingLoans} />}
        {tab === "catalogo" && <LoanCatalogTab onChanged={() => setReloadKey(k => k + 1)} />}
        {tab === "historial" && <LoanHistoryTab />}
        {tab === "inventario" && <LoanInventoryTab />}
        {tab === "vinculos" && <LoanLinksTab reloadKey={reloadKey} />}
      </div>
    </div>
  );
}
