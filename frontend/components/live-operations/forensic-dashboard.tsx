"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Activity, Car, CreditCard, DoorOpen, PlusCircle, CheckCircle, Gift, UserPlus, ShoppingBag, ShieldCheck, Timer, XCircle, Banknote, Receipt, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveOperationFlow, LiveOperationEvent } from "@/hooks/use-live-operations";
import { cn } from "@/lib/utils";

// --- Extracted Icons & Labels ---
const EVENT_ICONS: Record<string, React.ReactNode> = {
  CHECKOUT: <DoorOpen className="h-4 w-4" />,
  INSERT: <PlusCircle className="h-4 w-4" />,
  CONSUMPTION_ADDED: <ShoppingBag className="h-4 w-4" />,
  PAYMENT_PROCESSED: <CreditCard className="h-4 w-4" />,
  VALET_ASSIGNED: <Car className="h-4 w-4" />,
  EXTRA_PERSON: <UserPlus className="h-4 w-4" />,
  COURTESY: <Gift className="h-4 w-4" />,
  VALET_CHECKOUT_REQUESTED: <ShieldCheck className="h-4 w-4" />,
  VEHICLE_REQUESTED: <Car className="h-4 w-4" />,
  PAYMENT_COLLECTED_BY_VALET: <Activity className="h-4 w-4" />,
  PAYMENT_CONFIRMED_BY_RECEPTION: <CheckCircle className="h-4 w-4" />,
  DELIVERY_ACCEPTED: <PlusCircle className="h-4 w-4" />,
  DELIVERY_COMPLETED: <CheckCircle className="h-4 w-4" />,
  SERVICE_ORDER: <ShoppingBag className="h-4 w-4" />,
  TOLERANCE: <Timer className="h-4 w-4" />,
  CANCEL_ITEM: <XCircle className="h-4 w-4" />,
  MARKED_MISSING: <AlertTriangle className="h-4 w-4" />,
  DEFAULT: <Activity className="h-4 w-4" />
};

const ACTION_LABELS: Record<string, string> = {
  CHECKOUT: "Checkout Completo",
  INSERT: "Registro Creado",
  UPDATE: "Registro Actualizado",
  CONSUMPTION_ADDED: "Consumo Añadido",
  PAYMENT_PROCESSED: "Pago Procesado",
  EXTRA_PERSON: "Persona Extra Añadida",
  REMOVE_PERSON: "Persona Extra Removida",
  EXTRA_HOUR: "Hora Extra Añadida",
  PROMO_4H: "Promoción Aplicada",
  RENEWAL: "Renovación de Estancia",
  COURTESY: "Cortesía Aplicada",
  ASSIGNED_TO_COCHERO: "Cochero Asignado",
  ASSIGNED_TO_COCHERO_FOR_TV: "Asignación de Cochero (TV)",
  CONFIRMED_TV_ON: "TV Encendida Confirmada",
  VERIFIED_IN_ROOM: "Verificación de Control y TV",
  MARKED_MISSING: "Reporte de Extravío / Daño",
  VALET_CHECKOUT_REQUESTED: "Revisión de Salida Completada",
  VEHICLE_REQUESTED: "Vehículo Solicitado en Puerta",
  PAYMENT_COLLECTED_BY_VALET: "Datos de Cobro Capturados (Cochero)",
  PAYMENT_CONFIRMED_BY_RECEPTION: "Pago Confirmado e Ingresado (Caja)",
  DELIVERY_ACCEPTED: "Cochero Asignado a Pedido",
  DELIVERY_COMPLETED: "Entrega de Pedido Completada",
  SERVICE_ORDER: "Orden de Servicio / Consumo",
  GROUPED_SERVICE_ORDER: "Orden de Servicio / Consumo",
  TOLERANCE: "Tolerancia de Tiempo Iniciada",
  CANCEL_ITEM: "Orden/Cargo Cancelado",
};

interface ForensicDashboardProps {
  flow: LiveOperationFlow;
}

type FilterTab = 'ALL' | 'PAYMENTS' | 'CONSUMPTIONS' | 'ALERTS';

export function ForensicDashboard({ flow }: ForensicDashboardProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVA': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'FINALIZADA': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      case 'CANCELADA': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const getRoleColor = (role?: string) => {
    if (!role) return "text-muted-foreground border-muted";
    if (role === 'cochero' || role === 'camarista') return "text-cyan-600 border-cyan-500/30 bg-cyan-500/10";
    if (role === 'receptionist' || role === 'admin' || role === 'manager') return "text-amber-600 border-amber-500/30 bg-amber-500/10";
    return "text-muted-foreground border-muted";
  };

  const formatEmployeeName = (name?: string) => {
    if (!name) return "";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1]}`;
  };

  const formatTime = (isoString: string) => {
    try {
      return format(new Date(isoString), "HH:mm:ss", { locale: es });
    } catch {
      return "--:--:--";
    }
  };

  // --- Financial Summary ---
  const totalConfirmed = flow.events
    .filter(e => e.action === 'PAYMENT_CONFIRMED_BY_RECEPTION')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const cashTotal = flow.events
    .filter(e => e.action === 'PAYMENT_CONFIRMED_BY_RECEPTION' && e.metadata?.payment_method === 'EFECTIVO')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const cardTotal = flow.events
    .filter(e => e.action === 'PAYMENT_CONFIRMED_BY_RECEPTION' && e.metadata?.payment_method === 'TARJETA')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
    
  const servicesCount = flow.events.filter(e => e.action === 'SERVICE_ORDER').length;
  const anomaliesCount = flow.events.filter(e => e.action === 'MARKED_MISSING' || e.metadata?.cancelledAt).length;

  // --- Data Synthesis ---
  const { mainEvents } = useMemo(() => {
    const rawEvents: LiveOperationEvent[] = [];
    const groupedOrders: Record<string, LiveOperationEvent[]> = {};

    flow.events.forEach(event => {
      // Filtering Logic
      if (activeTab === 'PAYMENTS') {
        if (!event.action.includes('PAYMENT')) return;
      } else if (activeTab === 'CONSUMPTIONS') {
        if (event.action !== 'SERVICE_ORDER') return;
      } else if (activeTab === 'ALERTS') {
        const isAnomaly = 
          event.action === 'MARKED_MISSING' || 
          event.metadata?.cancelledAt || 
          (event.action === 'SERVICE_ORDER' && event.metadata?.completedAt && event.metadata?.createdAt && (new Date(event.metadata.completedAt).getTime() - new Date(event.metadata.createdAt).getTime()) / 60000 > 20);
        if (!isAnomaly) return;
      }

      if (event.action === 'SERVICE_ORDER') {
        // Agrupar por minuto (YYYY-MM-DDTHH:mm) para unificar items ordenados al mismo tiempo
        const timeKey = event.createdAt.substring(0, 16);
        if (!groupedOrders[timeKey]) groupedOrders[timeKey] = [];
        groupedOrders[timeKey].push(event);
      } else {
        rawEvents.push(event);
      }
    });

    const synthesized: LiveOperationEvent[] = [...rawEvents];

    Object.keys(groupedOrders).forEach(timeKey => {
       const items = groupedOrders[timeKey];
       synthesized.push({
         id: 'group-' + timeKey,
         action: 'GROUPED_SERVICE_ORDER',
         severity: 'INFO',
         createdAt: items[0].createdAt,
         description: `Orden de Servicio / Consumo`,
         metadata: { items },
         employeeName: items[0].employeeName,
         employeeRole: items[0].employeeRole
       });
    });

    synthesized.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return { mainEvents: synthesized };
  }, [flow.events, activeTab]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-background rounded-2xl">
      
      {/* LEFT COLUMN: Intelligence Panel */}
      <div className="lg:col-span-4 space-y-6 bg-muted/10 p-6 rounded-l-2xl border-r border-border/50">
        
        <div className="flex flex-col items-center text-center space-y-4 pt-4">
          <div className="relative">
            <div className={cn("absolute inset-0 rounded-full blur-xl opacity-20", getStatusColor(flow.status).replace('text-', 'bg-').replace('border-', 'bg-'))} />
            <div className={cn("h-24 w-24 rounded-full flex items-center justify-center border-4 relative bg-card shadow-xl", getStatusColor(flow.status))}>
              <DoorOpen className="h-10 w-10" />
            </div>
          </div>
          
          <div>
            <h2 className="text-3xl font-black font-mono tracking-tighter">Hab. {flow.roomNumber}</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="outline" className={cn("font-mono text-sm px-3 py-1", getStatusColor(flow.status))}>
                {flow.status}
              </Badge>
              <Badge variant="secondary" className="font-mono text-sm px-3 py-1 bg-muted/50">
                {flow.visualId}
              </Badge>
            </div>
          </div>
        </div>

        {flow.vehiclePlate && (
          <div className="bg-muted/30 border border-border/50 rounded-xl p-4 flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                <Car className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Vehículo</span>
            </div>
            <span className="font-mono font-bold text-lg">{flow.vehiclePlate}</span>
          </div>
        )}

        <div className="bg-card shadow-sm border border-border/50 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Análisis Financiero
          </h3>
          
          <div className="flex items-end justify-between pb-4 border-b border-border/40">
            <span className="text-muted-foreground font-medium">Cobrado Total</span>
            <span className="text-3xl font-black font-mono text-emerald-500">${totalConfirmed.toFixed(2)}</span>
          </div>
          
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Banknote className="h-4 w-4 text-emerald-500" />
                Efectivo
              </span>
              <span className="font-mono font-bold">${cashTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CreditCard className="h-4 w-4 text-blue-500" />
                Tarjeta
              </span>
              <span className="font-mono font-bold">${cardTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/30 border border-border/50 rounded-xl p-4 flex flex-col justify-center text-center">
            <span className="text-2xl font-bold font-mono">{servicesCount}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Servicios</span>
          </div>
          <div className={cn("border rounded-xl p-4 flex flex-col justify-center text-center", anomaliesCount > 0 ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-muted/30 border-border/50")}>
            <span className="text-2xl font-bold font-mono">{anomaliesCount}</span>
            <span className={cn("text-xs uppercase tracking-wider mt-1", anomaliesCount > 0 ? "text-red-500/80" : "text-muted-foreground")}>Alertas</span>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Forensic Timeline */}
      <div className="lg:col-span-8 p-6 lg:p-8 flex flex-col">
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8 pb-6 border-b border-border/40">
          <Button 
            variant={activeTab === 'ALL' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('ALL')}
            className="rounded-full"
            size="sm"
          >
            Todos los Eventos
          </Button>
          <Button 
            variant={activeTab === 'PAYMENTS' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('PAYMENTS')}
            className="rounded-full"
            size="sm"
          >
            <CreditCard className="h-3.5 w-3.5 mr-2" />
            Finanzas
          </Button>
          <Button 
            variant={activeTab === 'CONSUMPTIONS' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('CONSUMPTIONS')}
            className="rounded-full"
            size="sm"
          >
            <ShoppingBag className="h-3.5 w-3.5 mr-2" />
            Consumos
          </Button>
          <Button 
            variant={activeTab === 'ALERTS' ? 'destructive' : 'outline'} 
            onClick={() => setActiveTab('ALERTS')}
            className={cn("rounded-full", activeTab !== 'ALERTS' && "hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30")}
            size="sm"
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-2" />
            Solo Alertas
          </Button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto pr-4">
          <div className="relative pl-6 space-y-8 before:absolute before:inset-0 before:ml-[1.4rem] before:w-px before:-translate-x-px before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent">
            
            {/* Inicio estático */}
            <div className="relative flex items-center gap-4">
              <div className="absolute left-[-1.5rem] mt-0.5 h-3 w-3 rounded-full ring-4 ring-background bg-emerald-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Ingreso de Huésped</span>
                <span className="text-xs text-muted-foreground">{format(new Date(flow.checkInAt), "dd MMM, HH:mm:ss", { locale: es })}</span>
              </div>
            </div>

            {mainEvents.length === 0 ? (
              <div className="relative flex flex-col items-center justify-center py-12 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No hay eventos para este filtro.</p>
              </div>
            ) : (
              mainEvents.map((event, idx) => {
                const isServiceOrder = event.action === 'SERVICE_ORDER';
                const isPayment = event.action.includes('PAYMENT');
                const isAnomaly = event.action === 'MARKED_MISSING' || event.metadata?.cancelledAt || (isServiceOrder && event.metadata?.completedAt && event.metadata?.createdAt && (new Date(event.metadata.completedAt).getTime() - new Date(event.metadata.createdAt).getTime()) / 60000 > 20);

                return (
                  <div key={event.id + idx} className="relative flex items-start gap-4 group">
                    <div className={cn(
                      "absolute left-[-1.9rem] mt-0.5 h-6 w-6 rounded-full ring-4 ring-background flex items-center justify-center",
                      isAnomaly ? "bg-red-500 text-white" : "bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    )}>
                      {EVENT_ICONS[event.action] || EVENT_ICONS.DEFAULT}
                    </div>

                    <div className={cn(
                      "flex-1 rounded-xl p-4 border transition-all duration-300 relative",
                      isAnomaly ? "bg-red-500/5 border-red-500/20" : isServiceOrder ? "bg-card border-border/50 shadow-sm" : isPayment ? "bg-emerald-500/5 border-emerald-500/20" : "bg-transparent border-transparent hover:bg-muted/30"
                    )}>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={cn("font-medium text-sm flex items-center gap-2", isAnomaly ? "text-red-500" : "text-foreground")}>
                            {ACTION_LABELS[event.action] || event.action}
                            {isAnomaly && <Badge variant="destructive" className="h-5 text-[10px]">ALERTA</Badge>}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-muted-foreground">
                              {formatTime(event.createdAt)}
                            </span>
                            {event.employeeName && (
                              <Badge variant="outline" className={cn("text-[10px] h-5 font-normal max-w-[110px] truncate block", getRoleColor(event.employeeRole))} title={event.employeeName}>
                                {formatEmployeeName(event.employeeName)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <p className={cn("text-sm", isAnomaly ? "text-red-400/90" : "text-foreground/90")}>
                          {event.description || "Evento registrado en el sistema."}
                        </p>

                        {/* Payment Details rendering... */}
                        {isPayment && event.metadata && (
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex flex-col gap-1">
                              <span className="text-emerald-600/70">Monto</span>
                              <span className="font-bold text-emerald-600">${event.amount?.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-emerald-600/70">Método</span>
                              <span className="font-medium text-emerald-600">{event.metadata.payment_method || 'EFECTIVO'}</span>
                            </div>
                            {event.metadata.card_type && (
                              <div className="flex flex-col gap-1">
                                <span className="text-emerald-600/70">Tarjeta</span>
                                <span className="font-medium text-emerald-600">{event.metadata.card_type} {event.metadata.card_last_4}</span>
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              <span className="text-emerald-600/70">Referencia</span>
                              <span className="font-mono text-emerald-600 truncate">{event.metadata.reference || 'N/A'}</span>
                            </div>
                          </div>
                        )}

                        {/* Extracted Service Order Metadata Rendering logic could go here, simplified for now */}
                        {isServiceOrder && event.metadata && (
                           <div className="mt-2 flex items-center justify-between text-sm bg-muted/40 p-3 rounded-lg border border-border/50">
                             <div className="flex items-center gap-3">
                               <Badge variant="secondary" className="font-mono text-[10px] h-5 whitespace-nowrap">#{event.metadata.folio}</Badge>
                               <span className="font-medium">{event.metadata.concept} (x{event.metadata.qty})</span>
                             </div>
                             <span className="font-bold text-emerald-500">${event.amount?.toFixed(2)}</span>
                           </div>
                        )}

                        {event.action === 'GROUPED_SERVICE_ORDER' && event.metadata?.items && (
                          <div className="mt-4 text-sm bg-muted/20 rounded-xl border border-border/50 overflow-hidden shadow-inner">
                            <div className="p-3 bg-muted/40 font-medium border-b border-border/50 flex justify-between items-center">
                              <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Artículos de la Orden</span>
                              <span className="text-emerald-500 font-bold font-mono text-base">
                                ${event.metadata.items.reduce((sum: number, it: any) => sum + (it.amount || 0), 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="p-3 space-y-2.5">
                              {event.metadata.items.map((it: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                  <span className="flex items-center gap-3">
                                    <Badge variant="secondary" className="font-mono text-[10px] h-5">#{it.metadata?.folio}</Badge>
                                    <span><span className="text-muted-foreground mr-1">{it.metadata?.qty}x</span>{it.metadata?.concept}</span>
                                  </span>
                                  <span className="font-mono font-medium">${it.amount?.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            
                            {/* Nested Timeline */}
                            <div className="p-4 bg-background/50 border-t border-border/50 space-y-5">
                               <div className="flex items-start gap-3">
                                 <div className="mt-1 w-2 h-2 rounded-full bg-amber-500 shrink-0 ring-2 ring-amber-500/20" />
                                 <div className="flex flex-col text-xs leading-tight">
                                   <span className="font-mono text-muted-foreground mb-0.5">{formatTime(event.metadata.items[0].createdAt)}</span>
                                   <span>Pedido registrado por <span className="font-medium text-amber-600">{event.metadata.items[0].employeeName}</span></span>
                                 </div>
                               </div>
                               
                               {event.metadata.items[0].metadata?.acceptedAt && (
                               <div className="flex items-start gap-3">
                                 <div className="mt-1 w-2 h-2 rounded-full bg-cyan-500 shrink-0 ring-2 ring-cyan-500/20" />
                                 <div className="flex flex-col text-xs leading-tight">
                                   <span className="font-mono text-muted-foreground mb-0.5">{formatTime(event.metadata.items[0].metadata.acceptedAt)}</span>
                                   <span>Entrega asignada a <span className="font-medium text-cyan-600">{event.metadata.items[0].metadata.acceptedBy}</span></span>
                                 </div>
                               </div>
                               )}
                               
                               {event.metadata.items[0].metadata?.completedAt && (
                               <div className="flex items-start gap-3">
                                 <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-500/20" />
                                 <div className="flex flex-col text-xs leading-tight">
                                   <span className="font-mono text-muted-foreground mb-0.5">{formatTime(event.metadata.items[0].metadata.completedAt)}</span>
                                   <span className="flex items-center gap-1 font-medium text-emerald-600"><CheckCircle className="h-3.5 w-3.5" /> Entrega completada</span>
                                 </div>
                               </div>
                               )}
                               
                               {event.metadata.items[0].metadata?.paymentReceivedAt && (
                               <div className="flex items-start gap-3">
                                 <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0 ring-2 ring-blue-500/20" />
                                 <div className="flex flex-col text-xs leading-tight">
                                   <span className="font-mono text-muted-foreground mb-0.5">{formatTime(event.metadata.items[0].metadata.paymentReceivedAt)}</span>
                                   <span className="flex items-center gap-1 font-medium text-blue-600"><CreditCard className="h-3.5 w-3.5" /> Pago de servicio registrado</span>
                                   <span className="text-muted-foreground mt-1">Recibido por <span className="text-foreground/80 font-medium">{event.metadata.items[0].metadata.paymentReceivedBy}</span></span>
                                 </div>
                               </div>
                               )}
                            </div>
                          </div>
                        )}
                        
                      </div>
                    </div>
                  </div>
                );
              })
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
