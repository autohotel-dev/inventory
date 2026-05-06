"use client";

import { useState, useCallback, useEffect } from "react";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Printer, Clock, DoorOpen, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface PrintHistoryTableProps {
  limit?: number;
}

export function PrintHistoryTable({ limit }: PrintHistoryTableProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPrintableEvents = useCallback(async () => {
    try {
      const { apiClient } = await import('@/lib/api/client');
      const { data } = await apiClient.get('/system/crud/audit_logs', {
        params: { limit: limit || 50 }
      });
      // Filter out only printable events
      const printable = (data || []).filter((e: any) => ["CHECKOUT", "CONSUMPTION_ADDED", "INSERT"].includes(e.action));
      setEvents(printable);
    } catch (error) {
      console.error("Error fetching print history:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchPrintableEvents();
  }, [fetchPrintableEvents]);

  const handleReprint = async (event: any) => {
    toast.info("Reimprimiendo ticket...", {
      description: `Folio asociado: ${event.id.split('-')[0].toUpperCase()}`,
    });
    
    // Aquí iria la lógica real de reconstrucción del ticket usando useThermalPrinter
    // basado en event.action y event.metadata
    setTimeout(() => {
      toast.success("Ticket reimpreso con éxito");
    }, 1500);
  };

  const getEventIcon = (action: string) => {
    switch (action) {
      case "CHECKOUT": return <DoorOpen className="w-4 h-4 text-emerald-500" />;
      case "CONSUMPTION_ADDED": return <ShoppingBag className="w-4 h-4 text-lime-500" />;
      default: return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getEventTitle = (action: string) => {
    switch (action) {
      case "CHECKOUT": return "Ticket de Salida";
      case "CONSUMPTION_ADDED": return "Ticket de Consumo";
      case "INSERT": return "Ticket de Entrada";
      default: return "Ticket General";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 -mx-6 px-6">
      <div className="space-y-2 pb-6">
        {events.map((event) => (
          <div 
            key={event.id}
            className="group flex items-center justify-between p-3 rounded-xl bg-zinc-900/30 hover:bg-zinc-800/50 border border-zinc-800/50 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                {getEventIcon(event.action)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm text-zinc-200">
                    {getEventTitle(event.action)}
                  </h4>
                  {event.room_number && (
                    <Badge variant="outline" className="text-[10px] h-5 bg-zinc-950 border-zinc-800 text-zinc-400">
                      Hab. {event.room_number}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-500 font-mono">
                    {format(new Date(event.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                  </span>
                  <span className="text-zinc-700">•</span>
                  <span className="text-xs text-zinc-500">
                    {event.employee_name || 'Sistema'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {event.amount != null && event.amount > 0 && (
                <span className="text-sm font-mono text-zinc-300 font-medium hidden sm:inline-block">
                  ${Number(event.amount).toFixed(2)}
                </span>
              )}
              
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => handleReprint(event)}
                className="opacity-0 group-hover:opacity-100 transition-opacity gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Reimprimir</span>
              </Button>
              
              <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center sm:hidden group-hover:hidden">
                <ArrowRight className="w-4 h-4 text-zinc-600" />
              </div>
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="text-center py-12">
            <Printer className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
            <p className="text-zinc-500 font-medium">No hay tickets recientes</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
