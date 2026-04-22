"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Activity, Users } from "lucide-react";

export interface SLAViolation {
  entity_id: string;
  entity_type: string;
  description: string;
  employee_name: string;
  minutes_elapsed: number;
  severity: string;
}

export function InefficiencyAlerts() {
  const [violations, setViolations] = useState<SLAViolation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchViolations = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_active_sla_violations');
      
      if (error) {
        console.error("Error fetching SLA violations:", error);
        return;
      }
      
      setViolations(data || []);
    } catch (error) {
      console.error("Exception fetching SLA violations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();
    // Poll every 30 seconds
    const interval = setInterval(fetchViolations, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-muted/50 rounded-xl" />
        <div className="h-24 bg-muted/50 rounded-xl" />
      </div>
    );
  }

  if (violations.length === 0) {
    return (
      <Card className="border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent">
        <CardContent className="flex items-center justify-center p-6 gap-3">
          <div className="p-2 rounded-full bg-green-500/20 text-green-500">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-green-700 dark:text-green-400">Operación Óptima</h3>
            <p className="text-sm text-green-600/80 dark:text-green-500/80">No hay retrasos críticos en el sistema.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold flex items-center gap-2 text-red-500">
          <AlertTriangle className="h-5 w-5" />
          Alertas de Rendimiento (Tiempo Real)
        </h3>
        <Badge variant="destructive" className="font-bold">
          {violations.length} Alertas Activas
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {violations.map((violation, i) => (
          <Card 
            key={`${violation.entity_id}-${i}`}
            className={`border-0 shadow-sm relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
              violation.severity === 'CRITICAL' 
                ? 'bg-gradient-to-br from-red-500/20 to-rose-500/5 border-l-4 border-red-500' 
                : 'bg-gradient-to-br from-orange-500/20 to-amber-500/5 border-l-4 border-orange-500'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <Badge variant={violation.severity === 'CRITICAL' ? 'destructive' : 'default'} className={violation.severity !== 'CRITICAL' ? 'bg-orange-500' : ''}>
                  {violation.entity_type}
                </Badge>
                <div className="flex items-center text-sm font-bold opacity-80 gap-1">
                  <Clock className="h-4 w-4" />
                  {violation.minutes_elapsed} min
                </div>
              </div>
              
              <p className="font-semibold text-foreground mb-1">
                {violation.description}
              </p>
              
              <div className="flex items-center text-sm text-muted-foreground gap-1.5 mt-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">{violation.employee_name}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
