"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "./utils";

interface ValetReportsSectionProps {
  valetReports: any[];
  selectedItems: Set<string>;
  corroboratedIds: Set<string>;
  onCorroborate: (reportId: string) => void;
  onApplyData: (report: any) => void;
}

export function ValetReportsSection({
  valetReports,
  selectedItems,
  corroboratedIds,
  onCorroborate,
  onApplyData,
}: ValetReportsSectionProps) {
  if (valetReports.length === 0) return null;

  const visibleReports = valetReports.filter(report => 
    selectedItems.size === 0 || report.itemIds.some((id: string) => selectedItems.has(id))
  );

  if (visibleReports.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 shadow-[0_0_15px_-5px_rgba(99,102,241,0.3)]">
        <AlertTriangle className="h-5 w-5" />
        <p className="text-xs font-black uppercase tracking-widest">Información de cobros informados por Cochero</p>
      </div>

      <div className="space-y-3">
        {visibleReports.map((report, idx) => {
          const isCheckIn = !!report.isCheckIn;
          const reportId = isCheckIn ? 'check-in-fixed' : `report-${idx}`;
          const desc = Array.isArray(report.itemDescription)
            ? report.itemDescription.length > 3
              ? `${report.itemDescription.slice(0, 3).join(", ")} +${report.itemDescription.length - 3}`
              : report.itemDescription.join(", ")
            : report.itemDescription;

          const reportDate = report.timestamp ? new Date(report.timestamp) : new Date();
          const isCorroborated = corroboratedIds.has(reportId);

          return (
            <div
              key={reportId}
              className={cn(
                "flex items-center justify-between p-4 border rounded-xl transition-all duration-300",
                isCheckIn 
                  ? "bg-emerald-500/5 border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]" 
                  : "bg-[#0f111a] border-indigo-500/20 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]",
                isCorroborated && "opacity-90"
              )}
            >
              <div className="flex items-center gap-5">
                <div className="flex flex-col gap-1.5 items-start">
                  <div className="flex flex-wrap gap-1">
                    {report.payments && report.payments.map((p: any, i: number) => (
                      <Badge 
                        key={i} 
                        variant="outline" 
                        className={cn(
                          "px-2 h-5 text-[10px] uppercase font-bold",
                          isCheckIn ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                        )}
                      >
                        {p.method} {formatCurrency(p.amount)}
                      </Badge>
                    ))}
                  </div>
                  <span className="font-black text-2xl tracking-tighter text-white">
                    {formatCurrency(report.amount)}
                    <span className="text-[10px] text-zinc-500 font-bold ml-2 uppercase tracking-widest hidden sm:inline">Total Reportado</span>
                  </span>
                </div>

                <div className="hidden sm:block w-px h-10 bg-zinc-800" />

                <div className="flex flex-col gap-1">
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-[10px] uppercase font-black tracking-widest self-start px-2 py-0.5",
                      isCheckIn ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300"
                    )}
                  >
                    {isCheckIn ? 'PAGO DE ENTRADA' : desc}
                  </Badge>

                  <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                    Cochero: <span className={cn("font-bold", isCheckIn ? "text-emerald-400" : "text-indigo-400")}>{report.valetName}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <span className="text-[10px] font-mono text-zinc-500 italic hidden md:block">
                  {reportDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>

                <div className="flex gap-2">
                  {!isCorroborated ? (
                    <Button
                      size="sm"
                      className={cn(
                        "font-bold h-10 px-4 transition-transform active:scale-95",
                        isCheckIn ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 shadow-lg" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 shadow-lg"
                      )}
                      onClick={() => onCorroborate(reportId)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Corroborar Recibo
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className={cn(
                        "font-black h-10 px-4 animate-in zoom-in-95 duration-200 shadow-xl",
                        isCheckIn ? "bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-500/30" : "bg-indigo-700 hover:bg-indigo-800 text-white shadow-indigo-500/30"
                      )}
                      onClick={() => onApplyData(report)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Utilizar Datos
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
