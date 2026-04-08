"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  X,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  BedDouble,
  Settings,
  Smartphone,
  Mail,
  Zap,
  Shield
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subMinutes, isAfter } from "date-fns";
import { es } from "date-fns/locale";

interface SmartAlert {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  description: string;
  source: string;
  timestamp: Date;
  acknowledged: boolean;
  channels: ("dashboard" | "email" | "sms" | "push")[];
  actionRequired: boolean;
  actionText?: string;
  actionUrl?: string;
  metrics?: {
    current: number;
    threshold: number;
    trend: "up" | "down" | "stable";
  };
  autoResolve: boolean;
  escalationLevel: number;
}

interface SmartAlertsProps {
  totalRooms?: number;
  expectedRevenue?: number;
}

export function SmartAlerts({ totalRooms = 50, expectedRevenue = 15000 }: SmartAlertsProps = {}) {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");

  useEffect(() => {
    const generateSmartAlerts = async () => {
      setLoading(true);
      const supabase = createClient();
      
      try {
        const today = new Date();
        const oneHourAgo = subMinutes(today, 60);
        
        // 🧠 SISTEMA DE ALERTAS INTELIGENTES
        
        // 1. Obtener datos en tiempo real
        const { data: activeStays } = await supabase
          .from('room_stays')
          .select('id, check_in_at, status')
          .eq('status', 'ACTIVA');
        
        const { data: todayPayments } = await supabase
          .from('payments')
          .select('amount, created_at, status')
          .gte('created_at', today.toISOString().split('T')[0])
          .eq('status', 'PAGADO');
        
        const { data: recentAlerts } = await supabase
          .from('audit_logs')
          .select('created_at, severity, event_type')
          .gte('created_at', oneHourAgo.toISOString())
          .eq('severity', 'ERROR');
        
        // 2. Analizar condiciones y generar alertas inteligentes
        const smartAlerts: SmartAlert[] = [];
        
        // Alerta Crítica: Ocupación extremadamente baja
        const occupancyRate = activeStays ? (activeStays.length / totalRooms) * 100 : 0; // Asumiendo 50 habitaciones totales
        if (occupancyRate < 30) {
          smartAlerts.push({
            id: "occupancy-critical",
            type: "critical",
            title: "🚨 Ocupación Críticamente Baja",
            message: `La ocupación actual es del ${occupancyRate.toFixed(1)}%`,
            description: "La ocupación ha caído por debajo del umbral crítico del 30%. Se requiere acción inmediata para evitar pérdidas significativas.",
            source: "Sistema de Monitoreo",
            timestamp: new Date(),
            acknowledged: false,
            channels: ["dashboard", "email", "sms"],
            actionRequired: true,
            actionText: "Activar Promoción de Emergencia",
            actionUrl: "/analytics",
            metrics: {
              current: occupancyRate,
              threshold: 30,
              trend: "down"
            },
            autoResolve: false,
            escalationLevel: 3
          });
        }
        
        // Alerta Advertencia: Caída de ingresos
        const todayRevenue = todayPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
        if (todayRevenue < expectedRevenue * 0.7) {
          smartAlerts.push({
            id: "revenue-warning",
            type: "warning",
            title: "📉 Caída en Ingresos Detectada",
            message: `Ingresos actuales: $${todayRevenue.toLocaleString()} (70% below expected)`,
            description: "Los ingresos diarios están significativamente por debajo del promedio esperado. Se recomienda revisar estrategias de precios y marketing.",
            source: "Sistema Financiero",
            timestamp: new Date(),
            acknowledged: false,
            channels: ["dashboard", "email"],
            actionRequired: true,
            actionText: "Revisar Estrategia de Precios",
            actionUrl: "/analytics",
            metrics: {
              current: todayRevenue,
              threshold: expectedRevenue * 0.7,
              trend: "down"
            },
            autoResolve: false,
            escalationLevel: 2
          });
        }
        
        // Alerta Informativa: Alto volumen de errores
        if (recentAlerts && recentAlerts.length > 5) {
          smartAlerts.push({
            id: "errors-spike",
            type: "warning",
            title: "🔥 Incremento en Errores del Sistema",
            message: `Se detectaron ${recentAlerts.length} errores en la última hora`,
            description: "Hay un aumento inusual en los errores del sistema. Se recomienda revisar los logs y verificar el estado de los servicios.",
            source: "Sistema de Auditoría",
            timestamp: new Date(),
            acknowledged: false,
            channels: ["dashboard", "email"],
            actionRequired: true,
            actionText: "Ver Logs de Auditoría",
            actionUrl: "/auditoria",
            metrics: {
              current: recentAlerts.length,
              threshold: 5,
              trend: "up"
            },
            autoResolve: false,
            escalationLevel: 2
          });
        }
        
        // Alerta Éxito: Meta de ingresos alcanzada
        if (todayRevenue >= expectedRevenue) {
          smartAlerts.push({
            id: "revenue-success",
            type: "success",
            title: "🎉 Meta de Ingresos Alcanzada",
            message: `Ingresos del día: $${todayRevenue.toLocaleString()}`,
            description: "¡Excelente trabajo! Se ha alcanzado la meta de ingresos diaria. El rendimiento está superando las expectativas.",
            source: "Sistema Financiero",
            timestamp: new Date(),
            acknowledged: false,
            channels: ["dashboard", "push"],
            actionRequired: false,
            metrics: {
              current: todayRevenue,
              threshold: expectedRevenue,
              trend: "up"
            },
            autoResolve: true,
            escalationLevel: 1
          });
        }
        
        // Alerta Informativa: Actualización del sistema
        smartAlerts.push({
          id: "system-update",
          type: "info",
          title: "📊 Actualización de Métricas",
          message: "Las métricas han sido actualizadas con datos en tiempo real",
          description: "El sistema ha completado el ciclo de actualización de datos. Todas las métricas están al día con la información más reciente.",
          source: "Sistema de Analytics",
          timestamp: new Date(),
          acknowledged: false,
          channels: ["dashboard"],
          actionRequired: false,
          autoResolve: true,
          escalationLevel: 1
        });
        
        // Alerta Crítica: Sistema sin respuesta
        const lastDataUpdate = new Date(); // Simulación - en producción sería timestamp real
        const now = new Date();
        const minutesSinceUpdate = (now.getTime() - lastDataUpdate.getTime()) / (1000 * 60);
        
        if (minutesSinceUpdate > 10) {
          smartAlerts.push({
            id: "system-no-response",
            type: "critical",
            title: "🔴 Sistema Sin Respuesta",
            message: `Sin actualización de datos por ${minutesSinceUpdate.toFixed(0)} minutos`,
            description: "El sistema no ha recibido actualizaciones de datos en los últimos 10 minutos. Esto podría indicar un problema con la conexión a la base de datos o servicios críticos.",
            source: "Monitor de Sistema",
            timestamp: new Date(),
            acknowledged: false,
            channels: ["dashboard", "email", "sms"],
            actionRequired: true,
            actionText: "Verificar Estado del Sistema",
            actionUrl: "/settings",
            autoResolve: false,
            escalationLevel: 3
          });
        }
        
        setAlerts(smartAlerts);
      } catch (error) {
        console.error("Error generando alertas inteligentes:", error);
      } finally {
        setLoading(false);
      }
    };

    generateSmartAlerts();
    const interval = setInterval(generateSmartAlerts, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, []);

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const filteredAlerts = alerts.filter(alert => 
    filter === "all" || alert.type === filter
  );

  const getAlertColor = (type: string) => {
    switch (type) {
      case "critical":
        return "border-red-500/30 bg-red-500/5";
      case "warning":
        return "border-yellow-500/30 bg-yellow-500/5";
      case "info":
        return "border-blue-500/30 bg-blue-500/5";
      case "success":
        return "border-green-500/30 bg-green-500/5";
      default:
        return "border-gray-500/30 bg-gray-500/5";
    }
  };

  const getAlertBadgeColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-red-500/10 text-red-600";
      case "warning":
        return "bg-yellow-500/10 text-yellow-600";
      case "info":
        return "bg-blue-500/10 text-blue-600";
      case "success":
        return "bg-green-500/10 text-green-600";
      default:
        return "bg-gray-500/10 text-gray-600";
    }
  };

  const getAlertBorderColor = (type: string) => {
    switch (type) {
      case "critical":
        return "border-red-500";
      case "warning":
        return "border-yellow-500";
      case "info":
        return "border-blue-500";
      case "success":
        return "border-green-500";
      default:
        return "border-gray-500";
    }
  };

  const getAlertIconBg = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-red-500/10 text-red-500";
      case "warning":
        return "bg-yellow-500/10 text-yellow-600";
      case "info":
        return "bg-blue-500/10 text-blue-600";
      case "success":
        return "bg-green-500/10 text-green-600";
      default:
        return "bg-gray-500/10 text-gray-600";
    }
  };

  const getAlertGradient = (type: string) => {
    switch (type) {
      case "critical":
        return "from-red-600/20 to-red-400/10";
      case "warning":
        return "from-yellow-600/20 to-yellow-400/10";
      case "info":
        return "from-blue-600/20 to-blue-400/10";
      case "success":
        return "from-green-600/20 to-green-400/10";
      default:
        return "from-gray-600/20 to-gray-400/10";
    }
  };

  const getAlertGlow = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-red-500/20";
      case "warning":
        return "bg-yellow-500/20";
      case "info":
        return "bg-blue-500/20";
      case "success":
        return "bg-green-500/20";
      default:
        return "bg-gray-500/20";
    }
  };

  const getAlertButtonGradient = (type: string) => {
    switch (type) {
      case "critical":
        return "from-red-600 to-red-500";
      case "warning":
        return "from-yellow-600 to-yellow-500";
      case "info":
        return "from-blue-600 to-blue-500";
      case "success":
        return "from-green-600 to-green-500";
      default:
        return "from-gray-600 to-gray-500";
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return <Mail className="h-3 w-3" />;
      case "sms":
        return <Smartphone className="h-3 w-3" />;
      case "push":
        return <Bell className="h-3 w-3" />;
      default:
        return <Settings className="h-3 w-3" />;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical": return <AlertTriangle className="h-5 w-5" />;
      case "warning": return <AlertTriangle className="h-5 w-5" />;
      case "info": return <Info className="h-5 w-5" />;
      case "success": return <CheckCircle className="h-5 w-5" />;
      default: return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getEscalationColor = (level: number) => {
    switch (level) {
      case 3: return "bg-red-500/20 border-red-400/30 text-red-300";
      case 2: return "bg-yellow-500/20 border-yellow-400/30 text-yellow-300";
      case 1: return "bg-blue-500/20 border-blue-400/30 text-blue-300";
      default: return "bg-gray-500/20 border-gray-400/30 text-gray-300";
    }
  };

  // Optimize alert counts with a single pass
  const { criticalCount, warningCount, acknowledgedCount } = useMemo(() => {
    return alerts.reduce(
      (acc, alert) => {
        if (alert.type === "critical") acc.criticalCount++;
        else if (alert.type === "warning") acc.warningCount++;
        if (alert.acknowledged) acc.acknowledgedCount++;
        return acc;
      },
      { criticalCount: 0, warningCount: 0, acknowledgedCount: 0 }
    );
  }, [alerts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Bell className="h-16 w-16 mx-auto text-muted-foreground animate-pulse mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Monitoreando Sistema...</h3>
          <p className="text-muted-foreground">
            Analizando condiciones para generar alertas inteligentes
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-600 to-red-600 border border-orange-400/30 shadow-lg shadow-orange-500/25">
            <Bell className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Sistema de Alertas Inteligentes</h3>
            <p className="text-sm text-muted-foreground">Monitoreo continuo y notificaciones contextuales</p>
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
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30" 
                  : "bg-gradient-to-r from-blue-500/10 to-blue-600/10 text-blue-600 border-blue-500/20 hover:from-blue-500/20 hover:to-blue-600/20 hover:border-blue-500/30"
              }`}
            >
              <div className="relative z-10 flex items-center gap-2">
                <Bell className={`h-4 w-4 ${filter === "all" ? "text-white" : "text-blue-500"} ${filter === "all" ? "animate-pulse" : ""}`} />
                <span className="font-medium">Todas</span>
                <Badge variant="secondary" className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                  filter === "all" 
                    ? "bg-white/20 text-white border-0" 
                    : "bg-blue-500/20 text-blue-600 border-0"
                }`}>
                  {alerts.length}
                </Badge>
              </div>
              {filter === "all" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse" />
              )}
            </Button>

            {/* Botón Críticas */}
            <Button
              variant={filter === "critical" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("critical")}
              className={`relative overflow-hidden transition-all duration-500 hover:scale-105 ${
                filter === "critical" 
                  ? "bg-gradient-to-r from-red-600 to-red-500 text-white border-0 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30" 
                  : "bg-gradient-to-r from-red-500/10 to-red-600/10 text-red-600 border-red-500/20 hover:from-red-500/20 hover:to-red-600/20 hover:border-red-500/30"
              }`}
            >
              <div className="relative z-10 flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${filter === "critical" ? "text-white" : "text-red-500"} ${filter === "critical" ? "animate-pulse" : ""}`} />
                <span className="font-medium">Críticas</span>
                <Badge variant="secondary" className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                  filter === "critical" 
                    ? "bg-white/20 text-white border-0" 
                    : "bg-red-500/20 text-red-600 border-0"
                }`}>
                  {criticalCount}
                </Badge>
              </div>
              {filter === "critical" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse" />
              )}
            </Button>

            {/* Botón Advertencias */}
            <Button
              variant={filter === "warning" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("warning")}
              className={`relative overflow-hidden transition-all duration-500 hover:scale-105 ${
                filter === "warning" 
                  ? "bg-gradient-to-r from-yellow-600 to-yellow-500 text-white border-0 shadow-lg shadow-yellow-500/25 hover:shadow-xl hover:shadow-yellow-500/30" 
                  : "bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 text-yellow-600 border-yellow-500/20 hover:from-yellow-500/20 hover:to-yellow-600/20 hover:border-yellow-500/30"
              }`}
            >
              <div className="relative z-10 flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${filter === "warning" ? "text-white" : "text-yellow-500"} ${filter === "warning" ? "animate-pulse" : ""}`} />
                <span className="font-medium">Advertencias</span>
                <Badge variant="secondary" className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                  filter === "warning" 
                    ? "bg-white/20 text-white border-0" 
                    : "bg-yellow-500/20 text-yellow-600 border-0"
                }`}>
                  {warningCount}
                </Badge>
              </div>
              {filter === "warning" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse" />
              )}
            </Button>
          </div>
          
          {/* Badge de estado */}
          <Badge variant="secondary" className="relative overflow-hidden bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-600 border-green-500/20 shadow-lg shadow-green-500/20">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse" />
            <div className="relative z-10 flex items-center gap-2 px-3 py-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
              <span className="font-medium">Monitoreo Activo</span>
            </div>
          </Badge>
        </div>
      </div>

      {/* KPI Cards con Gradientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Alertas */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-600/20 via-blue-500/10 to-transparent hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 group hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent -skew-x-12 animate-pulse" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-blue-600/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-500/10 rounded-full blur-xl animate-pulse" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Alertas</CardTitle>
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 text-blue-400 group-hover:from-blue-500/30 group-hover:to-blue-600/30 transition-all duration-300 shadow-lg shadow-blue-500/20">
              <Bell className="h-5 w-5 group-hover:animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">{alerts.length}</div>
            <p className="text-xs text-muted-foreground pt-2">
              Alertas registradas
            </p>
          </CardContent>
        </Card>

        {/* Críticas */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-red-600/20 via-red-500/10 to-transparent hover:shadow-2xl hover:shadow-red-500/20 transition-all duration-500 group hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/5 to-transparent -skew-x-12 animate-pulse" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400/20 to-red-600/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-red-500/10 rounded-full blur-xl animate-pulse" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Críticas</CardTitle>
            <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20 text-red-400 group-hover:from-red-500/30 group-hover:to-red-600/30 transition-all duration-300 shadow-lg shadow-red-500/20">
              <AlertTriangle className="h-5 w-5 group-hover:animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">{criticalCount}</div>
            <p className="text-xs text-muted-foreground pt-2">
              Requieren acción inmediata
            </p>
          </CardContent>
        </Card>

        {/* Advertencias */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-yellow-600/20 via-yellow-500/10 to-transparent hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-500 group hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/5 to-transparent -skew-x-12 animate-pulse" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-yellow-500/10 rounded-full blur-xl animate-pulse" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Advertencias</CardTitle>
            <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 text-yellow-400 group-hover:from-yellow-500/30 group-hover:to-yellow-600/30 transition-all duration-300 shadow-lg shadow-yellow-500/20">
              <AlertTriangle className="h-5 w-5 group-hover:animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">{warningCount}</div>
            <p className="text-xs text-muted-foreground pt-2">
              Necesitan atención
            </p>
          </CardContent>
        </Card>

        {/* Resueltas */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-600/20 via-green-500/10 to-transparent hover:shadow-2xl hover:shadow-green-500/20 transition-all duration-500 group hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/5 to-transparent -skew-x-12 animate-pulse" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-green-600/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-green-500/10 rounded-full blur-xl animate-pulse" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resueltas</CardTitle>
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 text-green-400 group-hover:from-green-500/30 group-hover:to-green-600/30 transition-all duration-300 shadow-lg shadow-green-500/20">
              <CheckCircle className="h-5 w-5 group-hover:animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">{acknowledgedCount}</div>
            <p className="text-xs text-muted-foreground pt-2">
              Alertas atendidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Alertas */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-muted/40 to-transparent hover:shadow-lg hover:shadow-muted/20 transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted/10 to-transparent -skew-x-12 animate-pulse" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-muted/20 to-muted/30 rounded-full blur-3xl" />
        <CardHeader className="flex flex-row items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 text-orange-400 shadow-lg shadow-orange-500/20 hover:from-orange-500/30 hover:to-red-500/30 transition-all duration-300">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">Alertas Activas</CardTitle>
              <p className="text-sm text-muted-foreground">Notificaciones del sistema</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-12 relative z-10">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <CheckCircle className="h-10 w-10 text-green-400" />
                </div>
                <p className="text-muted-foreground font-medium text-lg">Todo en Orden</p>
                <p className="text-sm text-muted-foreground/70 mt-1">No hay alertas activas</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredAlerts.map((alert, index) => (
                  <Card 
                    key={alert.id}
                    className={`relative overflow-hidden border-0 backdrop-blur-sm transition-all duration-700 hover:scale-[1.02] hover:shadow-2xl group animate-in fade-in slide-in-from-bottom-2`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Efectos holográficos */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${getAlertGradient(alert.type)} opacity-10`} />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl ${getAlertGlow(alert.type)} group-hover:scale-150 transition-transform duration-700`} />
                    <div className={`absolute -top-2 -right-2 w-16 h-16 rounded-full blur-xl ${getAlertGlow(alert.type)} animate-pulse`} />
                    
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-start justify-between gap-6">
                        {/* Icono y información */}
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`relative group-hover:scale-110 transition-transform duration-300`}>
                            <div className={`absolute inset-0 rounded-2xl ${getAlertGlow(alert.type)} blur-md animate-pulse`} />
                            <div className={`relative w-14 h-14 rounded-2xl ${getAlertIconBg(alert.type)} flex items-center justify-center shadow-xl border border-white/10`}>
                              {getAlertIcon(alert.type)}
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <h4 className="text-lg font-semibold group-hover:text-primary transition-colors">{alert.title}</h4>
                              <Badge variant="secondary" className={`text-xs px-3 py-1 rounded-full ${getAlertBadgeColor(alert.type)} shadow-md border-0`}>
                                {alert.type === "critical" ? "Crítica" :
                                 alert.type === "warning" ? "Advertencia" :
                                 alert.type === "info" ? "Info" : "Éxito"}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">{alert.message}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(alert.timestamp, "HH:mm", { locale: es })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                {alert.source}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Acciones */}
                        <div className="flex items-center gap-2">
                          {alert.actionRequired && (
                            <Button
                              size="sm"
                              onClick={() => window.open(alert.actionUrl, '_blank')}
                              className={`bg-gradient-to-r ${getAlertButtonGradient(alert.type)} border border-white/20 text-white hover:shadow-lg transition-all duration-300 shadow-md`}
                            >
                              {alert.actionText || "Revisar"}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="bg-background/50 border border-border/50 hover:bg-background/70 transition-all duration-300"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
