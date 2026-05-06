"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User, ShoppingBag, XCircle, Gift, RotateCcw, DoorOpen,
  Timer, UserPlus, Wrench, Zap, Clock, TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface EmployeeActivity {
  employee_id: string;
  employee_name: string;
  user_role: string;
  total_actions: number;
  checkouts: number;
  consumptions: number;
  cancellations: number;
  courtesies: number;
  renewals: number;
  extra_hours: number;
  extra_people: number;
  damage_charges: number;
  promos: number;
  tolerances: number;
  last_action_at: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  checkouts: <DoorOpen className="h-3 w-3" />,
  consumptions: <ShoppingBag className="h-3 w-3" />,
  cancellations: <XCircle className="h-3 w-3" />,
  courtesies: <Gift className="h-3 w-3" />,
  renewals: <RotateCcw className="h-3 w-3" />,
  extra_hours: <Timer className="h-3 w-3" />,
  extra_people: <UserPlus className="h-3 w-3" />,
  damage_charges: <Wrench className="h-3 w-3" />,
  promos: <Zap className="h-3 w-3" />,
  tolerances: <Timer className="h-3 w-3" />,
};

const ACTION_LABELS: Record<string, string> = {
  checkouts: "Checkouts",
  consumptions: "Consumos",
  cancellations: "Cancelaciones",
  courtesies: "Cortesías",
  renewals: "Renovaciones",
  extra_hours: "Hrs. Extra",
  extra_people: "Pers. Extra",
  damage_charges: "Daños",
  promos: "Promos 4H",
  tolerances: "Tolerancias",
};

const ACTION_COLORS: Record<string, string> = {
  checkouts: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  consumptions: "bg-lime-500/10 text-lime-600 dark:text-lime-400",
  cancellations: "bg-red-500/10 text-red-600 dark:text-red-400",
  courtesies: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  renewals: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  extra_hours: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  extra_people: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  damage_charges: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  promos: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  tolerances: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  gerente: "Gerente",
  receptionist: "Recepcionista",
  valet: "Cochero",
  camarista: "Camarista",
};

export function EmployeeActivityPanel() {
  const [employees, setEmployees] = useState<EmployeeActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      const supabase = createClient();
      const todayStart = new Date().toISOString().split("T")[0];

      const { data } = await supabase
        .from("audit_logs")
        .select("employee_id, employee_name, user_role, action, created_at")
        
        
        .gte("created_at", todayStart)
        ;

      if (!data) { setLoading(false); return; }

      // Agrupar por empleado
      const map = new Map<string, EmployeeActivity>();

      for (const row of data) {
        if (!row.employee_id || !row.employee_name) continue;

        if (!map.has(row.employee_id)) {
          map.set(row.employee_id, {
            employee_id: row.employee_id,
            employee_name: row.employee_name,
            user_role: row.user_role || "—",
            total_actions: 0,
            checkouts: 0,
            consumptions: 0,
            cancellations: 0,
            courtesies: 0,
            renewals: 0,
            extra_hours: 0,
            extra_people: 0,
            damage_charges: 0,
            promos: 0,
            tolerances: 0,
            last_action_at: row.created_at,
          });
        }

        const emp = map.get(row.employee_id)!;
        emp.total_actions++;

        switch (row.action) {
          case "CHECKOUT": emp.checkouts++; break;
          case "CONSUMPTION_ADDED": emp.consumptions++; break;
          case "CANCEL_ITEM": case "CANCEL_CHARGE": emp.cancellations++; break;
          case "COURTESY": emp.courtesies++; break;
          case "RENEWAL": emp.renewals++; break;
          case "EXTRA_HOUR": emp.extra_hours++; break;
          case "EXTRA_PERSON": case "ADD_PERSON": emp.extra_people++; break;
          case "DAMAGE_CHARGE": emp.damage_charges++; break;
          case "PROMO_4H": emp.promos++; break;
          case "TOLERANCE": emp.tolerances++; break;
        }
      }

      // Ordenar por total de acciones (más activo primero)
      const sorted = Array.from(map.values()).sort((a, b) => b.total_actions - a.total_actions);
      setEmployees(sorted);
      setLoading(false);
    };

    fetchActivity();
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="border-0 shadow-xl bg-background/80 backdrop-blur-xl">
        <CardContent className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl bg-background/80 backdrop-blur-xl">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          Actividad por Empleado
          <Badge variant="outline" className="text-[10px] font-mono ml-1">HOY</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[550px]">
          {employees.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin actividad de recepción hoy</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {employees.map((emp) => (
                <div key={emp.employee_id} className="px-6 py-5 hover:bg-muted/20 transition-colors">
                  {/* Header del empleado */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary text-sm border border-primary/10">
                        {emp.employee_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{emp.employee_name}</h4>
                        <span className="text-[11px] text-muted-foreground">
                          {ROLE_LABELS[emp.user_role] || emp.user_role}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-sm font-bold">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        {emp.total_actions}
                        <span className="text-[10px] text-muted-foreground font-normal">acciones</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        Última: {new Date(emp.last_action_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {/* Breakdown de acciones */}
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(ACTION_LABELS).map(([key, label]) => {
                      const count = (emp as any)[key] as number;
                      if (count === 0) return null;
                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${ACTION_COLORS[key] || "bg-muted"}`}
                        >
                          {ACTION_ICONS[key]}
                          <span>{label}</span>
                          <span className="font-bold ml-0.5">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
