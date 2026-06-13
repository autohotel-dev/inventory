"use client";

import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePrintCenter } from "@/contexts/print-center-context";
import { Printer, Clock, Search, Settings2, RefreshCw, Wifi, WifiOff, Zap, FileText, BedDouble, ShoppingCart, LogOut, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PrintHistoryTable } from "./print-history-table";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";

export function PrintCenterModal() {
  const { isOpen, closePrintCenter } = usePrintCenter();
  const [activeTab, setActiveTab] = useState("recent");
  const { printTestTicket, isPrinting, printStatus } = useThermalPrinter();
  const [printerOnline, setPrinterOnline] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  // Verificar estado de la impresora
  const checkPrinterStatus = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001'}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      setPrinterOnline(res.ok);
      setLastCheck(new Date());
    } catch {
      setPrinterOnline(false);
      setLastCheck(new Date());
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkPrinterStatus();
      const interval = setInterval(checkPrinterStatus, 15000);
      return () => clearInterval(interval);
    }
  }, [isOpen, checkPrinterStatus]);

  // Keyboard shortcut Ctrl+P / Cmd+P
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

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closePrintCenter()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-950/95 backdrop-blur-3xl border-zinc-800/50">
        
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
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
          {/* Tabs compactos */}
          <div className="px-4 shrink-0">
            <TabsList className="bg-zinc-900/50 border border-zinc-800/50 p-0.5 h-9">
              <TabsTrigger value="recent" className="gap-1.5 text-xs px-3 h-8 data-[state=active]:bg-zinc-800">
                <Clock className="w-3.5 h-3.5" />
                Recientes
              </TabsTrigger>
              <TabsTrigger value="quick" className="gap-1.5 text-xs px-3 h-8 data-[state=active]:bg-zinc-800">
                <Zap className="w-3.5 h-3.5" />
                Rápido
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-1.5 text-xs px-3 h-8 data-[state=active]:bg-zinc-800">
                <Search className="w-3.5 h-3.5" />
                Historial
              </TabsTrigger>
              <TabsTrigger value="hardware" className="gap-1.5 text-xs px-3 h-8 data-[state=active]:bg-zinc-800">
                <Settings2 className="w-3.5 h-3.5" />
                Hardware
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            
            {/* Tab: Recientes */}
            <TabsContent value="recent" className="m-0">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Últimos Tickets</h3>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setActiveTab("advanced")}>
                  <Search className="w-3 h-3" />
                  Ver todo
                </Button>
              </div>
              <PrintHistoryTable limit={8} />
            </TabsContent>

            {/* Tab: Impresión Rápida */}
            <TabsContent value="quick" className="m-0">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Acciones Rápidas</h3>
              
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => printTestTicket()}
                  disabled={isPrinting || !printerOnline}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left",
                    printerOnline 
                      ? "bg-zinc-900/50 border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/5"
                      : "bg-zinc-900/30 border-zinc-800/50 opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0">
                    <Printer className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-zinc-200 block">Prueba de Impresión</span>
                    <span className="text-[11px] text-zinc-500">Verificar conexión</span>
                  </div>
                </button>

                <button
                  disabled={!printerOnline}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left",
                    printerOnline 
                      ? "bg-zinc-900/50 border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                      : "bg-zinc-900/30 border-zinc-800/50 opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                    <BedDouble className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-zinc-200 block">Última Estancia</span>
                    <span className="text-[11px] text-zinc-500">Reimprimir check-in</span>
                  </div>
                </button>

                <button
                  disabled={!printerOnline}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left",
                    printerOnline 
                      ? "bg-zinc-900/50 border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5"
                      : "bg-zinc-900/30 border-zinc-800/50 opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                    <ShoppingCart className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-zinc-200 block">Último Consumo</span>
                    <span className="text-[11px] text-zinc-500">Reimprimir ticket</span>
                  </div>
                </button>

                <button
                  disabled={!printerOnline}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left",
                    printerOnline 
                      ? "bg-zinc-900/50 border-zinc-800 hover:border-rose-500/50 hover:bg-rose-500/5"
                      : "bg-zinc-900/30 border-zinc-800/50 opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 shrink-0">
                    <LogOut className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-zinc-200 block">Último Checkout</span>
                    <span className="text-[11px] text-zinc-500">Reimprimir salida</span>
                  </div>
                </button>
              </div>

              {!printerOnline && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-300">Impresora desconectada. Verifica el servidor local.</span>
                </div>
              )}
            </TabsContent>

            {/* Tab: Búsqueda Histórica */}
            <TabsContent value="advanced" className="m-0">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input 
                  placeholder="Buscar por folio, habitación, tipo..." 
                  className="pl-9 bg-zinc-900/50 border-zinc-800 h-9 text-sm"
                />
              </div>
              <PrintHistoryTable />
            </TabsContent>

            {/* Tab: Hardware */}
            <TabsContent value="hardware" className="m-0">
              <div className="space-y-3">
                {/* Estado */}
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

                {/* Prueba */}
                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                  <h3 className="text-sm font-medium text-zinc-100 mb-2">Prueba de Impresión</h3>
                  <p className="text-xs text-zinc-400 mb-3">Envía un ticket de prueba para verificar la conexión.</p>
                  <Button 
                    onClick={() => printTestTicket()} 
                    disabled={isPrinting || !printerOnline}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9"
                  >
                    <Printer className="w-4 h-4" />
                    {isPrinting ? "Enviando..." : "Imprimir Prueba"}
                  </Button>
                </div>

                {/* Info */}
                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                  <h3 className="text-sm font-medium text-zinc-100 mb-2">Información</h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Servidor:</span>
                      <span className="text-zinc-200 font-mono">{process.env.NEXT_PUBLIC_PRINT_SERVER_URL || "localhost:3001"}</span>
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

// Helper function for conditional classes
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
