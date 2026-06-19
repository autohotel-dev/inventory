"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePrintCenter } from "@/contexts/print-center-context";
import {
  Printer, Clock, Settings2, RefreshCw, Wifi, WifiOff,
  Zap, BedDouble, ShoppingCart, LogOut, AlertTriangle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintHistoryTable } from "./print-history-table";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";
import { PRINT_SERVER_URL, checkPrintServer } from "@/lib/print";
import { toast } from "sonner";

export function PrintCenterModal() {
  const { isOpen, closePrintCenter } = usePrintCenter();
  const [activeTab, setActiveTab] = useState("recent");
  const { printTestTicket, isPrinting: isPrintingTest } = useThermalPrinter();
  const [printerOnline, setPrinterOnline] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [quickPrinting, setQuickPrinting] = useState<string | null>(null);

  // Ref to hold the quickReprint function from PrintHistoryTable
  const quickReprintRef = useRef<((type: "entry" | "checkout" | "consumption") => Promise<void>) | null>(null);

  // Verificar estado de la impresora
  const checkPrinterStatus = useCallback(async () => {
    const online = await checkPrintServer();
    setPrinterOnline(online);
    setLastCheck(new Date());
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkPrinterStatus();
      const interval = setInterval(checkPrinterStatus, 15000);
      return () => clearInterval(interval);
    }
  }, [isOpen, checkPrinterStatus]);

  // Atajo Ctrl+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        usePrintCenter().openPrintCenter();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Quick reprint via the shared hook from PrintHistoryTable
  const handleQuickReprint = useCallback(async (type: "entry" | "checkout" | "consumption") => {
    if (!quickReprintRef.current) {
      toast.info("Cargando tickets...", { description: "Intenta de nuevo en un momento" });
      return;
    }
    setQuickPrinting(type);
    try {
      await quickReprintRef.current(type);
    } finally {
      setQuickPrinting(null);
    }
  }, []);

  // Callback passed to PrintHistoryTable to expose its quickReprint
  const handleQuickReprintReady = useCallback((fn: (type: "entry" | "checkout" | "consumption") => Promise<void>) => {
    quickReprintRef.current = fn;
  }, []);

  if (!isOpen) return null;

  const isAnyPrinting = isPrintingTest || quickPrinting !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closePrintCenter()}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-950/95 backdrop-blur-3xl border-zinc-800/50">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800/50 bg-zinc-900/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Printer className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-zinc-100">
                  Centro de Impresión
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Reimpresión, historial y estado del hardware.
                </DialogDescription>
              </div>
            </div>
            
            {/* Estado impresora */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800">
              {printerOnline ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-medium text-emerald-400">En línea</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-[11px] font-medium text-red-400">Off</span>
                </>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="recent" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          {/* Tabs */}
          <div className="px-4 shrink-0">
            <TabsList className="bg-zinc-900/50 border border-zinc-800/50 p-0.5 h-9">
              <TabsTrigger value="recent" className="gap-1.5 text-xs px-3 h-8 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:border data-[state=active]:border-blue-500/30">
                <Clock className="w-3.5 h-3.5" />
                Tickets
              </TabsTrigger>
              <TabsTrigger value="quick" className="gap-1.5 text-xs px-3 h-8 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border data-[state=active]:border-emerald-500/30">
                <Zap className="w-3.5 h-3.5" />
                Rápido
              </TabsTrigger>
              <TabsTrigger value="hardware" className="gap-1.5 text-xs px-3 h-8 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-500/30">
                <Settings2 className="w-3.5 h-3.5" />
                Hardware
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            
            {/* Tab: Tickets (full-featured) */}
            <TabsContent value="recent" className="m-0">
              <PrintHistoryTable
                limit={15}
                showFilters
                showStats
                showSelection
                showPreview
                onQuickReprint={handleQuickReprintReady}
              />
            </TabsContent>

            {/* Tab: Acciones Rápidas */}
            <TabsContent value="quick" className="m-0">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Acciones Rápidas</h3>
              
              <div className="grid grid-cols-2 gap-2.5">
                <QuickActionButton
                  icon={<Printer className="w-5 h-5 text-blue-400" />}
                  iconBg="bg-blue-500/10 border-blue-500/20"
                  hoverColor="hover:border-blue-500/50 hover:bg-blue-500/5"
                  label="Prueba de Impresión"
                  sublabel="Verificar conexión"
                  disabled={isAnyPrinting || !printerOnline}
                  loading={isPrintingTest}
                  onClick={() => printTestTicket()}
                />
                <QuickActionButton
                  icon={<BedDouble className="w-5 h-5 text-emerald-400" />}
                  iconBg="bg-emerald-500/10 border-emerald-500/20"
                  hoverColor="hover:border-emerald-500/50 hover:bg-emerald-500/5"
                  label="Última Entrada"
                  sublabel="Reimprimir check-in"
                  disabled={isAnyPrinting || !printerOnline}
                  loading={quickPrinting === "entry"}
                  onClick={() => handleQuickReprint("entry")}
                />
                <QuickActionButton
                  icon={<ShoppingCart className="w-5 h-5 text-amber-400" />}
                  iconBg="bg-amber-500/10 border-amber-500/20"
                  hoverColor="hover:border-amber-500/50 hover:bg-amber-500/5"
                  label="Último Consumo"
                  sublabel="Reimprimir ticket"
                  disabled={isAnyPrinting || !printerOnline}
                  loading={quickPrinting === "consumption"}
                  onClick={() => handleQuickReprint("consumption")}
                />
                <QuickActionButton
                  icon={<LogOut className="w-5 h-5 text-rose-400" />}
                  iconBg="bg-rose-500/10 border-rose-500/20"
                  hoverColor="hover:border-rose-500/50 hover:bg-rose-500/5"
                  label="Último Checkout"
                  sublabel="Reimprimir salida"
                  disabled={isAnyPrinting || !printerOnline}
                  loading={quickPrinting === "checkout"}
                  onClick={() => handleQuickReprint("checkout")}
                />
              </div>

              {!printerOnline && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-300">Impresora desconectada. Verifica el servidor.</span>
                </div>
              )}
            </TabsContent>

            {/* Tab: Hardware */}
            <TabsContent value="hardware" className="m-0">
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-zinc-100">Conexión</h3>
                    <Button variant="ghost" size="sm" onClick={checkPrinterStatus} className="h-7 gap-1.5 text-xs">
                      <RefreshCw className="w-3 h-3" />
                      Verificar
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    {printerOnline ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{printerOnline ? "Conectada" : "Desconectada"}</p>
                      <p className="text-[11px] text-zinc-500">{lastCheck ? `Verificado: ${lastCheck.toLocaleTimeString("es-MX")}` : "Sin verificar"}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                  <h3 className="text-sm font-medium text-zinc-100 mb-2">Prueba de Impresión</h3>
                  <p className="text-xs text-zinc-400 mb-3">Envía un ticket de prueba para verificar la conexión.</p>
                  <Button 
                    onClick={() => printTestTicket()} 
                    disabled={isPrintingTest || !printerOnline}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9"
                  >
                    {isPrintingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    {isPrintingTest ? "Enviando..." : "Imprimir Prueba"}
                  </Button>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                  <h3 className="text-sm font-medium text-zinc-100 mb-2">Información</h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Servidor:</span>
                      <span className="text-zinc-200 font-mono">{PRINT_SERVER_URL}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Protocolo:</span>
                      <span className="text-zinc-200">TCP/IP ESC/POS</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quick Action Button ─────────────────────────────────────────────

interface QuickActionButtonProps {
  icon: React.ReactNode;
  iconBg: string;
  hoverColor: string;
  label: string;
  sublabel: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

function QuickActionButton({
  icon, iconBg, hoverColor, label, sublabel, disabled, loading, onClick,
}: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
        disabled
          ? "bg-zinc-900/30 border-zinc-800/50 opacity-50 cursor-not-allowed"
          : `bg-zinc-900/50 border-zinc-800 ${hoverColor}`
      }`}
    >
      <div className={`p-2 rounded-lg border shrink-0 ${iconBg}`}>
        {loading ? <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" /> : icon}
      </div>
      <div>
        <span className="text-sm font-medium text-zinc-200 block">{label}</span>
        <span className="text-[11px] text-zinc-500">{loading ? "Enviando..." : sublabel}</span>
      </div>
    </button>
  );
}
