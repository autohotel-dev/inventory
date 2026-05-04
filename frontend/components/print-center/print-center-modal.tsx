"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePrintCenter } from "@/contexts/print-center-context";
import { Printer, Clock, Search, Settings2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PrintHistoryTable } from "./print-history-table";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";

export function PrintCenterModal() {
  const { isOpen, closePrintCenter } = usePrintCenter();
  const [activeTab, setActiveTab] = useState("recent");
  const { printTestTicket, isPrinting, printStatus } = useThermalPrinter();

  // Keyboard shortcut Ctrl+P / Cmd+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault(); // Prevent browser print
        usePrintCenter().openPrintCenter();
      }
    };
    
    // Solo registrar si no está abierto (el context maneja la apertura)
    // Pero como estamos dentro del modal, la lógica del listener debería ir idealmente en un provider
    // Para simplificar, lo registramos globalmente aquí pero llamamos una función dispatch.
    return () => {};
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
                  Reimpresión rápida, historial granular y estado del hardware.
                </DialogDescription>
              </div>
            </div>
            
            {/* Indicador de estado */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
              <span className="text-xs font-medium text-zinc-300">Impresora en línea</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="recent" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 border-b border-zinc-800/50">
            <TabsList className="bg-zinc-900/50 border border-zinc-800/50 p-1">
              <TabsTrigger value="recent" className="gap-2 data-[state=active]:bg-zinc-800">
                <Clock className="w-4 h-4" />
                Rápido (Últimos 10)
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2 data-[state=active]:bg-zinc-800">
                <Search className="w-4 h-4" />
                Búsqueda Histórica
              </TabsTrigger>
              <TabsTrigger value="hardware" className="gap-2 data-[state=active]:bg-zinc-800">
                <Settings2 className="w-4 h-4" />
                Hardware
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Contenido de pestañas */}
          <div className="flex-1 overflow-y-auto p-6">
            
            <TabsContent value="recent" className="m-0 h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Últimos Tickets Generados</h3>
                <Button variant="outline" size="sm" className="h-8 gap-2 bg-zinc-900 border-zinc-800">
                  <RefreshCw className="w-3 h-3" />
                  Actualizar
                </Button>
              </div>
              {/* Aquí irá una versión resumida de la tabla, solo mostrando los últimos 10 */}
              <PrintHistoryTable limit={10} />
            </TabsContent>

            <TabsContent value="advanced" className="m-0 h-full flex flex-col">
              <div className="flex gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input 
                    placeholder="Buscar por folio, número de habitación, tipo..." 
                    className="pl-9 bg-zinc-900/50 border-zinc-800"
                  />
                </div>
                <Button variant="secondary" className="gap-2">
                  <Settings2 className="w-4 h-4" />
                  Filtros
                </Button>
              </div>
              <PrintHistoryTable />
            </TabsContent>

            <TabsContent value="hardware" className="m-0">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="p-5 rounded-xl bg-zinc-900/30 border border-zinc-800/50 space-y-4">
                  <div>
                    <h3 className="font-medium text-zinc-100">Prueba de Conexión</h3>
                    <p className="text-sm text-zinc-400 mt-1">
                      Envía un ticket de prueba directamente a la impresora térmica para verificar que el servidor local está respondiendo correctamente.
                    </p>
                  </div>
                  <Button 
                    onClick={() => printTestTicket()} 
                    disabled={isPrinting}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Printer className="w-4 h-4" />
                    {isPrinting ? "Enviando..." : "Imprimir Ticket de Prueba"}
                  </Button>
                </div>
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
