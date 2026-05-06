"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { luxorRealtimeClient } from "@/lib/api/websocket";
import { toast } from "sonner";

export interface LiveOperationFlow {
  id: string; // The room_stay.id
  visualId: string; // e.g. FL-A1B2C3
  roomNumber: string;
  status: string;
  checkInAt: string;
  checkOutAt?: string;
  expectedCheckOutAt?: string;
  vehiclePlate?: string;
  valetEmployeeId?: string;
  receptionEmployeeId?: string | null;
  roomId?: string;
  events: LiveOperationEvent[];
}

export interface LiveOperationEvent {
  id: string;
  action: string;
  severity: string;
  createdAt: string;
  description?: string;
  metadata?: Record<string, any>;
  employeeName?: string;
  amount?: number;
}

export interface LiveOperationFilters {
  status?: string; // "ALL", "ACTIVA", "CERRADA", etc.
  shiftId?: string; // ID of the shift session
}

export function useLiveOperations() {
  const [flows, setFlows] = useState<LiveOperationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<LiveOperationFilters>({ status: 'ALL', shiftId: 'ALL' });

  const fetchFlows = useCallback(async (currentFilters?: LiveOperationFilters, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const activeFilters = currentFilters || filters;

    try {
      const supabase = createClient();
      
      // Si hay un turno específico, obtenemos sus límites de tiempo primero
      let shiftStart: string | null = null;
      let shiftEnd: string | null = null;
      
      if (activeFilters?.shiftId && activeFilters.shiftId !== 'ALL') {
        const { data: shiftData } = await supabase
          .from('shift_sessions')
          .select('clock_in_at, clock_out_at')
          
          ;
          
        if (shiftData) {
          shiftStart = shiftData.clock_in_at;
          shiftEnd = shiftData.clock_out_at; // Puede ser null si el turno está activo
        }
      }

      // 1. Fetch recent room_stays
      let query = supabase
        .from('room_stays')
        .select(`
          id, 
          status, 
          check_in_at, 
          actual_check_out_at, 
          expected_check_out_at,
          vehicle_plate,
          valet_employee_id,
          checkout_valet_employee_id,
          vehicle_requested_at,
          valet_checkout_requested_at,
          tolerance_started_at,
          tolerance_type,
          current_people,
          total_people,
          rooms ( id, number ),
          sales_orders (
            id,
            payments (
              id, concept, amount, status, collected_at, confirmed_at, confirmed_by, payment_method, reference, collected_by, terminal_code, card_last_4, card_type, payment_type, shift_session_id,
              shift_sessions ( employee_id )
            ),
            sales_order_items (
              id, concept_type, delivery_status, delivery_accepted_at, delivery_completed_at, delivery_accepted_by, delivery_notes, cancellation_reason, tip_amount, tip_method
            )
          )
        `)
        ;

      // Aplicar filtros
      if (activeFilters?.status && activeFilters.status !== 'ALL') {
        query = query;
      }
      
      if (shiftStart) {
        query = query.gte('check_in_at', shiftStart);
        if (shiftEnd) {
          query = query.lte('check_in_at', shiftEnd);
        }
        // Cuando filtramos por un turno específico, aumentamos el límite o lo quitamos para ver toda la historia
        query = query.limit(200);
      } else {
        query = query.limit(50);
      }

      const { data: stays, error: staysError } = await query;

      if (staysError) throw staysError;

      if (!stays || stays.length === 0) {
        setFlows([]);
        return;
      }

      const stayIds = stays.map((s: any) => s.id);

      // 2. Fetch audit logs related to these stays
      // Since metadata->>stay_id might be slow to query for 50 stays via IN clause if not indexed,
      // we can fetch logs that happened recently and filter them in memory, or try to query by metadata.
      // Another approach: query logs where metadata->>stay_id in (...)
      
      // We will do a generic query for logs from the oldest check-in date minus 15 minutes
      const oldestStayTime = new Date(stays[stays.length - 1].check_in_at);
      oldestStayTime.setMinutes(oldestStayTime.getMinutes() - 15);
      const oldestCheckIn = oldestStayTime.toISOString();
      
      const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .gte('created_at', oldestCheckIn)
        ;

      if (logsError) throw logsError;

      // 2.5 Fetch recent receptionist shifts to resolve the initiator rule
      // Rule: "siempre el inicio del flujo lo va a iniciar la recepcionista que esta en turno"
      const { data: recShiftsData } = await supabase
        .from('shift_sessions')
        .select('id, clock_in_at, clock_out_at, employee_id, employees!inner(role)')
        .in('employees.role', ['receptionist', 'admin', 'manager'])
        .gte('clock_in_at', oldestCheckIn) // Actually, to be safe, maybe older, but let's just get the last 100
        
        .limit(100);
        
      // Fallback query without dates just in case the active one is very old
      const { data: activeRecShiftsData } = await supabase
        .from('shift_sessions')
        .select('id, clock_in_at, clock_out_at, employee_id, employees!inner(role)')
        .in('employees.role', ['receptionist', 'admin', 'manager'])
        ;
        
      const allRecShifts = [...(recShiftsData || []), ...(activeRecShiftsData || [])];

      // Fetch employees to resolve UUIDs to names
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, first_name, last_name, role');
      
      const employeesMap = new Map<string, string>();
      employeesData?.forEach((emp: any) => {
        employeesMap.set(emp.id, `${emp.first_name} ${emp.last_name}`.trim());
      });

      // 3. Group logs by stay
      const flowsMap = new Map<string, LiveOperationFlow>();

      stays.forEach((stay: any) => {
        // Generar ID visual (e.g. fl-A1B2C3)
        const visualId = `FL-${stay.id.substring(0, 6).toUpperCase()}`;
        
        // Regla de Negocio: "Siempre el inicio del flujo lo va a iniciar la recepcionista que esta en turno"
        let recId = null;
        
        // Buscar el turno de recepción que estaba activo en el momento del checkInAt
        const checkInTime = new Date(stay.check_in_at).getTime();
        const activeShift = allRecShifts.find(shift => {
          const shiftIn = new Date(shift.clock_in_at).getTime();
          const shiftOut = shift.clock_out_at ? new Date(shift.clock_out_at).getTime() : Infinity;
          return checkInTime >= shiftIn && checkInTime <= shiftOut;
        });
        
        if (activeShift) {
          recId = activeShift.employee_id;
        } else {
          // Fallback financiero en caso de que el turno no se encuentre en la búsqueda
          const sOrder = Array.isArray(stay.sales_orders) ? stay.sales_orders[0] : stay.sales_orders;
          if (sOrder && sOrder.payments && sOrder.payments.length > 0) {
            const estPayment = sOrder.payments[0];
            if (estPayment) {
              if (estPayment.shift_sessions?.employee_id) {
                recId = estPayment.shift_sessions.employee_id;
              } else if (estPayment.confirmed_by) {
                recId = estPayment.confirmed_by;
              }
            }
          }
        }
        
        flowsMap.set(stay.id, {
          id: stay.id,
          roomId: stay.rooms?.id,
          visualId,
          roomNumber: stay.rooms?.number || "N/A",
          status: stay.status,
          checkInAt: stay.check_in_at,
          checkOutAt: stay.actual_check_out_at,
          expectedCheckOutAt: stay.expected_check_out_at,
          vehiclePlate: stay.vehicle_plate,
          valetEmployeeId: stay.valet_employee_id,
          receptionEmployeeId: recId,
          events: []
        });
      });

      // Distribute logs
      logs?.forEach((log: any) => {
        const stayId = log.metadata?.stay_id;
        const roomId = log.metadata?.room_id;
        
        let targetFlow: LiveOperationFlow | undefined;

        if (stayId && flowsMap.has(stayId)) {
          targetFlow = flowsMap.get(stayId);
        } else if (roomId) {
          // Si no tiene stay_id (ej. el evento inicial de CHECKIN), buscamos por room_id y tiempo cercano (± 5 min)
          const logTime = new Date(log.created_at).getTime();
          targetFlow = Array.from(flowsMap.values()).find(f => {
            if (f.roomId !== roomId) return false;
            const flowTime = new Date(f.checkInAt).getTime();
            // Si el log ocurrió entre 5 minutos antes y 10 minutos después del checkin
            return logTime >= flowTime - 5 * 60000 && logTime <= flowTime + 10 * 60000;
          });
        }

        if (targetFlow) {
          // Avoid duplicates if we synthesize similar events
          targetFlow.events.push({
            id: log.id,
            action: log.action || log.event_type,
            severity: log.severity,
            createdAt: log.created_at,
            description: log.description,
            metadata: log.metadata,
            employeeName: log.employee_name,
            amount: log.amount
          });
        }
      });

      // Synthesize events from data models
      stays.forEach((stay: any) => {
        const flow = flowsMap.get(stay.id);
        if (!flow) return;

        // Tolerance tracking
        if (stay.tolerance_started_at) {
          flow.events.push({
            id: `v-tol-start-${stay.id}`,
            action: 'TOLERANCE',
            severity: 'WARNING',
            createdAt: stay.tolerance_started_at,
            description: `Se activó tiempo de tolerancia (${stay.tolerance_type || 'Por definir'}).`
          });
        }

        // Valet checkout requested
        if (stay.valet_checkout_requested_at) {
          flow.events.push({
            id: `v-checkout-req-${stay.id}`,
            action: 'VALET_CHECKOUT_REQUESTED',
            severity: 'INFO',
            createdAt: stay.valet_checkout_requested_at,
            description: 'Cochero finalizó la revisión e indicó que la habitación está lista para salida definitiva.',
            employeeName: stay.checkout_valet_employee_id ? employeesMap.get(stay.checkout_valet_employee_id) : undefined
          });
        }

        // Vehicle requested
        if (stay.vehicle_requested_at) {
          flow.events.push({
            id: `v-vehicle-req-${stay.id}`,
            action: 'VEHICLE_REQUESTED',
            severity: 'INFO',
            createdAt: stay.vehicle_requested_at,
            description: 'El huésped solicitó la entrega de su vehículo en la puerta.',
            employeeName: stay.valet_employee_id ? employeesMap.get(stay.valet_employee_id) : undefined
          });
        }

        // Process payments
        const salesOrder = stay.sales_orders;
        if (salesOrder && !Array.isArray(salesOrder)) {
          const payments = salesOrder.payments || [];
          payments.forEach((payment: any) => {
            const cardInfo = payment.payment_method === 'TARJETA' && payment.card_last_4 
              ? ` [T:${payment.terminal_code || 'N/A'} - ${payment.card_type || 'N/A'} - ${payment.card_last_4}]` 
              : '';
            const paymentType = payment.payment_type === 'PARCIAL' ? '(Pago Parcial)' : '';

            // 1. Cochero registra cobro
            if (payment.collected_at) {
              flow.events.push({
                id: `v-pay-col-${payment.id}`,
                action: 'PAYMENT_COLLECTED_BY_VALET',
                severity: 'INFO',
                createdAt: payment.collected_at,
                description: `Cochero guardó datos del cobro: ${payment.payment_method} ${paymentType}${cardInfo}. Ref: ${payment.reference || 'N/A'}.`,
                amount: payment.amount,
                employeeName: payment.collected_by ? employeesMap.get(payment.collected_by) : undefined,
                metadata: { ...payment }
              });
            }

            // 2. Recepción corrobora pago
            if (payment.confirmed_at && payment.status === 'PAGADO') {
              flow.events.push({
                id: `v-pay-conf-${payment.id}`,
                action: 'PAYMENT_CONFIRMED_BY_RECEPTION',
                severity: 'INFO',
                createdAt: payment.confirmed_at,
                description: `Recepción corroboró y dio por ingresado el dinero a la caja definitiva (${payment.concept || 'ESTANCIA'}).`,
                amount: payment.amount,
                employeeName: payment.confirmed_by ? employeesMap.get(payment.confirmed_by) : undefined,
                metadata: { ...payment }
              });
            }
          });

          // Process sales order items (Consumptions)
          const items = salesOrder.sales_order_items || [];
          items.forEach((item: any) => {
            const itemName = item.concept_type || 'SERVICIO';
            
            if (item.delivery_accepted_at) {
              flow.events.push({
                id: `v-item-acc-${item.id}`,
                action: 'DELIVERY_ACCEPTED',
                severity: 'INFO',
                createdAt: item.delivery_accepted_at,
                description: `Cochero se asignó la entrega de: ${itemName}`,
                employeeName: item.delivery_accepted_by ? employeesMap.get(item.delivery_accepted_by) : undefined
              });
            }
            if (item.delivery_completed_at) {
              const tipInfo = item.tip_amount ? ` (Propina: $${item.tip_amount} ${item.tip_method || ''})` : '';
              const notesInfo = item.delivery_notes ? ` | Notas: ${item.delivery_notes}` : '';
              
              flow.events.push({
                id: `v-item-comp-${item.id}`,
                action: 'DELIVERY_COMPLETED',
                severity: 'INFO',
                createdAt: item.delivery_completed_at,
                description: `Cochero entregó en puerta: ${itemName}${tipInfo}${notesInfo}`
              });
            }
            if (item.delivery_status === 'CANCELLED' && item.cancellation_reason) {
               flow.events.push({
                id: `v-item-canc-${item.id}`,
                action: 'CANCEL_ITEM',
                severity: 'WARNING',
                createdAt: item.delivery_completed_at || new Date().toISOString(), // Fallback
                description: `Se canceló la orden de ${itemName}. Motivo: ${item.cancellation_reason}`
              });
            }
          });
        }
      });

      // Sort events ascending for timeline (ida y vuelta)
      const sortedFlows = Array.from(flowsMap.values()).map(flow => {
        // Remove duplicates by ID just in case
        const uniqueEventsMap = new Map<string, LiveOperationEvent>();
        flow.events.forEach(e => uniqueEventsMap.set(e.id, e));
        
        const uniqueEvents = Array.from(uniqueEventsMap.values());
        uniqueEvents.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        flow.events = uniqueEvents;
        
        return flow;
      });

      setFlows(sortedFlows);
    } catch (error) {
      console.error("Error fetching live operations:", error);
      toast.error("Error al cargar las operaciones");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchFlows();
    
    // Subscribe to realtime changes in operations
    const handleFlowsUpdate = () => {
      fetchFlows(filters, true);
    };

    const handleAuditLogsUpdate = (payload: any) => {
      if (payload.type === 'INSERT') {
        fetchFlows(filters, true);
      }
    };

    const unsubStays = luxorRealtimeClient.subscribe('room_stays', handleFlowsUpdate);
    const unsubLogs = luxorRealtimeClient.subscribe('audit_logs', handleAuditLogsUpdate);
    const unsubPayments = luxorRealtimeClient.subscribe('payments', handleFlowsUpdate);
    const unsubItems = luxorRealtimeClient.subscribe('sales_order_items', handleFlowsUpdate);

    return () => {
      unsubStays();
      unsubLogs();
      unsubPayments();
      unsubItems();
    };
  }, [fetchFlows, filters]);

  return {
    flows,
    loading,
    refreshing,
    filters,
    setFilters,
    fetchFlows,
    refreshFlows: () => fetchFlows(filters, true)
  };
}

export async function fetchRecentReceptionShifts() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shift_sessions')
    .select('id, clock_in_at, clock_out_at, status, employees!inner(first_name, last_name, role)')
    .in('employees.role', ['receptionist', 'admin', 'manager'])
    
    .limit(20);
    
  if (error) {
    console.error("Error fetching shifts:", error);
    return [];
  }
  return data || [];
}
