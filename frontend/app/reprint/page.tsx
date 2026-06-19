"use client";

import { Printer } from "lucide-react";
import { PrintHistoryTable } from "@/components/print-center/print-history-table";

export default function ReprintPage() {
  return (
    <div className="container mx-auto px-2 sm:px-4 md:py-6 py-4 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
              <Printer className="h-6 w-6 text-amber-500" />
            </div>
            Centro de Reimpresión
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Reimprimir tickets de entradas, salidas, consumos, pagos y cortes
          </p>
        </div>
      </div>

      {/* Full-featured Print History Table (same component used in navbar modal) */}
      <div className="rounded-2xl border border-white/[0.06] bg-card/50 backdrop-blur-sm p-4 sm:p-5">
        <PrintHistoryTable
          showFilters
          showStats
          showSelection
          showPreview
        />
      </div>
    </div>
  );
}
