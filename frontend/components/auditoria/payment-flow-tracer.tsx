"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CreditCard, 
  Search, 
  RefreshCw,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Eye,
  TrendingUp
} from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PaymentFlowStep {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  action: string;
  severity: string;
  employee_name?: string;
  user_role?: string;
  description?: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  changed_fields?: string[];
  room_number?: string;
  payment_method?: string;
  amount?: number;
  created_at: string;
  metadata?: Record<string, any>;
}

interface PaymentDetails {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  concept: string;
  created_at: string;
  collected_by?: string;
  shift_session_id?: string;
  room_number?: string;
}

const getStepIcon = (eventType: string) => {
  switch (eventType) {
    case 'PAYMENT_CREATED':
    case 'COBRADO_POR_VALET':
      return <CreditCard className="h-4 w-4 text-blue-500" />;
    case 'PAYMENT_UPDATED':
    case 'PAYMENT_PROCESSED':
      return <RefreshCw className="h-4 w-4 text-green-500" />;
    case 'CORROBORADO_RECEPCION':
      return <CheckCircle className="h-4 w-4 text-yellow-500" />;
    case 'ANOMALY_DETECTED':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

const getStepTitle = (step: PaymentFlowStep) => {
  switch (step.event_type) {
    case 'PAYMENT_CREATED':
      return 'Pago Inicializado';
    case 'COBRADO_POR_VALET':
      return 'Cobrado por Cochero';
    case 'CORROBORADO_RECEPCION':
      return 'Corroborado por Recepción';
    case 'PAYMENT_PROCESSED':
      return 'Procesado por Recepción';
    case 'PAYMENT_UPDATED':
      return 'Pago Actualizado';
    case 'ANOMALY_DETECTED':
      return 'Anomalía Detectada';
    default:
      return step.event_type.replace(/_/g, ' ');
  }
};

export function PaymentFlowTracer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [flowSteps, setFlowSteps] = useState<PaymentFlowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPayment = async () => {
    if (!searchQuery.trim()) {
      setError('Por favor ingresa un ID de pago');
      return;
    }

    setLoading(true);
    setError(null);
    setPaymentDetails(null);
    setFlowSteps([]);

    try {
      const supabase = createClient();

      // Buscar detalles del pago
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .select(`
          *,
          sales_orders!inner (
            room_id,
            rooms!inner (
              number
            )
          )
        `)
        .eq("id", searchQuery.trim())
        .single();

      if (paymentError) {
        if (paymentError.code === 'PGRST116') {
          setError('Pago no encontrado');
        } else {
          throw paymentError;
        }
        return;
      }

      setPaymentDetails({
        id: payment.id,
        amount: payment.amount,
        payment_method: payment.payment_method,
        status: payment.status,
        concept: payment.concept || '',
        created_at: payment.created_at,
        collected_by: payment.collected_by,
        shift_session_id: payment.shift_session_id,
        room_number: payment.sales_orders?.rooms?.number
      });

      // Buscar eventos de auditoría relacionados
      const { data: auditEvents } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_id", searchQuery.trim())
        .eq("entity_type", "PAYMENT")
        .order("created_at", { ascending: true });

      setFlowSteps(auditEvents || []);

    } catch (err) {
      console.error('Error searching payment:', err);
      setError('Error al buscar el pago');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAGADO':
        return 'bg-green-100 text-green-800';
      case 'CORROBORADO_RECEPCION':
        return 'bg-yellow-100 text-yellow-800';
      case 'COBRADO_POR_VALET':
        return 'bg-blue-100 text-blue-800';
      case 'PENDIENTE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'EFECTIVO':
        return '💵';
      case 'TARJETA':
        return '💳';
      case 'TRANSFERENCIA':
        return '📱';
      default:
        return '💰';
    }
  };

  return (
    <div className="space-y-6">
      {/* Buscador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Trazador de Flujo de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Ingresa el ID del pago..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchPayment()}
              />
            </div>
            <Button onClick={searchPayment} disabled={loading}>
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {error && (
            <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-red-800 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalles del pago */}
      {paymentDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Detalles del Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">ID</Label>
                <p className="font-mono text-sm">{paymentDetails.id.slice(0, 8)}...</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Monto</Label>
                <p className="font-semibold">${paymentDetails.amount.toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Método</Label>
                <div className="flex items-center gap-2">
                  <span>{getMethodIcon(paymentDetails.payment_method)}</span>
                  <span>{paymentDetails.payment_method}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Estado</Label>
                <Badge className={getStatusColor(paymentDetails.status)}>
                  {paymentDetails.status}
                </Badge>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Habitación</Label>
                <p>{paymentDetails.room_number || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Concepto</Label>
                <p>{paymentDetails.concept || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Creado</Label>
                <p>{format(new Date(paymentDetails.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Cobrador</Label>
                <p>{paymentDetails.collected_by ? `${paymentDetails.collected_by.slice(0, 8)}...` : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flujo del pago */}
      {flowSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Flujo del Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {flowSteps.map((step, index) => (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex-shrink-0">
                        {getStepIcon(step.event_type)}
                      </div>
                      {index < flowSteps.length - 1 && (
                        <div className="w-0.5 h-8 bg-gray-300 mt-2"></div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2 pb-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{getStepTitle(step)}</h4>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(step.created_at), 'HH:mm:ss', { locale: es })}
                        </div>
                      </div>
                      
                      {step.description && (
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {step.employee_name && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {step.employee_name}
                            {step.user_role && (
                              <span className="text-blue-600">({step.user_role})</span>
                            )}
                          </div>
                        )}
                        
                        {step.changed_fields && step.changed_fields.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {step.changed_fields.length} campos cambiados
                            </Badge>
                          </div>
                        )}
                      </div>
                      
                      {/* Detalles del cambio */}
                      {step.old_data && step.new_data && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-600 hover:underline">
                            Ver cambios
                          </summary>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                              <p className="font-medium text-red-600">Antes:</p>
                              <pre className="p-2 bg-red-50 rounded text-xs overflow-x-auto">
                                {JSON.stringify(step.old_data, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="font-medium text-green-600">Después:</p>
                              <pre className="p-2 bg-green-50 rounded text-xs overflow-x-auto">
                                {JSON.stringify(step.new_data, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Sin resultados */}
      {!loading && !error && searchQuery && !paymentDetails && (
        <Card>
          <CardContent className="text-center py-8">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No se encontró información</h3>
            <p className="text-muted-foreground">
              No hay detalles ni flujo para el ID de pago proporcionado
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
