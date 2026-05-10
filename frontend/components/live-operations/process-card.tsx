"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronUp, Clock, Activity, Car, CreditCard, DoorOpen, PlusCircle, CheckCircle, Gift, UserPlus, ShoppingBag, ShieldCheck, Timer, XCircle, ChevronRight, Check } from "lucide-react";
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
  SERVICE_ORDER: <ShoppingBag className="h-4 w-4" />,
  TOLERANCE: <Timer className="h-4 w-4" />,
  CANCEL_ITEM: <XCircle className="h-4 w-4" />,
  DEFAULT: <Activity className="h-4 w-4" />
};

const ACTION_LABELS: Record<string, string> = {
  // System logs
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
  
  // TV / Asset logs
  ASSIGNED_TO_COCHERO: "Cochero Asignado",
  ASSIGNED_TO_COCHERO_FOR_TV: "Asignación de Cochero (TV)",
  CONFIRMED_TV_ON: "TV Encendida Confirmada",
  VERIFIED_IN_ROOM: "Verificación de Control y TV",
  MARKED_MISSING: "Reporte de Extravío",

  // Synthesis logs
  VALET_CHECKOUT_REQUESTED: "Revisión de Salida Completada",
  VEHICLE_REQUESTED: "Vehículo Solicitado en Puerta",
  PAYMENT_COLLECTED_BY_VALET: "Datos de Cobro Capturados (Cochero)",
  PAYMENT_CONFIRMED_BY_RECEPTION: "Pago Confirmado e Ingresado (Caja)",
  DELIVERY_ACCEPTED: "Cochero Asignado a Pedido",
  DELIVERY_COMPLETED: "Entrega de Pedido Completada",
  SERVICE_ORDER: "Orden de Servicio / Consumo",
  TOLERANCE: "Tolerancia de Tiempo Iniciada",
  CANCEL_ITEM: "Orden/Cargo Cancelado",
};

export function ProcessCard({ flow }: ProcessCardProps) {
  const [expanded, setExpanded] = useState(flow.status === 'ACTIVA');
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});

  const toggleService = (id: string) => {
    setExpandedServices(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  const getRoleColor = (role?: string) => {
    if (!role) return "text-muted-foreground border-muted";
    if (role === 'cochero' || role === 'camarista') return "text-cyan-600 border-cyan-500/30 bg-cyan-500/10";
    if (role === 'receptionist' || role === 'admin' || role === 'manager') return "text-amber-600 border-amber-500/30 bg-amber-500/10";
    return "text-muted-foreground border-muted";
  };

  const getRoleRingColor = (role?: string) => {
    if (!role) return "bg-muted text-muted-foreground";
    if (role === 'cochero' || role === 'camarista') return "bg-cyan-500/20 text-cyan-500";
    if (role === 'receptionist' || role === 'admin' || role === 'manager') return "bg-amber-500/20 text-amber-500";
    return "bg-muted text-muted-foreground";
  };

  // Encontrar el iniciador (Recepción).
  const sortedEvents = [...flow.events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  let initiatorName = sortedEvents.find(e => e.action === 'CHECK_IN')?.employeeName;
  
  if (!initiatorName) {
    initiatorName = sortedEvents.find(e => 
      e.employeeName && 
      (!flow.valetEmployeeId || e.action.includes('RECEPTION') || e.action.includes('CHECK') || e.action.includes('INSERT'))
    )?.employeeName;
    
    if (!initiatorName) {
       initiatorName = sortedEvents.find(e => e.employeeName)?.employeeName;
    }
  }

  // Pre-process events to nest item-specific payments under their SERVICE_ORDER
  const mainEvents: LiveOperationEvent[] = [];
  const itemPayments: Record<string, LiveOperationEvent[]> = {};

  flow.events.forEach(event => {
    if (event.action === 'PAYMENT_COLLECTED_BY_VALET' || event.action === 'PAYMENT_CONFIRMED_BY_RECEPTION') {
      const ref = event.metadata?.reference;
      if (ref && typeof ref === 'string' && ref.startsWith('VALET_ITEM:')) {
        const itemId = ref.replace('VALET_ITEM:', '');
        const srvId = 'v-srv-' + itemId;
        if (!itemPayments[srvId]) itemPayments[srvId] = [];
        itemPayments[srvId].push(event);
        return; // Skip adding to main timeline
      }
    }
    mainEvents.push(event);
  });

  const getPaymentMethodColor = (method?: string) => {
    if (method === 'EFECTIVO') return "text-emerald-500";
    if (method === 'TARJETA') return "text-blue-500";
    if (method === 'TRANSFERENCIA') return "text-purple-500";
    return "text-foreground";
  };

  const renderPaymentDetails = (event: LiveOperationEvent, isNested: boolean = false) => {
    const p = event.metadata;
    if (!p) return null;
    return (
      <div className="mt-1">
        <p className="text-xs text-foreground/90 mb-2">
          {event.action === 'PAYMENT_COLLECTED_BY_VALET' 
            ? "Cochero capturó los datos de cobro." 
            : `Recepción corroboró y dio por ingresado el dinero a la caja (${p.concept || 'ESTANCIA'}).`}
        </p>
        <div className={cn("grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 p-3 border rounded-lg text-xs", isNested ? "bg-background/50 border-border/30" : "bg-muted/30 border-border/50")}>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Método de Pago</span>
            <span className={cn("font-medium", getPaymentMethodColor(p.payment_method))}>
              {p.payment_method || 'N/A'} {p.payment_type === 'PARCIAL' && '(Parcial)'}
            </span>
          </div>
          {p.payment_method === 'TARJETA' && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Tipo de Tarjeta</span>
                <span className="font-medium text-foreground">{p.card_type || 'N/A'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Terminal Usada</span>
                <span className="font-medium text-foreground">{p.terminal_code || 'N/A'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Últimos 4 dígitos</span>
                <span className="font-medium font-mono text-foreground">{p.card_last_4 || '****'}</span>
              </div>
            </>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Referencia</span>
            <span className="font-medium font-mono text-foreground">{p.reference || 'N/A'}</span>
          </div>
        </div>
      </div>
    );
  };

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
                    <Badge variant="outline" className="text-[10px] h-5 bg-background font-normal border-amber-500/30 text-amber-600">
                      {initiatorName}
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium mt-1">Inicio de Flujo (Asignación de Habitación)</p>
              </div>
            </div>

            {/* Eventos granulares */}
            {mainEvents.length === 0 ? (
              <div className="relative flex items-center justify-center py-4 text-muted-foreground text-sm italic">
                Esperando eventos de retorno...
              </div>
            ) : (
              mainEvents.map((event, idx) => {
                
                // Si es un evento de Servicio Anidado
                if (event.action === 'SERVICE_ORDER') {
                  const m = event.metadata || {};
                  const isSrvExpanded = expandedServices[event.id];

                  const CONCEPT_LABELS: Record<string, string> = {
                    PROMO_4H: "Promoción de 4 Horas",
                    EXTRA_PERSON: "Persona Extra",
                    EXTRA_HOUR: "Hora Extra",
                    DAMAGE: "Cargo por Daño",
                    LATE_CHECKOUT: "Salida Tardía",
                    RENEWAL: "Renovación",
                    PRODUCT: "Producto / Servicio",
                    ROOM: "Habitación",
                  };

                  const translatedConcept = m.concept?.startsWith('ROOM_BASE') 
                    ? m.concept.replace('ROOM_BASE', 'Renta de Habitación')
                    : (CONCEPT_LABELS[m.concept] || m.concept);

                  return (
                    <div key={event.id} className="relative flex items-start gap-4 group">
                      <div className={cn("absolute left-[-1.9rem] mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background transition-transform group-hover:scale-110", getRoleRingColor(event.employeeRole))}>
                        {getEventIcon(event.action)}
                      </div>
                      <div className="flex-1 bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm hover:border-primary/30 transition-colors">
                        
                        <div 
                          className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30"
                          onClick={() => toggleService(event.id)}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-mono text-muted-foreground">
                                {formatTime(event.createdAt)}
                              </span>
                              {event.employeeName && (
                                <Badge variant="outline" className={cn("text-[10px] h-5 font-normal", getRoleColor(event.employeeRole))}>
                                  {event.employeeName}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="font-mono text-[10px] h-5">
                                Folio: {m.folio}
                              </Badge>
                            </div>
                            <span className="text-sm font-medium text-primary/90 flex items-center gap-2">
                              {ACTION_LABELS[event.action]}: {m.qty}x {translatedConcept}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                              ${m.total}
                            </span>
                            {isSrvExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Sub-Timeline del Servicio */}
                        {isSrvExpanded && (
                          <div className="px-4 pb-4 pt-2 bg-muted/20 border-t border-border/50">
                            <div className="relative pl-4 space-y-4 before:absolute before:inset-0 before:ml-[0.9rem] before:w-px before:bg-border/50 mt-4">
                              
                              <div className="relative flex items-start gap-3">
                                <div className="absolute left-[-1.25rem] mt-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
                                <div>
                                  <span className="text-xs font-mono text-muted-foreground">{formatTime(m.createdAt)}</span>
                                  <p className="text-xs text-foreground mt-0.5">
                                    Pedido registrado por <span className="font-semibold text-amber-600">{m.createdBy}</span>
                                  </p>
                                </div>
                              </div>

                              {m.acceptedAt && (
                                <div className="relative flex items-start gap-3">
                                  <div className="absolute left-[-1.25rem] mt-1 h-2 w-2 rounded-full bg-cyan-500 ring-2 ring-background" />
                                  <div>
                                    <span className="text-xs font-mono text-muted-foreground">{formatTime(m.acceptedAt)}</span>
                                    <p className="text-xs text-foreground mt-0.5">
                                      Entrega asignada a <span className="font-semibold text-cyan-600">{m.acceptedBy}</span>
                                    </p>
                                  </div>
                                </div>
                              )}

                              {m.completedAt && (
                                <div className="relative flex items-start gap-3">
                                  <div className="absolute left-[-1.25rem] mt-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                                  <div>
                                    <span className="text-xs font-mono text-muted-foreground">{formatTime(m.completedAt)}</span>
                                    <p className="text-xs text-foreground mt-0.5 flex items-center gap-1">
                                      <Check className="h-3 w-3 text-emerald-500" /> Entrega completada
                                    </p>
                                    {(m.tipAmount > 0 || m.notes) && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {m.tipAmount > 0 && `Propina: $${m.tipAmount}. `}
                                        {m.notes && `Notas: ${m.notes}`}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {m.paymentReceivedAt && (
                                <div className="relative flex items-start gap-3">
                                  <div className="absolute left-[-1.25rem] mt-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background" />
                                  <div>
                                    <span className="text-xs font-mono text-muted-foreground">{formatTime(m.paymentReceivedAt)}</span>
                                    <p className="text-xs text-foreground mt-0.5 flex items-center gap-1">
                                      <CreditCard className="h-3 w-3 text-blue-500" /> Pago de servicio registrado {m.paymentMethod && `(${m.paymentMethod})`}
                                    </p>
                                    {m.paymentReceivedBy && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Recibido por <span className="font-medium text-blue-600/80">{m.paymentReceivedBy}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {m.cancelledAt && (
                                <div className="relative flex items-start gap-3">
                                  <div className="absolute left-[-1.25rem] mt-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
                                  <div>
                                    <span className="text-xs font-mono text-muted-foreground">{formatTime(m.cancelledAt)}</span>
                                    <p className="text-xs text-foreground mt-0.5">
                                      Cancelado por <span className="font-semibold text-red-600">{m.cancelledBy}</span>
                                    </p>
                                    {m.cancellationReason && (
                                      <p className="text-xs text-red-500/80 mt-1">Motivo: {m.cancellationReason}</p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Render Nested Payment Details specifically for this Item */}
                              {itemPayments[event.id] && itemPayments[event.id].length > 0 && (
                                <div className="mt-4 pt-2 border-t border-border/30">
                                  {itemPayments[event.id].map(pmtEvent => (
                                    <div key={pmtEvent.id} className="relative flex items-start gap-3 mt-3">
                                      <div className="absolute left-[-1.25rem] mt-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background" />
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-mono text-muted-foreground">{formatTime(pmtEvent.createdAt)}</span>
                                          {pmtEvent.employeeName && (
                                            <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 font-normal", getRoleColor(pmtEvent.employeeRole))}>
                                              {pmtEvent.employeeName}
                                            </Badge>
                                          )}
                                        </div>
                                        {renderPaymentDetails(pmtEvent, true)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Eventos regulares
                const isPayment = event.action === 'PAYMENT_COLLECTED_BY_VALET' || event.action === 'PAYMENT_CONFIRMED_BY_RECEPTION';

                return (
                  <div key={event.id} className="relative flex items-start gap-4 group">
                    <div className={cn("absolute left-[-1.9rem] mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background transition-transform group-hover:scale-110", getRoleRingColor(event.employeeRole))}>
                      {getEventIcon(event.action)}
                    </div>
                    <div className="flex-1 bg-card border border-border/50 rounded-xl p-3 shadow-sm hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            {formatTime(event.createdAt)}
                          </span>
                          {event.employeeName && (
                            <Badge variant="outline" className={cn("text-[10px] h-5 font-normal", getRoleColor(event.employeeRole))}>
                              {event.employeeName}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs font-medium text-primary/80">
                          {ACTION_LABELS[event.action] || event.action.replace(/_/g, ' ')}
                        </span>
                      </div>
                      
                      {!isPayment && (
                        <p className="text-sm text-foreground/90">
                          {event.description || (
                            event.action === 'VERIFIED_IN_ROOM' 
                              ? "Cochero confirmó que el control está en la habitación y dejó la TV encendida." 
                              : event.action === 'CONFIRMED_TV_ON'
                              ? "Se confirmó que la TV está encendida."
                              : "Evento registrado"
                          )}
                        </p>
                      )}

                      {isPayment && renderPaymentDetails(event, false)}
                      
                      {event.amount != null && event.amount > 0 && (
                        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                          <CreditCard className="h-3 w-3" />
                          ${event.amount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
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
