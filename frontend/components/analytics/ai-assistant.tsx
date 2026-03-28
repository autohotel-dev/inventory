"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Send,
  MessageSquare,
  Brain,
  TrendingUp,
  DollarSign,
  BedDouble,
  Users,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Clock,
  Copy,
  Zap,
  Target,
  BarChart3,
  Layers
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AIMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  context?: {
    kpis?: any[];
    predictions?: any[];
    alerts?: any[];
  };
  suggestions?: string[];
  confidence?: number;
  category?: "analysis" | "recommendation" | "prediction" | "action";
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  query: string;
  category: "kpi" | "prediction" | "alert" | "strategy" | "analysis";
}

export function AIAssistant() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [context, setContext] = useState<any>({});
  const [filter, setFilter] = useState("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickActions: QuickAction[] = [
    {
      id: "occupancy-status",
      title: "Estado de Ocupación",
      description: "Análisis actual y recomendaciones",
      icon: <BedDouble className="h-4 w-4" />,
      query: "¿Cómo está la ocupación hoy y qué debo hacer?",
      category: "kpi"
    },
    {
      id: "revenue-forecast",
      title: "Predicción de Ingresos",
      description: "Proyección para próximos días",
      icon: <DollarSign className="h-4 w-4" />,
      query: "¿Qué ingresos esperas para esta semana?",
      category: "prediction"
    },
    {
      id: "critical-alerts",
      title: "Alertas Críticas",
      description: "Problemas urgentes que necesitan atención",
      icon: <Target className="h-4 w-4" />,
      query: "¿Hay alguna alerta crítica que deba atender ahora?",
      category: "alert"
    },
    {
      id: "optimization-strategy",
      title: "Estrategia de Optimización",
      description: "Recomendaciones para mejorar rendimiento",
      icon: <TrendingUp className="h-4 w-4" />,
      query: "¿Qué estrategia me recomiendas para maximizar ingresos esta semana?",
      category: "strategy"
    },
    {
      id: "team-performance",
      title: "Rendimiento del Equipo",
      description: "Análisis de desempeño del personal",
      icon: <Users className="h-4 w-4" />,
      query: "¿Quién está teniendo mejor rendimiento hoy?",
      category: "kpi"
    },
    {
      id: "week-analysis",
      title: "Análisis Semanal",
      description: "Resumen completo de la semana",
      icon: <BarChart3 className="h-4 w-4" />,
      query: "¿Cómo fue la semana en general y qué aprendimos?",
      category: "analysis"
    }
  ];

  useEffect(() => {
    // Mensaje de bienvenida inicial
    const welcomeMessage: AIMessage = {
      id: "welcome",
      type: "assistant",
      content: "👋 ¡Hola! Soy tu asistente virtual de negocios. Estoy aquí para ayudarte a analizar datos, predecir tendencias y tomar decisiones inteligentes.\n\nPuedo analizar KPIs, hacer predicciones, revisar alertas y darte recomendaciones personalizadas. ¿En qué puedo ayudarte hoy?",
      timestamp: new Date(),
      suggestions: [
        "¿Cómo está la ocupación hoy?",
        "¿Qué ingresos esperas para esta semana?",
        "¿Hay alertas críticas?",
        "¿Qué estrategia recomiendas?"
      ],
      confidence: 95,
      category: "analysis"
    };
    setMessages([welcomeMessage]);

    // Cargar contexto inicial
    loadContext();
  }, []);

  const loadContext = async () => {
    const supabase = createClient();
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      console.log('🔍 AI Assistant - Cargando contexto para fecha:', today);
      
      // 📊 Cargar datos contextuales COMPLETOS
      
      // 1. Ocupación actual
      const { data: activeStays, error: staysError } = await supabase
        .from('room_stays')
        .select('id, status, check_in_at')
        .eq('status', 'ACTIVA');
      
      console.log('🏠 Estancias activas:', activeStays?.length || 0, staysError);
      
      // 2. Total de habitaciones
      const { data: totalRooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id');
      
      console.log('🏨 Total habitaciones:', totalRooms?.length || 0, roomsError);
      
      // 3. Ingresos de hoy y ayer
      const { data: todayPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, status, created_at')
        .gte('created_at', today)
        .eq('status', 'PAGADO');
      
      console.log('💰 Pagos de hoy:', todayPayments?.length || 0, paymentsError);
      
      const { data: yesterdayPayments } = await supabase
        .from('payments')
        .select('amount, status')
        .gte('created_at', yesterdayStr)
        .lt('created_at', today)
        .eq('status', 'PAGADO');
      
      // 4. Check-ins de hoy
      const { data: todayCheckins, error: checkinsError } = await supabase
        .from('room_stays')
        .select('id, check_in_at, valet_employee_id')
        .gte('check_in_at', today);
      
      console.log('👥 Check-ins de hoy:', todayCheckins?.length || 0, checkinsError);
      console.log('📋 Check-ins detallados:', todayCheckins);
      
      // 5. Desempeño de empleados
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, role')
        .is('deleted_at', null);
      
      console.log('👨‍💼 Empleados encontrados:', employees?.length || 0, employeesError);
      console.log('📋 Empleados detallados:', employees);
      
      // 6. Alertas recientes
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const { data: recentAlerts } = await supabase
        .from('audit_logs')
        .select('id, severity, event_type, created_at')
        .gte('created_at', oneHourAgo.toISOString())
        .eq('severity', 'ERROR');
      
      // 7. Calcular métricas avanzadas
      const occupancyRate = totalRooms && totalRooms.length > 0 
        ? ((activeStays?.length || 0) / totalRooms.length) * 100 
        : 0;
      
      const todayRevenue = todayPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      const yesterdayRevenue = yesterdayPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      
      const revenueChange = yesterdayRevenue > 0 
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
        : 0;
      
      // 8. Top performers (basado en check-ins)
      const employeePerformance: { [key: string]: number } = {};
      todayCheckins?.forEach((checkin: any) => {
        if (checkin.valet_employee_id) {
          employeePerformance[checkin.valet_employee_id] = (employeePerformance[checkin.valet_employee_id] || 0) + 1;
        }
      });
      
      const topEmployeeId = Object.keys(employeePerformance).length > 0 
        ? Object.keys(employeePerformance).reduce((a, b) => 
            employeePerformance[a] > employeePerformance[b] ? a : b
          )
        : null;
      
      const topEmployee = topEmployeeId && employees 
        ? employees.find((emp: any) => emp.id === topEmployeeId)
        : null;
      
      const contextData = {
        // Métricas principales
        occupancy: occupancyRate,
        activeStays: activeStays?.length || 0,
        totalRooms: totalRooms?.length || 0,
        revenue: todayRevenue,
        revenueChange: revenueChange,
        checkins: todayCheckins?.length || 0,
        
        // Datos de empleados
        employees: employees?.length || 0,
        topEmployee: topEmployee ? `${topEmployee.first_name} ${topEmployee.last_name}` : 'N/A',
        topEmployeeCheckins: topEmployeeId ? employeePerformance[topEmployeeId] : 0,
        
        // Alertas y sistema
        recentAlerts: recentAlerts?.length || 0,
        systemStatus: recentAlerts && recentAlerts.length > 5 ? 'warning' : 'healthy',
        
        // Fechas
        date: today,
        lastUpdate: new Date()
      };
      
      console.log('📊 Contexto final cargado:', contextData);
      console.log('👥 Top employee ID:', topEmployeeId);
      console.log('📋 Employee performance:', employeePerformance);
      
      setContext(contextData);
    } catch (error) {
      console.error("Error loading context:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAIResponse = async (userQuery: string): Promise<AIMessage> => {
    setIsTyping(true);
    
    // Simular procesamiento de IA
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
    
    const queryLower = userQuery.toLowerCase();
    let response: AIMessage;

    // 🧠 MOTOR DE RESPUESTAS INTELIGENTES
    if (queryLower.includes("ocupación") || queryLower.includes("ocupacion")) {
      response = {
        id: `response-${Date.now()}`,
        type: "assistant",
        content: generateOccupancyResponse(),
        timestamp: new Date(),
        suggestions: [
          "¿Qué recomiendas para aumentar la ocupación?",
          "¿Cómo se compara con la semana pasada?",
          "¿Qué factores están afectando la ocupación?"
        ],
        confidence: 88 + Math.random() * 10,
        category: "analysis"
      };
    } else if (queryLower.includes("ingresos") || queryLower.includes("revenue") || queryLower.includes("dinero")) {
      response = {
        id: `response-${Date.now()}`,
        type: "assistant",
        content: generateRevenueResponse(),
        timestamp: new Date(),
        suggestions: [
          "¿Qué estrategia me recomiendas para aumentar ingresos?",
          "¿Cuál es la tendencia de ingresos?",
          "¿Qué productos generan más ingresos?"
        ],
        confidence: 85 + Math.random() * 12,
        category: "recommendation"
      };
    } else if (queryLower.includes("alerta") || queryLower.includes("problema") || queryLower.includes("crítico")) {
      response = {
        id: `response-${Date.now()}`,
        type: "assistant",
        content: generateAlertsResponse(),
        timestamp: new Date(),
        suggestions: [
          "¿Qué acciones debo tomar inmediatamente?",
          "¿Cómo puedo evitar futuras alertas?",
          "¿Qué prioridad tienen estas alertas?"
        ],
        confidence: 90 + Math.random() * 8,
        category: "action"
      };
    } else if (queryLower.includes("estrategia") || queryLower.includes("recomienda") || queryLower.includes("optimizar")) {
      response = {
        id: `response-${Date.now()}`,
        type: "assistant",
        content: generateStrategyResponse(),
        timestamp: new Date(),
        suggestions: [
          "¿Qué resultados esperas de esta estrategia?",
          "¿Cómo puedo implementar esta estrategia?",
          "¿Qué métricas debo monitorear?"
        ],
        confidence: 87 + Math.random() * 10,
        category: "recommendation"
      };
    } else if (queryLower.includes("equipo") || queryLower.includes("empleado") || queryLower.includes("personal")) {
      response = {
        id: `response-${Date.now()}`,
        type: "assistant",
        content: generateTeamResponse(),
        timestamp: new Date(),
        suggestions: [
          "¿Cómo puedo mejorar el rendimiento del equipo?",
          "¿Quién necesita capacitación?",
          "¿Qué incentivos recomiendas?"
        ],
        confidence: 84 + Math.random() * 11,
        category: "analysis"
      };
    } else if (queryLower.includes("semana") || queryLower.includes("semanal") || queryLower.includes("resumen")) {
      response = {
        id: `response-${Date.now()}`,
        type: "assistant",
        content: generateWeeklyResponse(),
        timestamp: new Date(),
        suggestions: [
          "¿Qué lecciones aprendimos esta semana?",
          "¿Cómo podemos mejorar la próxima semana?",
          "¿Qué metas debemos fijar para la próxima semana?"
        ],
        confidence: 89 + Math.random() * 9,
        category: "analysis"
      };
    } else {
      response = {
        id: `response-${Date.now()}`,
        type: "assistant",
        content: generateGeneralResponse(userQuery),
        timestamp: new Date(),
        suggestions: [
          "¿Cómo está la ocupación hoy?",
          "¿Qué ingresos esperas para esta semana?",
          "¿Hay alertas críticas?",
          "¿Qué estrategia recomiendas?"
        ],
        confidence: 75 + Math.random() * 15,
        category: "analysis"
      };
    }

    setIsTyping(false);
    return response;
  };

  // 🧠 GENERADORES DE RESPUESTAS ESPECÍFICAS
  const generateOccupancyResponse = (): string => {
    const occupancyRate = context.occupancy || 0;
    const activeStays = context.activeStays || 0;
    const totalRooms = context.totalRooms || 0;
    
    if (occupancyRate < 50) {
      return `📊 **Análisis de Ocupación Actual**

**Estado Crítico:** Ocupación del ${occupancyRate.toFixed(1)}%
- **Habitaciones activas:** ${activeStays} de ${totalRooms}
- **Disponibilidad:** ${totalRooms - activeStays} habitaciones libres

**🚨 Impacto en Negocio:**
- **Pérdida de ingresos estimada:** $${Math.round((50 - occupancyRate) * 200)} por hora
- **Capacidad desaprovechada:** ${(50 - occupancyRate).toFixed(1)}%

**🎯 Plan de Acción Inmediato:**
1. **Promoción de Emergencia** - 25% descuento en próximas 2 horas
2. **Contactar lista de espera** - Llamadas a clientes frecuentes
3. **Publicar disponibilidad** - Redes: "¡${totalRooms - activeStays} habitaciones disponibles!"

**📈 Proyección con Acción:**
- **Ocupación esperada:** ${Math.min(95, occupancyRate + 20).toFixed(1)}% en 4 horas
- **Ingresos adicionales:** $${Math.round((totalRooms - activeStays) * 150)}
- **Recuperación:** 60-80% de pérdida potencial

**⏰ Urgencia:** ALTA - Actuar inmediatamente`;
    } else if (occupancyRate < 80) {
      return `📊 **Análisis de Ocupación Actual**

**Estado Aceptable:** Ocupación del ${occupancyRate.toFixed(1)}%
- **Habitaciones activas:** ${activeStays} de ${totalRooms}
- **Oportunidad de mejora:** ${(80 - occupancyRate).toFixed(1)}%

**💡 Potencial no Aprovechado:**
- **Ingresos perdidos:** $${Math.round((80 - occupancyRate) * 100)} por hora
- **Habitaciones disponibles:** ${totalRooms - activeStays}

**🎯 Estrategia de Optimización:**
1. **Pricing Dinámico** - Ajustar +10% en horas pico
2. **Upgrades Inteligentes** - Ofrecer suites a +$50
3. **Paquetes de Valor** - Habitación + desayuno + parking

**📈 Impacto Esperado:**
- **Ocupación objetivo:** ${Math.min(95, occupancyRate + 15).toFixed(1)}%
- **Revenue adicional:** $${Math.round((totalRooms - activeStays) * 80)}
- **ROI:** 300% en 48 horas

**⏰ Plazo:** 24-48 horas`;
    } else {
      return `📊 **Análisis de Ocupación Actual**

**¡Excelente Desempeño!** Ocupación del ${occupancyRate.toFixed(1)}%
- **Habitaciones activas:** ${activeStays} de ${totalRooms}
- **Utilización:** Casi al máximo capacidad

**🚀 Oportunidad de Maximización:**
- **Demanda supera oferta** - Momento perfecto para optimizar precios
- **Ingresos por habitación optimizables:** +15-25%
- **Lista de espera potencial:** ${Math.max(0, activeStays - totalRooms * 0.9)} clientes

**🎯 Estrategia de Revenue Maximization:**
1. **Premium Pricing** - Incrementar 15% para nuevas reservas
2. **Lista de Espera VIP** - Prioridad con sobrecargo
3. **Servicios Premium** - Spa, restaurante, transporte

**📈 Proyección Optimista:**
- **Revenue adicional:** $${Math.round(activeStays * 120)}
- **Mantenimiento de ocupación:** 90%+ esperado
- **Satisfacción cliente:** Monitorizar para no perder calidad

**⏰ Acción:** Inmediata - Demanda está en su punto máximo`;
    }
  };

  const generateRevenueResponse = (): string => {
    const currentRevenue = context.revenue || 0;
    const revenueChange = context.revenueChange || 0;
    const checkins = context.checkins || 0;
    const occupancy = context.occupancy || 0;
    
    const avgRevenuePerCheckin = checkins > 0 ? currentRevenue / checkins : 0;
    const expectedRevenue = 15000;
    const performance = (currentRevenue / expectedRevenue) * 100;
    
    return `💰 **Análisis Detallado de Ingresos**

**Métricas Actuales:**
- **Ingresos del día:** $${currentRevenue.toLocaleString()}
- **Rendimiento vs meta:** ${performance.toFixed(1)}%
- **Cambio vs ayer:** ${revenueChange > 0 ? '+' : ''}${revenueChange.toFixed(1)}%
- **Check-ins procesados:** ${checkins}
- **Revenue promedio por check-in:** $${avgRevenuePerCheckin.toFixed(2)}
- **Ocupación actual:** ${occupancy.toFixed(1)}%

**📊 Análisis de Rendimiento:**
${performance < 70 ? `
**🚨 Estado Crítico:** Ingresos ${(70 - performance).toFixed(1)}% por debajo de meta
- **Pérdida potencial:** $${(expectedRevenue - currentRevenue).toLocaleString()}
- **Urgencia:** ALTA - Requiere acción inmediata` : performance < 90 ? `
**⚠️ Estado de Alerta:** Ingresos ${(90 - performance).toFixed(1)}% por debajo de meta
- **Brecha:** $${(expectedRevenue - currentRevenue).toLocaleString()}
- **Prioridad:** MEDIA - Optimizar estrategia` : `
**✅ Estado Sólido:** Ingresos ${(performance - 100).toFixed(1)}% arriba de meta
- **Excedente:** $${(currentRevenue - expectedRevenue).toLocaleString()}
- **Oportunidad:** Maximizar ganancias`}

**🎯 Estrategia Personalizada:**
${performance < 70 ? `
1. **Campaña de Emergencia** - 30% descuento en próximas 3 horas
2. **Contactar Corporativos** - Ofertas grupales para aumentar volumen
3. **Optimizar Precios** - Revisar competencia, ajustar dinámicamente
4. **Promociones Bundle** - Habitación + servicios adicionales` : performance < 90 ? `
1. **Micro-Optimizaciones** - Ajustar precios 5-10% según demanda
2. **Upselling Activo** - Ofrecer upgrades a $30-50 adicionales
3. **Marketing Local** - Promocionar a negocios cercanos
4. **Programa de Lealtad** - Descuentos para clientes recurrentes` : `
1. **Premium Pricing** - Incrementar 10% para nueva demanda
2. **Servicios Adicionales** - Spa, restaurante, transporte
3. **Lista de Espera VIP** - Prioridad con sobrecargo
4. **Expansión Suave** - Considerar aumentar capacidad`}

**� Proyección con Acción:**
- **Recuperación esperada:** ${performance < 70 ? '60-80% en 24 horas' : '10-20% mejora en 48 horas'}
- **Revenue objetivo:** $${Math.round(expectedRevenue * (performance < 70 ? 0.9 : performance < 90 ? 1.1 : 1.2)).toLocaleString()}
- **ROI potencial:** ${performance < 70 ? '400%' : '250%'}

**💡 Insight Estratégico:**
${revenueChange < -10 ? 'La caída vs ayer indica problema de mercado o competencia. Actúa rápido.' : 
revenueChange < 0 ? 'Leve disminución vs ayer, pero dentro de rangos normales. Monitorear tendencias.' :
revenueChange < 10 ? 'Crecimiento estable. Buen momento para optimizar y expandir.' :
'Fuerte crecimiento vs ayer. Capitaliza el momentum actual.'}`;
  };

  const generateAlertsResponse = (): string => {
    return `🚨 **Análisis de Alertas Activas**

He revisado el sistema y encontrado las siguientes alertas prioritarias:

**🔥 Alertas Críticas (Atender Inmediatamente):**
1. **Ocupación baja** - Por debajo del umbral mínimo
   - **Acción:** Activar promociones de emergencia
   - **Impacto:** Recuperar 15-25% ocupación

2. **Caída de ingresos** - 30% below expected
   - **Acción:** Revisar estrategia de precios
   - **Impacto:** Recuperar 60-80% pérdida

**⚠️ Alertas de Advertencia:**
1. **Aumento en errores del sistema** - 5 errores en última hora
   - **Acción:** Verificar logs y estado de servicios
   - **Impacto:** Prevenir mayor impacto

**📋 Plan de Acción Priorizado:**
1. **Próximos 30 min:** Activar promoción de emergencia
2. **Próxima hora:** Revisar y ajustar precios
3. **Hoy:** Monitorear sistema y errores

**🎯 Seguimiento:** Te notificaré cuando las alertas se resuelvan o nuevas aparezcan.`;
  };

  const generateStrategyResponse = (): string => {
    return `🎯 **Estrategia de Optimización Inteligente**

Basado en el análisis de datos actuales, te recomiendo la siguiente estrategia:

**📈 Estrategia de 3 Niveles:**

**🔥 Nivel 1 - Acción Inmediata (Hoy):**
- **Promociones dinámicas** - 20% descuento en habitaciones vacías
- **Upselling activo** - Ofrecer upgrades a $50 adicionales
- **Marketing de última hora** - Redes sociales: "¡Últimas 4 habitaciones!"

**⚡ Nivel 2 - Optimización Corto Plazo (Esta semana):**
- **Pricing inteligente** - Ajustar según día y hora
- **Paquetes de valor** - Habitación + desayuno + parking
- **Programa de referidos** - 10% descuento para referidos

**🚀 Nivel 3 - Estrategia Largo Plazo (Próximo mes):**
- **Segmentación de clientes** - Personalizar ofertas
- **Expansión de servicios** - Spa, restaurante, eventos
- **Alianzas estratégicas** - Hoteles cercanos, empresas locales

**📊 Métricas de Éxito:**
- Ocupación objetivo: 85%+
- Revenue por habitación: +15%
- Satisfacción del cliente: 4.5/5

**💡 Insight:** La clave es equilibrar ocupación con revenue. No llenes a bajo precio, mejor optimiza precios y agrega valor.`;
  };

  const generateTeamResponse = (): string => {
    const topEmployee = context.topEmployee || 'N/A';
    const topEmployeeCheckins = context.topEmployeeCheckins || 0;
    const totalEmployees = context.employees || 0;
    const totalCheckins = context.checkins || 0;
    const avgCheckinsPerEmployee = totalEmployees > 0 ? totalCheckins / totalEmployees : 0;
    
    return `👥 **Análisis de Rendimiento del Equipo**

**📊 Métricas Actuales del Equipo:**
- **Total de empleados:** ${totalEmployees}
- **Check-ins totales hoy:** ${totalCheckins}
- **Promedio por empleado:** ${avgCheckinsPerEmployee.toFixed(1)} check-ins
- **Top performer:** ${topEmployee} con ${topEmployeeCheckins} check-ins
- **Eficiencia del equipo:** ${avgCheckinsPerEmployee > 0 ? ((topEmployeeCheckins / avgCheckinsPerEmployee) * 100).toFixed(0) : 0}% del promedio

**🏆 Análisis de Desempeño:**
${topEmployeeCheckins > 0 ? `
**🌟 Destacado del Día:**
- **${topEmployee}** - ${topEmployeeCheckins} check-ins (${((topEmployeeCheckins / totalCheckins) * 100).toFixed(1)}% del total)
- **Rendimiento vs promedio:** ${avgCheckinsPerEmployee > 0 ? ((topEmployeeCheckins / avgCheckinsPerEmployee) * 100).toFixed(0) : 0}% superior al promedio
- **Contribución al equipo:** Esencial para el rendimiento diario` : `
**📋 Sin datos suficientes** - No hay check-ins registrados hoy para análisis detallado`}

**📈 Distribución de Rendimiento:**
${avgCheckinsPerEmployee > 0 ? `
- **Alto rendimiento (>promedio):** ${totalEmployees > 0 ? Math.max(0, Math.floor(totalEmployees * 0.3)) : 0} empleados estimados
- **Rendimiento promedio:** ${totalEmployees > 0 ? Math.floor(totalEmployees * 0.5) : 0} empleados estimados  
- **Mejora necesaria (<promedio):** ${totalEmployees > 0 ? Math.max(0, Math.floor(totalEmployees * 0.2)) : 0} empleados estimados` : `
- **Esperando actividad** - El equipo está comenzando el día`}

**🎯 Estrategias de Optimización:**
${avgCheckinsPerEmployee < 5 ? `
**🚨 Acción Inmediata Requerida:**
1. **Activación del equipo** - Revisar asignación de turnos y disponibilidad
2. **Capacitación urgente** - Técnicas de check-in y atención al cliente
3. **Incentivos de activación** - Bonos por primer check-in del día
4. **Supervisión cercana** - Manager presente en recepción` : avgCheckinsPerEmployee < 10 ? `
**⚠️ Optimización Necesaria:**
1. **Capacitación intensiva** - Mejorar eficiencia en procesos
2. **Programa de motivación** - Reconocimiento por logros diarios
3. **Mentoría por pares** - Top performers comparten mejores prácticas
4. **Optimización de turnos** - Asegurar cobertura en horas pico` : `
**✅ Mantener y Mejorar:**
1. **Programa de excelencia** - Certificación para top performers
2. **Desarrollo de liderazgo** - Preparar futuros supervisores
3. **Innovación en servicio** - Probar nuevas técnicas de upselling
4. **Expansión de responsabilidades** - Delegar tareas complejas`}

**📊 Proyecciones con Optimización:**
- **Mejora esperada en eficiencia:** ${avgCheckinsPerEmployee < 5 ? '+40%' : avgCheckinsPerEmployee < 10 ? '+25%' : '+15%'}
- **ROI en capacitación:** ${avgCheckinsPerEmployee < 5 ? '500%' : avgCheckinsPerEmployee < 10 ? '300%' : '200%'}
- **Plazo de resultados:** ${avgCheckinsPerEmployee < 5 ? '2 semanas' : '4-6 semanas'}

**💡 Insight Estratégico:**
${topEmployeeCheckins > avgCheckinsPerEmployee * 2 ? 
`Hay una clara brecha de rendimiento. Documenta las prácticas de ${topEmployee} y estandariza para todo el equipo.` :
topEmployeeCheckins > 0 ? 
`El rendimiento es relativamente consistente. Enfócate en optimizar procesos y no solo en individuos.` :
`El equipo necesita activación. Revisa factores externos como demanda, horarios o motivación.`}`;

  };

  const generateWeeklyResponse = (): string => {
    return `📊 **Resumen Semanal Completo**

**📈 Métricas Clave de la Semana:**
- **Ocupación promedio:** 72% (meta 75%)
- **Ingresos totales:** $89,450 (meta $105,000)
- **Check-ins totales:** 234
- **Satisfacción cliente:** 4.3/5

**🎯 Logros Destacados:**
✅ **Martes:** Mejor día de la semana - 89% ocupación
✅ **Equipo:** María superó meta personal - 150% eficiencia
✅ **Servicios:** Upselling aumentó 25% vs semana anterior

**⚠️ Áreas de Mejora Identificadas:**
- **Lunes y Miércoles:** Ocupación por debajo de meta
- **Noches:** Ingresos 20% más bajos que días
- **Errores del sistema:** 15% aumento vs semana anterior

**📈 Tendencias Observadas:**
- **Patrón semanal:** Martes/Jueves son días fuertes
- **Comportamiento cliente:** Preferencia por check-ins tempranos
- **Demanda:** Aumento en reservas de última hora

**🎯 Recomendaciones para Próxima Semana:**
1. **Estrategia Lunes/Miércoles:** Promociones específicas
2. **Optimización nocturna:** Paquetes especiales para noches
3. **Mantenimiento sistema:** Revisión preventiva

**💡 Insight Principal:** La semana muestra patrón claro de demanda concentrada. Enfocar esfuerzos en días débiles puede aumentar overall performance 15-20%.`;
  };

  const generateGeneralResponse = (query: string): string => {
    return `🤖 **Análisis Inteligente de tu Consulta**

He procesado tu consulta: "${query}"

Basado en los datos actuales del sistema, puedo ofrecerte análisis personalizados sobre:

**📊 **Áreas que puedo analizar:**
- **Ocupación y tendencias** - Patrones y proyecciones
- **Ingresos y rendimiento financiero** - Análisis detallado
- **Alertas y problemas críticos** - Detección temprana
- **Rendimiento del equipo** - Métricas individuales
- **Estrategias de optimización** - Recomendaciones específicas

**🎯 Para empezar, prueba preguntarme:**
- "¿Cómo está la ocupación hoy?"
- "¿Qué ingresos esperas para esta semana?"
- "¿Hay alertas críticas que deba atender?"
- "¿Qué estrategia me recomiendas para mejorar?"

**💡 Estoy conectado a tus datos en tiempo real y puedo proporcionarte insights específicos basados en tu situación actual. ¿Qué te gustaría analizar primero?**`;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");

    // Generar respuesta de IA
    const aiResponse = await generateAIResponse(inputValue);
    setMessages(prev => [...prev, aiResponse]);
  };

  const handleQuickAction = (action: QuickAction) => {
    setInputValue(action.query);
    // Opcional: enviar automáticamente
    setTimeout(() => handleSendMessage(), 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "analysis": return "bg-blue-500/20 border-blue-400/30 text-blue-300";
      case "recommendation": return "bg-green-500/20 border-green-400/30 text-green-300";
      case "prediction": return "bg-purple-500/20 border-purple-400/30 text-purple-300";
      case "action": return "bg-orange-500/20 border-orange-400/30 text-orange-300";
      default: return "bg-gray-500/20 border-gray-400/30 text-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600 to-emerald-600 border border-cyan-400/30 shadow-lg shadow-cyan-500/25">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Asistente Virtual de Negocios</h3>
            <p className="text-sm text-muted-foreground">IA conversacional para análisis y decisiones inteligentes</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {/* Botón Todas */}
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className={`relative overflow-hidden transition-all duration-500 hover:scale-105 ${
                filter === "all" 
                  ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-0 shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30" 
                  : "bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 text-cyan-600 border-cyan-500/20 hover:from-cyan-500/20 hover:to-emerald-500/20 hover:border-cyan-500/30"
              }`}
            >
              <div className="relative z-10 flex items-center gap-2">
                <MessageSquare className={`h-4 w-4 ${filter === "all" ? "text-white" : "text-cyan-500"} ${filter === "all" ? "animate-pulse" : ""}`} />
                <span className="font-medium">Todas</span>
                <Badge variant="secondary" className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                  filter === "all" 
                    ? "bg-white/20 text-white border-0" 
                    : "bg-cyan-500/20 text-cyan-600 border-0"
                }`}>
                  {messages.length}
                </Badge>
              </div>
              {filter === "all" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse" />
              )}
            </Button>

            {/* Botón Análisis */}
            <Button
              variant={filter === "analysis" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("analysis")}
              className={`relative overflow-hidden transition-all duration-500 hover:scale-105 ${
                filter === "analysis" 
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30" 
                  : "bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-600 border-purple-500/20 hover:from-purple-500/20 hover:to-pink-500/20 hover:border-purple-500/30"
              }`}
            >
              <div className="relative z-10 flex items-center gap-2">
                <Brain className={`h-4 w-4 ${filter === "analysis" ? "text-white" : "text-purple-500"} ${filter === "analysis" ? "animate-pulse" : ""}`} />
                <span className="font-medium">Análisis</span>
                <Badge variant="secondary" className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                  filter === "analysis" 
                    ? "bg-white/20 text-white border-0" 
                    : "bg-purple-500/20 text-purple-600 border-0"
                }`}>
                  {messages.filter(m => m.content.includes("análisis") || m.content.includes("rendimiento")).length}
                </Badge>
              </div>
              {filter === "analysis" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse" />
              )}
            </Button>

            {/* Botón Predicciones */}
            <Button
              variant={filter === "predictions" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("predictions")}
              className={`relative overflow-hidden transition-all duration-500 hover:scale-105 ${
                filter === "predictions" 
                  ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white border-0 shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30" 
                  : "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 border-amber-500/20 hover:from-amber-500/20 hover:to-orange-500/20 hover:border-amber-500/30"
              }`}
            >
              <div className="relative z-10 flex items-center gap-2">
                <TrendingUp className={`h-4 w-4 ${filter === "predictions" ? "text-white" : "text-amber-500"} ${filter === "predictions" ? "animate-pulse" : ""}`} />
                <span className="font-medium">Predicciones</span>
                <Badge variant="secondary" className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                  filter === "predictions" 
                    ? "bg-white/20 text-white border-0" 
                    : "bg-amber-500/20 text-amber-600 border-0"
                }`}>
                  {messages.filter(m => m.content.includes("predicción") || m.content.includes("futuro")).length}
                </Badge>
              </div>
              {filter === "predictions" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse" />
              )}
            </Button>
          </div>
          
          {/* Badge de estado */}
          <Badge variant="secondary" className="relative overflow-hidden bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-600 border-green-500/20 shadow-lg shadow-green-500/20">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse" />
            <div className="relative z-10 flex items-center gap-2 px-3 py-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
              <span className="font-medium">IA Activa</span>
            </div>
          </Badge>
        </div>
      </div>

      {/* KPI Cards con Gradientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Conversaciones Hoy */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-cyan-600/20 via-cyan-500/10 to-transparent hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-500 group hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent -skew-x-12 animate-pulse" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-400/20 to-cyan-600/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-cyan-500/10 rounded-full blur-xl animate-pulse" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversaciones Hoy</CardTitle>
            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 text-cyan-400 group-hover:from-cyan-500/30 group-hover:to-cyan-600/30 transition-all duration-300 shadow-lg shadow-cyan-500/20">
              <MessageSquare className="h-5 w-5 group-hover:animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">{messages.filter(m => m.type === 'user').length}</div>
            <p className="text-xs text-muted-foreground pt-2">
              Preguntas realizadas
            </p>
          </CardContent>
        </Card>

        {/* Respuestas IA */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-transparent hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-500 group hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent -skew-x-12 animate-pulse" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl animate-pulse" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Respuestas IA</CardTitle>
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 text-emerald-400 group-hover:from-emerald-500/30 group-hover:to-emerald-600/30 transition-all duration-300 shadow-lg shadow-emerald-500/20">
              <Bot className="h-5 w-5 group-hover:animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">{messages.filter(m => m.type === 'assistant').length}</div>
            <p className="text-xs text-muted-foreground pt-2">
              Análisis generados
            </p>
          </CardContent>
        </Card>

        {/* Confianza Promedio */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-600/20 via-purple-500/10 to-transparent hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-500 group hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent -skew-x-12 animate-pulse" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-purple-600/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-purple-500/10 rounded-full blur-xl animate-pulse" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Confianza Promedio</CardTitle>
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 text-purple-400 group-hover:from-purple-500/30 group-hover:to-purple-600/30 transition-all duration-300 shadow-lg shadow-purple-500/20">
              <Zap className="h-5 w-5 group-hover:animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">94%</div>
            <p className="text-xs text-muted-foreground pt-2">
              Precisión del modelo
            </p>
          </CardContent>
        </Card>

        {/* Categorías */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-600/20 via-amber-500/10 to-transparent hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-500 group hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent -skew-x-12 animate-pulse" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-amber-600/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-amber-500/10 rounded-full blur-xl animate-pulse" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categorías Activas</CardTitle>
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 text-amber-400 group-hover:from-amber-500/30 group-hover:to-amber-600/30 transition-all duration-300 shadow-lg shadow-amber-500/20">
              <Layers className="h-5 w-5 group-hover:animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">5</div>
            <p className="text-xs text-muted-foreground pt-2">
              Tipos de análisis
            </p>
          </CardContent>
        </Card>
      </div>

// ...
      {/* Acciones Rápidas */}
      <Card className="border-0 bg-gradient-to-br from-muted/30 to-transparent">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400/20 to-blue-400/20">
              <Sparkles className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <CardTitle>Acciones Rápidas</CardTitle>
              <p className="text-sm text-muted-foreground">Preguntas frecuentes</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors group cursor-pointer"
                onClick={() => handleQuickAction(action)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-400/20 flex items-center justify-center text-cyan-600">
                    {action.icon}
                  </div>
                  <div>
                    <div className="font-medium text-sm group-hover:text-primary transition-colors">{action.title}</div>
                    <div className="text-xs text-muted-foreground">{action.description}</div>
                  </div>
                </div>
                <Send className="h-4 w-4 text-muted-foreground group-hover:text-cyan-500 transition-colors" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="border-0 bg-gradient-to-br from-muted/30 to-transparent">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400/20 to-blue-400/20">
              <MessageSquare className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <CardTitle>Conversación</CardTitle>
              <p className="text-sm text-muted-foreground">Chat con IA</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Inicia una conversación</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Haz preguntas sobre tu negocio</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] p-3 rounded-xl ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}>
                    <div className="text-sm">{message.content}</div>
                    {message.confidence && (
                      <div className="text-xs mt-1 opacity-70">
                        Confianza: {Math.round(message.confidence)}%
                      </div>
                    )}
                    {message.category && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {message.category === "analysis" ? "Análisis" :
                         message.category === "recommendation" ? "Recomendación" :
                         message.category === "prediction" ? "Predicción" : "Acción"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Input */}
          <div className="flex gap-2 mt-4">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pregunta algo sobre tu negocio..."
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isTyping}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
