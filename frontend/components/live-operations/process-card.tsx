"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronUp, Clock, Activity, Car, CreditCard, DoorOpen, PlusCircle, CheckCircle, Gift, UserPlus, ShoppingBag, ShieldCheck, Timer, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveOperationFlow, LiveOperationEvent } from "@/hooks/use-live-operations";
import { cn } from "@/lib/utils";

interface ProcessCardProps {
  flow: LiveOperationFlow;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  CHECKOUT: <DoorOpen className="h-4 w-4" />,
  INSERT: <PlusCircle className="h-4 w-4" />,
  CONSUMPTION_ADDED: <ShoppingBag className="h-4 w-4" />,
  PAYMENT_PROCESSED: <CreditCard className="h-4 w-4" />,
  VALET_ASSIGNED: <Car className="h-4 w-4" />,
  EXTRA_PERSON: <UserPlus className="h-4 w-4" />,
  COURTESY: <Gift className="h-4 w-4" />,
  // Synthesized events
  VALET_CHECKOUT_REQUESTED: <ShieldCheck className="h-4 w-4" />,
  VEHICLE_REQUESTED: <Car className="h-4 w-4" />,
  PAYMENT_COLLECTED_BY_VALET: <Activity className="h-4 w-4" />,
  PAYMENT_CONFIRMED_BY_RECEPTION: <CheckCircle className="h-4 w-4" />,
  DELIVERY_ACCEPTED: <PlusCircle className="h-4 w-4" />,
  DELIVERY_COMPLETED: <CheckCircle className="h-4 w-4" />,
  TOLERANCE: <Timer className="h-4 w-4" />,
  CANCEL_ITEM: <XCircle className="h-4 w-4" />,
  DEFAULT: <Activity className="h-4 w-4" />
};

const ACTION_LABELS: Record<string, string> = {
  CHECKOUT: "Check-out Completado",
  INSERT: "Registro Creado",
  UPDATE: "Registro Actualizado",
  CONSUMPTION_ADDED: "Consumo Registrado",
  PAYMENT_PROCESSED: "Pago Procesado",
  VALET_ASSIGNED: "Cochero Asignado",
  EXTRA_PERSON: "Persona Extra",
  COURTESY: "Cortesía Aplicada",
  VALET_CHECKOUT_REQUESTED: "Revisión de Salida Completada",
  VEHICLE_REQUESTED: "Vehículo Solicitado",
  PAYMENT_COLLECTED_BY_VALET: "Cobro por Cochero",
  PAYMENT_CONFIRMED_BY_RECEPTION: "Pago Confirmado",
  DELIVERY_ACCEPTED: "Entrega Aceptada",
  DELIVERY_COMPLETED: "Entrega Completada",
  TOLERANCE: "Tolerancia de Tiempo",
  CANCEL_ITEM: "Item Cancelado",
};

export function ProcessCard({ flow }: ProcessCardProps) {
  const [expanded, setExpanded] = useState(flow.status === 'ACTIVA');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVA': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'FINALIZADA': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      case 'CANCELADA': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const getEventIcon = (action: string) => {
    return EVENT_ICONS[action] || EVENT_ICONS.DEFAULT;
  };

  const formatTime = (isoString: string) => {
    try {
      return format(new Date(isoString), "HH:mm:ss", { locale: es });
    } catch {
      return "--:--:--";
    }
  };

  // Encontrar el iniciador (Recepción). Buscamos primero nuestro evento sintético 'CHECK_IN', o buscamos una persona que no sea el cochero.
  const sortedEvents = [...flow.events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  let initiatorName = sortedEvents.find(e => e.action === 'CHECK_IN')?.employeeName;
  
  if (!initiatorName) {
    // Si no está el evento sintético, tomamos la primera persona que NO sea el cochero (que casi siempre es Recepción)
    initiatorName = sortedEvents.find(e => 
      e.employeeName && 
      (!flow.valetEmployeeId || e.action.includes('RECEPTION') || e.action.includes('CHECK') || e.action.includes('INSERT'))
    )?.employeeName;
    
    // Si aún así no hay, fallback al primero que encontremos para no dejarlo vacío (con el riesgo de que sea el cochero, pero minimizado)
    if (!initiatorName) {
       initiatorName = sortedEvents.find(e => e.employeeName)?.employeeName;
    }
  }

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300 border-border/50",
      flow.status === 'ACTIVA' ? "bg-card/90 shadow-lg shadow-emerald-900/5 ring-1 ring-emerald-500/20" : "bg-card/50 opacity-80 hover:opacity-100"
    )}>
      {/* HEADER */}
      <div 
        className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-bold font-mono tracking-tight text-foreground">
                {flow.visualId}
              </h3>
              <Badge variant="outline" className={cn("font-mono text-xs", getStatusColor(flow.status))}>
                {flow.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <DoorOpen className="h-3.5 w-3.5" /> Hab. {flow.roomNumber}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> 
                {format(new Date(flow.checkInAt), "dd MMM, HH:mm", { locale: es })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          {flow.vehiclePlate && (
            <Badge variant="secondary" className="bg-muted/50 gap-1.5 py-1">
              <Car className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono">{flow.vehiclePlate}</span>
            </Badge>
          )}
          
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* TIMELINE BODY */}
      {expanded && (
        <CardContent className="px-6 pb-6 pt-2 border-t border-border/50 bg-muted/5">
          <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[1.4rem] before:w-px before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent mt-6">
            
            {/* Inicio estático */}
            <div className="relative flex items-center gap-4">
              <div className="absolute left-[-1.5rem] mt-0.5 h-3 w-3 rounded-full ring-4 ring-background bg-emerald-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    {formatTime(flow.checkInAt)}
                  </span>
                  {initiatorName && (
                    <Badge variant="outline" className="text-[10px] h-5 bg-background font-normal border-emerald-500/20 text-emerald-600">
                      {initiatorName}
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium mt-1">Inicio de Flujo (Asignación de Habitación)</p>
              </div>
            </div>

            {/* Eventos granulares (Audit Logs) */}
            {flow.events.length === 0 ? (
              <div className="relative flex items-center justify-center py-4 text-muted-foreground text-sm italic">
                Esperando eventos de retorno (Cochero)...
              </div>
            ) : (
              flow.events.map((event, idx) => (
                <div key={event.id} className="relative flex items-start gap-4 group">
                  <div className="absolute left-[-1.9rem] mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background bg-muted text-muted-foreground transition-transform group-hover:scale-110">
                    {getEventIcon(event.action)}
                  </div>
                  <div className="flex-1 bg-card border border-border/50 rounded-xl p-3 shadow-sm hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatTime(event.createdAt)}
                        </span>
                        {event.employeeName && (
                          <Badge variant="outline" className="text-[10px] h-5 bg-background font-normal">
                            {event.employeeName}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs font-medium text-primary/80">
                        {ACTION_LABELS[event.action] || event.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90">{event.description || "Evento registrado"}</p>
                    
                    {event.amount != null && event.amount > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                        <CreditCard className="h-3 w-3" />
                        ${event.amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Fin estático (si está cerrada) */}
            {flow.status !== 'ACTIVA' && flow.checkOutAt && (
              <div className="relative flex items-center gap-4">
                <div className="absolute left-[-1.5rem] mt-0.5 h-3 w-3 rounded-full ring-4 ring-background bg-slate-500" />
                <div className="flex-1">
                  <span className="text-xs font-mono text-slate-500 bg-slate-500/10 px-2 py-0.5 rounded-md">
                    {formatTime(flow.checkOutAt)}
                  </span>
                  <p className="text-sm font-medium mt-1">Cierre de Flujo (Salida)</p>
                </div>
              </div>
            )}

            {flow.status === 'ACTIVA' && (
              <div className="relative flex items-center gap-4">
                <div className="absolute left-[-1.6rem] mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background border-2 border-dashed border-muted-foreground animate-spin-slow" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">Proceso en curso...</p>
                </div>
              </div>
            )}
            
          </div>
        </CardContent>
      )}
    </Card>
  );
}
