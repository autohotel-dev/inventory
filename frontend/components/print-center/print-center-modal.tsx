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
      <DialogContent className="max-w-4xl max-h-[85vh] h-[800px] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-950/95 backdrop-blur-3xl border-zinc-800/50">
        
        {/* Header Premium */}
        <div className="p-6 pb-4 border-b border-zinc-800/50 bg-zinc-900/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <Printer className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-medium tracking-tight text-zinc-100">
                  Centro de Impresión
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-400 mt-1">
                  Reimpresión rápida, historial y estado del hardware.
                </DialogDescription>
              </div>
            </div>
            
            {/* Indicador de estado */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
              {printerOnline ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <span className="text-xs font-medium text-emerald-400">En línea</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                  <span className="text-xs font-medium text-red-400">Desconectada</span>
                </>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="recent" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 border-b border-zinc-800/50">
            <TabsList className="bg-zinc-900/50 border border-zinc-800/50 p-1">
              <TabsTrigger value="recent" className="gap-2 data-[state=active]:bg-zinc-800">
                <Clock className="w-4 h-4" />
                Recientes
              </TabsTrigger>
              <TabsTrigger value="quick" className="gap-2 data-[state=active]:bg-zinc-800">
                <Zap className="w-4 h-4" />
                Impresión Rápida
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2 data-[state=active]:bg-zinc-800">
                <Search className="w-4 h-4" />
                Historial
              </TabsTrigger>
              <TabsTrigger value="hardware" className="gap-2 data-[state=active]:bg-zinc-800">
                <Settings2 className="w-4 h-4" />
                Hardware
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Contenido de pestañas */}
          <div className="flex-1 overflow-y-auto p-6">
            
            {/* Tab: Recientes */}
            <TabsContent value="recent" className="m-0 h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Últimos Tickets</h3>
                <Button variant="outline" size="sm" className="h-8 gap-2 bg-zinc-900 border-zinc-800" onClick={() => setActiveTab("advanced")}>
                  <Search className="w-3 h-3" />
                  Ver todo
                </Button>
              </div>
              <PrintHistoryTable limit={8} />
            </TabsContent>

            {/* Tab: Impresión Rápida */}
            <TabsContent value="quick" className="m-0">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Acciones Rápidas</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Ticket de Prueba */}
                  <button
                    onClick={() => printTestTicket()}
                    disabled={isPrinting || !printerOnline}
                    className={cn(
                      "flex flex-col items-center gap-3 p-5 rounded-xl border transition-all",
                      printerOnline 
                        ? "bg-zinc-900/50 border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/5"
                        : "bg-zinc-900/30 border-zinc-800/50 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <Printer className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-zinc-200">Prueba de Impresión</span>
                    <span className="text-xs text-zinc-500">Verificar conexión</span>
                  </button>

                  {/* Ticket de Última Estancia */}
                  <button
                    disabled={!printerOnline}
                    className={cn(
                      "flex flex-col items-center gap-3 p-5 rounded-xl border transition-all",
                      printerOnline 
                        ? "bg-zinc-900/50 border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                        : "bg-zinc-900/30 border-zinc-800/50 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <BedDouble className="w-6 h-6 text-emerald-400" />
                    </div>
                    <span className="text-sm font-medium text-zinc-200">Última Estancia</span>
                    <span className="text-xs text-zinc-500">Reimprimir check-in</span>
                  </button>

                  {/* Último Consumo */}
                  <button
                    disabled={!printerOnline}
                    className={cn(
                      "flex flex-col items-center gap-3 p-5 rounded-xl border transition-all",
                      printerOnline 
                        ? "bg-zinc-900/50 border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5"
                        : "bg-zinc-900/30 border-zinc-800/50 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <ShoppingCart className="w-6 h-6 text-amber-400" />
                    </div>
                    <span className="text-sm font-medium text-zinc-200">Último Consumo</span>
                    <span className="text-xs text-zinc-500">Reimprimir ticket</span>
                  </button>

                  {/* Último Checkout */}
                  <button
                    disabled={!printerOnline}
                    className={cn(
                      "flex flex-col items-center gap-3 p-5 rounded-xl border transition-all",
                      printerOnline 
                        ? "bg-zinc-900/50 border-zinc-800 hover:border-rose-500/50 hover:bg-rose-500/5"
                        : "bg-zinc-900/30 border-zinc-800/50 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <LogOut className="w-6 h-6 text-rose-400" />
                    </div>
                    <span className="text-sm font-medium text-zinc-200">Último Checkout</span>
                    <span className="text-xs text-zinc-500">Reimprimir salida</span>
                  </button>
                </div>

                {!printerOnline && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span className="text-xs text-amber-300">Impresora desconectada. Verifica que el servidor local esté corriendo.</span>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Búsqueda Histórica */}
            <TabsContent value="advanced" className="m-0 h-full flex flex-col">
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input 
                    placeholder="Buscar por folio, habitación, tipo..." 
                    className="pl-9 bg-zinc-900/50 border-zinc-800"
                  />
                </div>
              </div>
              <PrintHistoryTable />
            </TabsContent>

            {/* Tab: Hardware */}
            <TabsContent value="hardware" className="m-0">
              <div className="space-y-4">
                {/* Estado de Conexión */}
                <div className="p-5 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-zinc-100">Estado de Conexión</h3>
                    <Button variant="ghost" size="sm" onClick={checkPrinterStatus} className="gap-2">
                      <RefreshCw className="w-3 h-3" />
                      Verificar
                    </Button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-xl", printerOnline ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20")}>
                      {printerOnline ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{printerOnline ? "Impresora conectada" : "Impresora desconectada"}</p>
                      <p className="text-xs text-zinc-500">
                        {lastCheck ? `Última verificación: ${lastCheck.toLocaleTimeString("es-MX")}` : "Sin verificar"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Prueba de Impresión */}
                <div className="p-5 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                  <div className="mb-4">
                    <h3 className="font-medium text-zinc-100">Prueba de Impresión</h3>
                    <p className="text-sm text-zinc-400 mt-1">
                      Envía un ticket de prueba para verificar la conexión.
                    </p>
                  </div>
                  <Button 
                    onClick={() => printTestTicket()} 
                    disabled={isPrinting || !printerOnline}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Printer className="w-4 h-4" />
                    {isPrinting ? "Enviando..." : "Imprimir Ticket de Prueba"}
                  </Button>
                </div>

                {/* Información del Sistema */}
                <div className="p-5 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                  <h3 className="font-medium text-zinc-100 mb-3">Información</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">URL del servidor:</span>
                      <span className="text-zinc-200 font-mono text-xs">{process.env.NEXT_PUBLIC_PRINT_SERVER_URL || "localhost:3001"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Protocolo:</span>
                      <span className="text-zinc-200">TCP/IP (ESC/POS)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Puerto:</span>
                      <span className="text-zinc-200">9100</span>
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
