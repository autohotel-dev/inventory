"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, 
  User, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  PlusCircle,
  Eye,
  Filter
} from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case 'PAYMENT_CREATED':
    case 'PAYMENT_PROCESSED':
      return <CreditCard className="h-4 w-4" />;
    case 'PAYMENT_UPDATED':
      return <RefreshCw className="h-4 w-4" />;
    case 'ANOMALY_DETECTED':
      return <AlertTriangle className="h-4 w-4" />;
    case 'SESSION_STARTED':
      return <PlusCircle className="h-4 w-4" />;
    case 'SESSION_ENDED':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'CRITICAL':
      return 'destructive';
    case 'ERROR':
      return 'destructive';
    case 'WARNING':
      return 'warning';
    default:
      return 'default';
  }
};

const getEventTitle = (event: AuditEvent) => {
  switch (event.event_type) {
    case 'PAYMENT_CREATED':
      return 'Pago Creado';
    case 'PAYMENT_PROCESSED':
      return 'Pago Procesado';
    case 'PAYMENT_UPDATED':
      return 'Pago Actualizado';
    case 'PAYMENT_ASSIGNED':
      return 'Pago Asignado';
    case 'SESSION_STARTED':
      return 'Sesión Iniciada';
    case 'SESSION_ENDED':
      return 'Sesión Finalizada';
    case 'ANOMALY_DETECTED':
      return 'Anomalía Detectada';
    default:
      return event.event_type.replace(/_/g, ' ');
  }
};

export function AuditTimeline() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchEvents = async () => {
      const supabase = createClient();
      
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      // Aplicar filtros
      if (filter !== 'all') {
        if (filter === 'payments') {
          query = query.eq("entity_type", "PAYMENT");
        } else if (filter === 'anomalies') {
          query = query.eq("severity", "ERROR");
        } else if (filter === 'sessions') {
          query = query.contains("event_type", ["SESSION"]);
        }
      }

      const { data } = await query;
      setEvents(data || []);
      setLoading(false);
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 15000); // Actualizar cada 15 segundos
    return () => clearInterval(interval);
  }, [filter]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Línea de Tiempo de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Línea de Tiempo de Eventos
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={filter === 'payments' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('payments')}
            >
              Pagos
            </Button>
            <Button
              variant={filter === 'anomalies' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('anomalies')}
            >
              Anomalías
            </Button>
            <Button
              variant={filter === 'sessions' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('sessions')}
            >
              Sesiones
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getEventIcon(event.event_type)}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{getEventTitle(event)}</h4>
                      <Badge variant={getSeverityColor(event.severity) as any}>
                        {event.severity}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(event.created_at), 'HH:mm:ss', { locale: es })}
                    </div>
                  </div>
                  
                  {event.description && (
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {event.employee_name && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {event.employee_name}
                        {event.user_role && (
                          <span className="text-blue-600">({event.user_role})</span>
                        )}
                      </div>
                    )}
                    
                    {event.room_number && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Hab. {event.room_number}</span>
                      </div>
                    )}
                    
                    {event.payment_method && (
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {event.payment_method}
                      </div>
                    )}
                    
                    {event.amount && (
                      <div className="font-medium">
                        ${event.amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                  
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600 hover:underline">
                        Ver detalles técnicos
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
            
            {events.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay eventos para mostrar
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
