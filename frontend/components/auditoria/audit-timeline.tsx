"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, User, CreditCard, AlertTriangle, CheckCircle, RefreshCw,
  PlusCircle, XCircle, Gift, RotateCcw, Timer, UserPlus, UserMinus,
  LogOut, ShoppingBag, Wrench, Zap, DoorOpen, Home, Printer
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePrintCenter } from "@/contexts/print-center-context";

interface AuditEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  action: string;
  severity: string;
  employee_name?: string;
  user_role?: string;
  description?: string;
  room_number?: string;
  payment_method?: string;
  amount?: number;
  created_at: string;
  metadata?: Record<string, any>;
}

// ─── Mapas de Iconos y Títulos para TODOS los tipos de evento ─────────

const EVENT_ICONS: Record<string, React.ReactNode> = {
  // Pagos
  PAYMENT_CREATED: <CreditCard className="h-4 w-4" />,
  PAYMENT_PROCESSED: <CreditCard className="h-4 w-4" />,
  PAYMENT_UPDATED: <RefreshCw className="h-4 w-4" />,
  PAYMENT_ASSIGNED: <CreditCard className="h-4 w-4" />,
  // Sesiones
  SESSION_STARTED: <PlusCircle className="h-4 w-4" />,
  SESSION_ENDED: <CheckCircle className="h-4 w-4" />,
  // Anomalías
  ANOMALY_DETECTED: <AlertTriangle className="h-4 w-4" />,
  // Auth
  AUTH_EVENT: <User className="h-4 w-4" />,
  // ─── Recepción Granular ──────────────────────────────────
  CANCEL_ITEM: <XCircle className="h-4 w-4" />,
  CANCEL_CHARGE: <XCircle className="h-4 w-4" />,
  COURTESY: <Gift className="h-4 w-4" />,
  RENEWAL: <RotateCcw className="h-4 w-4" />,
  EXTRA_HOUR: <Timer className="h-4 w-4" />,
  EXTRA_PERSON: <UserPlus className="h-4 w-4" />,
  PROMO_4H: <Zap className="h-4 w-4" />,
  DAMAGE_CHARGE: <Wrench className="h-4 w-4" />,
  CHECKOUT: <DoorOpen className="h-4 w-4" />,
  ADD_PERSON: <UserPlus className="h-4 w-4" />,
  REMOVE_PERSON: <UserMinus className="h-4 w-4" />,
  TOLERANCE: <Timer className="h-4 w-4" />,
  CONSUMPTION_ADDED: <ShoppingBag className="h-4 w-4" />,
  PAYMENT_METHOD_CHANGE: <CreditCard className="h-4 w-4" />,
  UPDATE: <Home className="h-4 w-4" />,
  // Sistema
  SYSTEM_EVENT: <Clock className="h-4 w-4" />,
  DATA_CHANGE: <RefreshCw className="h-4 w-4" />,
};

const EVENT_TITLES: Record<string, string> = {
  // Pagos
  PAYMENT_CREATED: "Pago Creado",
  PAYMENT_PROCESSED: "Pago Procesado",
  PAYMENT_UPDATED: "Pago Actualizado",
  PAYMENT_ASSIGNED: "Pago Asignado",
  // Sesiones
  SESSION_STARTED: "Sesión Iniciada",
  SESSION_ENDED: "Sesión Finalizada",
  // Anomalías
  ANOMALY_DETECTED: "Anomalía Detectada",
  // Auth
  LOGIN: "Inicio de Sesión",
  LOGOUT: "Cierre de Sesión",
  LOGIN_FAILED: "Intento de Login Fallido",
  // ─── Recepción Granular ──────────────────────────────────
  CANCEL_ITEM: "Item Cancelado",
  CANCEL_CHARGE: "Cargo Cancelado",
  COURTESY: "Cortesía Aplicada",
  RENEWAL: "Renovación de Habitación",
  EXTRA_HOUR: "Hora Extra Registrada",
  EXTRA_PERSON: "Persona Extra (con cargo)",
  PROMO_4H: "Promoción 4 Horas",
  DAMAGE_CHARGE: "Cargo por Daño",
  CHECKOUT: "Check-out Completado",
  ADD_PERSON: "Persona Agregada",
  REMOVE_PERSON: "Persona Removida",
  TOLERANCE: "Tolerancia (Salida/Regreso)",
  CONSUMPTION_ADDED: "Consumo Registrado",
  PAYMENT_METHOD_CHANGE: "Cambio de Método de Pago",
  UPDATE: "Cambio de Estado",
  // Sistema
  PURGE_SYSTEM: "Reinicio del Sistema",
  MAINTENANCE: "Mantenimiento",
  INSERT: "Registro Creado",
  DELETE: "Registro Eliminado",
};

// Colores de fondo para la "burbuja" del icono según la categoría
const EVENT_ICON_COLORS: Record<string, string> = {
  CANCEL_ITEM: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  CANCEL_CHARGE: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  COURTESY: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  RENEWAL: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  EXTRA_HOUR: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  EXTRA_PERSON: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
  PROMO_4H: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  DAMAGE_CHARGE: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  CHECKOUT: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  ADD_PERSON: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  REMOVE_PERSON: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400",
  TOLERANCE: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  CONSUMPTION_ADDED: "bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400",
  ANOMALY_DETECTED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  LOGIN: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  LOGOUT: "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400",
  LOGIN_FAILED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-600 dark:text-red-400" },
  ERROR: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-600 dark:text-red-400" },
  WARNING: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
  INFO: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
  DEBUG: { bg: "bg-gray-500/10 border-gray-500/20", text: "text-gray-500 dark:text-gray-400" },
};

const RECEPTION_ACTIONS = [
  "CANCEL_ITEM", "CANCEL_CHARGE", "COURTESY", "RENEWAL", "EXTRA_HOUR",
  "EXTRA_PERSON", "PROMO_4H", "DAMAGE_CHARGE", "CHECKOUT", "ADD_PERSON",
  "REMOVE_PERSON", "TOLERANCE", "CONSUMPTION_ADDED", "PAYMENT_METHOD_CHANGE",
];

// ─── Helpers ───────────────────────────────────────────────────────

function getIcon(event: AuditEvent) {
  return EVENT_ICONS[event.action] || EVENT_ICONS[event.event_type] || <Clock className="h-4 w-4" />;
}

function getTitle(event: AuditEvent) {
  return EVENT_TITLES[event.action] || EVENT_TITLES[event.event_type] || event.action.replace(/_/g, " ");
}

function getIconColor(event: AuditEvent) {
  return EVENT_ICON_COLORS[event.action] || "bg-muted text-muted-foreground";
}

function getSeverityStyle(severity: string) {
  return SEVERITY_STYLES[severity] || SEVERITY_STYLES.INFO;
}

// ─── Component ─────────────────────────────────────────────────────

type FilterType = "all" | "reception" | "payments" | "anomalies" | "auth";

export function AuditTimeline() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const { openPrintCenter } = usePrintCenter();

  const fetchEvents = useCallback(async () => {
    const supabase = createClient();
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      
      .range(from, to);

    if (filter === "reception") {
      query = query;
    } else if (filter === "payments") {
      query = query;
    } else if (filter === "anomalies") {
      query = query.in("severity", ["ERROR", "CRITICAL", "WARNING"]);
    } else if (filter === "auth") {
      query = query;
    }

    const { data, count } = await query;
    setEvents(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [filter, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 15000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "reception", label: "Recepción" },
    { key: "payments", label: "Pagos" },
    { key: "anomalies", label: "Alertas" },
    { key: "auth", label: "Sesiones" },
  ];

  if (loading) {
    return (
      <Card className="border-0 shadow-xl bg-background/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Línea de Tiempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl bg-background/80 backdrop-blur-xl overflow-hidden">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            Línea de Tiempo
            <Badge variant="outline" className="text-[10px] font-mono ml-1">
              {totalCount} eventos
            </Badge>
          </CardTitle>
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map(opt => (
              <Button
                key={opt.key}
                variant={filter === opt.key ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilter(opt.key)}
                className={`text-xs h-7 px-3 rounded-full transition-all ${
                  filter === opt.key
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "hover:bg-muted"
                }`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[650px]">
          <div className="divide-y divide-border/30">
            {events.map((event) => {
              const sevStyle = getSeverityStyle(event.severity);
              const iconColor = getIconColor(event);

              return (
                <div
                  key={event.id}
                  className="flex gap-4 px-6 py-4 hover:bg-muted/30 transition-colors group"
                >
                  {/* Icono con color */}
                  <div className="flex-shrink-0 pt-0.5">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconColor} transition-transform group-hover:scale-110`}>
                      {getIcon(event)}
                    </div>
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Header: Título + Severity + Hora */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{getTitle(event)}</h4>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-5 font-mono ${sevStyle.bg} ${sevStyle.text} border`}
                        >
                          {event.severity}
                        </Badge>
                        {["CHECKOUT", "CONSUMPTION_ADDED", "INSERT"].includes(event.action) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => { e.stopPropagation(); openPrintCenter('advanced'); }}
                            className="h-6 w-6 ml-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Reimprimir Ticket"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                        {format(new Date(event.created_at), "HH:mm:ss", { locale: es })}
                      </span>
                    </div>

                    {/* Descripción */}
                    {event.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                    )}

                    {/* Chips de contexto */}
                    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                      {event.employee_name && (
                        <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md">
                          <User className="h-3 w-3" />
                          <span className="font-medium">{event.employee_name}</span>
                          {event.user_role && (
                            <span className="text-primary/70">({event.user_role})</span>
                          )}
                        </div>
                      )}

                      {event.room_number && (
                        <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md">
                          <Home className="h-3 w-3" />
                          <span className="font-medium">Hab. {event.room_number}</span>
                        </div>
                      )}

                      {event.payment_method && (
                        <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md">
                          <CreditCard className="h-3 w-3" />
                          <span>{event.payment_method}</span>
                        </div>
                      )}

                      {event.amount != null && event.amount > 0 && (
                        <div className="font-bold text-foreground font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md">
                          ${Number(event.amount).toFixed(2)}
                        </div>
                      )}
                    </div>

                    {/* Detalles legibles */}
                    {event.metadata && (() => {
                      const HIDDEN = ["session_id", "stay_id", "sales_order_id", "item_id", "payment_id", "checkout_valet_id", "room_number"];
                      const LABELS: Record<string, string> = {
                        amount: "Monto", concept: "Concepto", reason: "Motivo", hours: "Horas",
                        hours_deducted: "Horas descontadas", people_deducted: "Personas descontadas",
                        is_courtesy: "¿Cortesía?", courtesy_reason: "Motivo cortesía",
                        renewal_hours: "Horas renovación", is_weekend: "¿Fin de semana?",
                        previous_people: "Personas antes", new_people: "Personas después",
                        total_historic: "Total histórico", tolerance_type: "Tipo tolerancia",
                        action: "Acción", minutes_elapsed: "Minutos", minutes_remaining: "Min. restantes",
                        deadline: "Hora límite", remaining: "Saldo restante", new_status: "Nuevo estado",
                        notes: "Notas", refund_created: "¿Reembolso?", inventory_returned: "¿Inventario devuelto?",
                        payment_method: "Método pago", item_count: "Artículos",
                      };
                      const entries = Object.entries(event.metadata)
                        .filter(([k]) => !HIDDEN.includes(k) && k !== "products");
                      if (entries.length === 0 && !event.metadata.products) return null;
                      return (
                        <details className="text-xs mt-1">
                          <summary className="cursor-pointer text-primary/70 hover:text-primary transition-colors font-medium">
                            Más información
                          </summary>
                          <div className="mt-2 space-y-0.5">
                            {event.metadata.products && Array.isArray(event.metadata.products) && (
                              <div className="space-y-1 mb-2">
                                <span className="text-[11px] font-medium text-muted-foreground">Productos:</span>
                                {event.metadata.products.map((p: any, i: number) => (
                                  <div key={i} className="flex justify-between text-[11px] bg-muted/30 px-2 py-0.5 rounded">
                                    <span>{p.qty}x {p.name}{p.is_courtesy ? " (cortesía)" : ""}</span>
                                    <span className="font-mono">${(p.price * p.qty).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {entries.map(([k, v]) => (
                              <div key={k} className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{LABELS[k] || k}</span>
                                <span className="font-medium text-foreground">
                                  {typeof v === "boolean" ? (v ? "Sí" : "No") : String(v ?? "—")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      );
                    })()}
                  </div>
                </div>
              );
            })}

            {events.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No hay eventos para mostrar</p>
                <p className="text-xs mt-1">Los eventos aparecerán aquí en tiempo real</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Pagination */}
        <div className="px-6 pb-4">
          <TablePagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
