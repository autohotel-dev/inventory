import { ChartBar, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/formatters";
import { IncomeTotals } from "./types";

interface IncomeReportKpiProps {
    showStats: boolean;
    setShowStats: (show: boolean) => void;
    totals: IncomeTotals;
}

export function IncomeReportKpi({ showStats, setShowStats, totals }: IncomeReportKpiProps) {
    return (
        <div className="space-y-4 no-print">
            <div
                className="flex items-center justify-between p-2 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border border-border"
                onClick={() => setShowStats(!showStats)}
            >
                <div className="flex items-center gap-2 px-2">
                    <ChartBar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Resumen Estadístico</h3>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    {showStats ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </Button>
            </div>

            {showStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    {/* Total Habitaciones */}
                    <div className="bg-card p-6 rounded-xl border border-blue-200/50 dark:border-blue-900/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                                <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
                            </svg>
                        </div>
                        <div className="flex flex-col gap-1 relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                                <span className="text-sm font-semibold text-muted-foreground">Habitaciones</span>
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                                {formatCurrency((totals.roomPrice || 0))}
                            </div>
                        </div>
                    </div>

                    {/* Total Extras */}
                    <div className="bg-card p-6 rounded-xl border border-purple-200/50 dark:border-purple-900/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
                                <path d="M12 2v20" />
                                <path d="M2 12h20" />
                            </svg>
                        </div>
                        <div className="flex flex-col gap-1 relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 8v4" />
                                        <path d="M12 16h.01" />
                                    </svg>
                                </div>
                                <span className="text-sm font-semibold text-muted-foreground">Extras</span>
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                                {formatCurrency((totals.extra || 0))}
                            </div>
                        </div>
                    </div>

                    {/* Total Consumo */}
                    <div className="bg-card p-6 rounded-xl border border-amber-200/50 dark:border-amber-900/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                                <path d="M6 13.87A8 8 0 1 1 6 10a8 8 0 0 1 0 3.87" />
                                <path d="M14.54 2.11a2.97 2.97 0 0 0-5.08 0" />
                            </svg>
                        </div>
                        <div className="flex flex-col gap-1 relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M16 12h-4" />
                                        <path d="M12 8v8" />
                                    </svg>
                                </div>
                                <span className="text-sm font-semibold text-muted-foreground">Consumo</span>
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                                {formatCurrency((totals.consumption || 0))}
                            </div>
                        </div>
                    </div>

                    {/* GRAN TOTAL */}
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-shadow text-white">
                        <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                <line x1="12" x2="12" y1="2" y2="22" />
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                        </div>
                        <div className="flex flex-col gap-1 relative z-10">
                            <div className="flex items-center gap-2 mb-2 opacity-90">
                                <div className="p-2 rounded-lg bg-white/20 text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" x2="12" y1="1" y2="23" />
                                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                    </svg>
                                </div>
                                <span className="text-sm font-medium">TOTAL GENERAL</span>
                            </div>
                            <div className="text-3xl font-bold">
                                {formatCurrency((totals.total || 0))}
                            </div>
                            <p className="text-xs opacity-75 mt-1">Ingresos brutos</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
