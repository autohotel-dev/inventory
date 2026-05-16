"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Coffee,
  Loader2,
  Save,
  RotateCcw,
  Calendar,
  LifeBuoy,
} from "lucide-react";
import { Employee, ShiftDefinition, EmployeeSchedule, SHIFT_COLORS } from "./types";

// Días de la semana
const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Iconos y colores por turno
const SHIFT_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string; ring: string }> = {
  MORNING: { 
    icon: <Sun className="h-3.5 w-3.5" />, 
    label: "Mañana", 
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300",
    ring: "focus:ring-amber-500/30 hover:border-amber-300 dark:hover:border-amber-500/50"
  },
  AFTERNOON: { 
    icon: <Sunset className="h-3.5 w-3.5" />, 
    label: "Tarde", 
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300",
    ring: "focus:ring-blue-500/30 hover:border-blue-300 dark:hover:border-blue-500/50"
  },
  NIGHT: { 
    icon: <Moon className="h-3.5 w-3.5" />, 
    label: "Noche", 
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300",
    ring: "focus:ring-purple-500/30 hover:border-purple-300 dark:hover:border-purple-500/50"
  },
  COMODIN: {
    icon: <LifeBuoy className="h-3.5 w-3.5" />,
    label: "Comodín",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300",
    ring: "focus:ring-emerald-500/30 hover:border-emerald-300 dark:hover:border-emerald-500/50"
  },
  OFF: { 
    icon: <Coffee className="h-3.5 w-3.5" />, 
    label: "Descanso", 
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
    ring: "focus:ring-slate-500/30 hover:border-slate-300 dark:hover:border-slate-700"
  },
};

type ShiftValue = "MORNING" | "AFTERNOON" | "NIGHT" | "COMODIN" | "OFF" | "NONE";

interface ScheduleCell {
  date: string;
  shift: ShiftValue;
  scheduleId?: string;
  isDayOff: boolean;
}

interface EmployeeRow {
  employee: Employee;
  cells: ScheduleCell[];
}

export function ScheduleCalendar() {
  const supabase = createClient();
  const { success, error: showError } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replicateToMonth, setReplicateToMonth] = useState(true);

  // Semana actual
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    return new Date(today.setDate(diff));
  });

  // Cambios pendientes
  const [pendingChanges, setPendingChanges] = useState<Map<string, { shift: ShiftValue; isDayOff: boolean }>>(new Map());

  // Obtener días de la semana
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [weekStart]);

  // Formatear fecha para mostrar
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  };

  // Formatear fecha para BD
  const toDateString = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  // Cargar datos
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = toDateString(weekDays[0]);
      const endDate = toDateString(weekDays[6]);

      const [employeesRes, shiftsRes, schedulesRes] = await Promise.all([
        supabase
          .from("employees")
          .select("*")
          .eq("is_active", true)
          .in("role", ["receptionist", "manager"])
          .order("first_name"),
        supabase
          .from("shift_definitions")
          .select("*")
          .eq("is_active", true)
          .order("start_time"),
        supabase
          .from("employee_schedules")
          .select("*, shift_definitions:shift_definition_id(*)")
          .gte("schedule_date", startDate)
          .lte("schedule_date", endDate),
      ]);

      if (employeesRes.error) throw employeesRes.error;
      if (shiftsRes.error) throw shiftsRes.error;
      if (schedulesRes.error) throw schedulesRes.error;

      setEmployees(employeesRes.data || []);
      setShifts(shiftsRes.data || []);
      setSchedules(schedulesRes.data || []);
      setPendingChanges(new Map());
    } catch (err: any) {
      console.error("Error loading data:", err);
      if (err?.code === "42P01" || err?.message?.includes("does not exist")) {
        showError("Tablas no encontradas", "Ejecuta el script SQL en Supabase");
      } else {
        showError("Error", err?.message || "No se pudieron cargar los datos");
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, weekDays, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Construir filas de empleados con sus celdas
  const employeeRows: EmployeeRow[] = useMemo(() => {
    return employees.map((employee) => {
      const cells: ScheduleCell[] = weekDays.map((day) => {
        const dateStr = toDateString(day);
        const key = `${employee.id}-${dateStr}`;
        
        // Verificar si hay cambio pendiente
        const pending = pendingChanges.get(key);
        if (pending) {
          return {
            date: dateStr,
            shift: pending.shift,
            isDayOff: pending.isDayOff,
          };
        }

        // Buscar horario existente
        const schedule = schedules.find(
          (s) => s.employee_id === employee.id && s.schedule_date === dateStr
        );

        if (schedule) {
          return {
            date: dateStr,
            shift: schedule.is_day_off ? "OFF" : (schedule.shift_definitions?.code as ShiftValue) || "NONE",
            scheduleId: schedule.id,
            isDayOff: schedule.is_day_off,
          };
        }

        return { date: dateStr, shift: "NONE", isDayOff: false };
      });

      return { employee, cells };
    });
  }, [employees, weekDays, schedules, pendingChanges]);

  // Cambiar turno de una celda
  const handleCellChange = (employeeId: string, date: string, newShift: ShiftValue) => {
    const key = `${employeeId}-${date}`;
    const isDayOff = newShift === "OFF";
    
    setPendingChanges((prev) => {
      const newMap = new Map(prev);
      if (newShift === "NONE") {
        newMap.delete(key);
      } else {
        newMap.set(key, { shift: newShift, isDayOff });
      }
      return newMap;
    });
  };

  // Guardar todos los cambios
  const handleSaveAll = async () => {
    if (pendingChanges.size === 0) return;

    setSaving(true);
    try {
      const operations: PromiseLike<any>[] = [];
      const newSchedulesToFetch = new Set<string>(); // Keep track of months we need to refetch if we replicated

      for (const [key, value] of pendingChanges) {
        const [employeeId, date] = key.split("-").reduce((acc, part, idx) => {
          if (idx < 5) {
            // UUID tiene 5 partes separadas por guiones
            acc[0] = acc[0] ? `${acc[0]}-${part}` : part;
          } else {
            acc[1] = acc[1] ? `${acc[1]}-${part}` : part;
          }
          return acc;
        }, ["", ""] as [string, string]);

        const shiftDef = shifts.find((s) => s.code === value.shift);

        // Calcular las fechas a modificar
        const datesToUpdate = [date];
        if (replicateToMonth) {
          // Obtener todas las fechas futuras del mismo mes que coincidan con el día de la semana
          // Asume que 'date' viene en formato YYYY-MM-DD local
          const [year, month, day] = date.split('-').map(Number);
          const baseDate = new Date(year, month - 1, day);
          
          let nextDate = new Date(baseDate);
          nextDate.setDate(nextDate.getDate() + 7);
          
          while (nextDate.getMonth() === (month - 1)) {
            // Formatear manualmente para evitar problemas de zona horaria
            const nextYear = nextDate.getFullYear();
            const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
            const nextDay = String(nextDate.getDate()).padStart(2, '0');
            datesToUpdate.push(`${nextYear}-${nextMonth}-${nextDay}`);
            
            nextDate.setDate(nextDate.getDate() + 7);
          }
        }

        for (const targetDate of datesToUpdate) {
          // Buscar si ya existe un schedule para este empleado y esta fecha
          const existing = schedules.find(
            (s) => s.employee_id === employeeId && s.schedule_date === targetDate
          );

          if (existing) {
            // Actualizar
            operations.push(
              supabase
                .from("employee_schedules")
                .update({
                  shift_definition_id: value.isDayOff ? null : shiftDef?.id,
                  is_day_off: value.isDayOff,
                })
                .eq("id", existing.id)
                .then()
            );
          } else {
            // Insertar
            operations.push(
              supabase.from("employee_schedules").insert({
                employee_id: employeeId,
                schedule_date: targetDate,
                shift_definition_id: value.isDayOff ? null : shiftDef?.id,
                is_day_off: value.isDayOff,
              }).then()
            );
          }
        }
      }

      await Promise.all(operations);
      success("Guardado", `Se guardaron ${pendingChanges.size} cambios`);
      loadData();
    } catch (err: any) {
      console.error("Error saving:", err);
      showError("Error", err.message || "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  // Descartar cambios
  const handleDiscard = () => {
    setPendingChanges(new Map());
  };

  // Navegar semanas
  const goToPrevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    setWeekStart(new Date(today.setDate(diff)));
  };

  // Verificar si es hoy
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con navegación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1.5 rounded-2xl shadow-sm backdrop-blur-md">
          <Button variant="ghost" size="icon" onClick={goToPrevWeek} className="rounded-xl h-9 w-9 hover:bg-slate-100 dark:hover:bg-white/10">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={goToCurrentWeek} className="rounded-xl h-9 px-4 font-medium hover:bg-slate-100 dark:hover:bg-white/10 text-primary">
            <Calendar className="h-4 w-4 mr-2" />
            Hoy
          </Button>
          <Button variant="ghost" size="icon" onClick={goToNextWeek} className="rounded-xl h-9 w-9 hover:bg-slate-100 dark:hover:bg-white/10">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-2" />
          <span className="font-semibold text-sm px-2 text-foreground/80 tracking-tight">
            {formatDate(weekDays[0])} <span className="text-muted-foreground mx-1">-</span> {formatDate(weekDays[6])}
          </span>
        </div>

        {/* Botones de guardar/descartar */}
        {pendingChanges.size > 0 && (
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 bg-primary/5 border border-primary/20 p-2 rounded-2xl animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3 bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/5">
              <Switch 
                id="replicate-mode" 
                checked={replicateToMonth}
                onCheckedChange={setReplicateToMonth}
                className="data-[state=checked]:bg-primary"
              />
              <Label htmlFor="replicate-mode" className="text-xs font-semibold cursor-pointer select-none">
                Replicar al resto del mes
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30 border-none shadow-none font-bold">
                {pendingChanges.size} cambios
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleDiscard} className="rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors">
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Descartar
              </Button>
              <Button size="sm" onClick={handleSaveAll} disabled={saving} className="rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-bold">
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                Guardar Cambios
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Leyenda de turnos */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(SHIFT_CONFIG).map(([code, config]) => (
          <div key={code} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${config.bg.split(' ')[0]} bg-opacity-20 border-opacity-30 ${config.color.replace('text-', 'border-').replace('700', '200')} dark:bg-opacity-10 dark:border-opacity-20`}>
            <div className={`p-1 rounded-full bg-white dark:bg-black/20 shadow-sm ${config.color}`}>
              {config.icon}
            </div>
            <span className={config.color}>{config.label}</span>
          </div>
        ))}
      </div>

      {/* Tabla de horarios */}
      <Card className="border-none shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden bg-white/50 dark:bg-zinc-950/50 backdrop-blur-xl">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                <th className="text-left p-4 font-semibold text-sm text-slate-500 dark:text-slate-400 w-56">Colaborador</th>
                {weekDays.map((day, idx) => {
                  const isCurrentDay = isToday(day);
                  return (
                    <th
                      key={idx}
                      className={`text-center p-3 transition-colors ${
                        isCurrentDay ? "bg-primary/5 border-b-2 border-b-primary" : ""
                      }`}
                    >
                      <div className={`text-[11px] font-bold uppercase tracking-wider ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}>
                        {DAYS_SHORT[day.getDay()]}
                      </div>
                      <div className={`text-xl font-black mt-0.5 ${isCurrentDay ? "text-primary" : "text-foreground"}`}>
                        {day.getDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {employeeRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Calendar className="h-8 w-8 opacity-20" />
                      <p>No hay colaboradores registrados</p>
                    </div>
                  </td>
                </tr>
              ) : (
                employeeRows.map(({ employee, cells }) => (
                  <tr key={employee.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-white/20 shadow-sm">
                          <AvatarImage src={employee.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {employee.first_name[0]}{employee.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-foreground">
                            {employee.first_name} {employee.last_name}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {employee.role}
                          </span>
                        </div>
                      </div>
                    </td>
                    {cells.map((cell, idx) => {
                      const hasChange = pendingChanges.has(`${employee.id}-${cell.date}`);
                      const isCurrentDay = isToday(weekDays[idx]);
                      const shiftConfig = cell.shift !== "NONE" ? SHIFT_CONFIG[cell.shift] : null;

                      return (
                        <td
                          key={idx}
                          className={`p-2 relative group transition-colors ${
                            isCurrentDay ? "bg-primary/[0.02]" : ""
                          }`}
                        >
                          {isCurrentDay && (
                            <>
                              <div className="absolute inset-y-0 left-0 w-px bg-primary/10" />
                              <div className="absolute inset-y-0 right-0 w-px bg-primary/10" />
                            </>
                          )}
                          <Select
                            value={cell.shift}
                            onValueChange={(val) =>
                              handleCellChange(employee.id, cell.date, val as ShiftValue)
                            }
                          >
                            <SelectTrigger
                              className={`h-11 w-full border-transparent hover:border-slate-200 dark:hover:border-white/10 shadow-none transition-all duration-200 rounded-xl flex items-center justify-center px-2 ${
                                shiftConfig 
                                  ? `${shiftConfig.bg} border ${shiftConfig.ring}`
                                  : "bg-transparent text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-white/5"
                              } ${hasChange ? "ring-2 ring-primary ring-offset-1 dark:ring-offset-black" : ""}`}
                            >
                              <SelectValue placeholder={
                                <div className="flex items-center justify-center w-full opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-xl">+</span>
                                </div>
                              }>
                                {shiftConfig ? (
                                  <div className="flex items-center justify-center gap-1.5 w-full">
                                    <span className={shiftConfig.color}>{shiftConfig.icon}</span>
                                    <span className="font-semibold text-[11px] uppercase tracking-wider hidden xl:inline-block">
                                      {shiftConfig.label}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center w-full opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                                    <span className="text-xl leading-none font-light">+</span>
                                  </div>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-white/10 shadow-xl">
                              <SelectItem value="NONE" className="rounded-lg mb-1">
                                <span className="text-muted-foreground font-medium text-xs">Sin asignar</span>
                              </SelectItem>
                              {shifts.map((shift) => {
                                const conf = SHIFT_CONFIG[shift.code];
                                return (
                                  <SelectItem key={shift.id} value={shift.code} className="rounded-lg mb-1">
                                    <div className="flex items-center gap-2">
                                      <div className={`p-1.5 rounded-md ${conf?.bg}`}>
                                        {conf?.icon}
                                      </div>
                                      <span className="font-semibold text-sm">{shift.name}</span>
                                      <span className="text-[10px] text-muted-foreground ml-2 font-mono bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                        {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                              <div className="h-px bg-slate-100 dark:bg-white/10 my-1" />
                              <SelectItem value="OFF" className="rounded-lg">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-md ${SHIFT_CONFIG["OFF"].bg}`}>
                                    {SHIFT_CONFIG["OFF"].icon}
                                  </div>
                                  <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Día de Descanso</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Instrucciones */}
      <p className="text-sm text-muted-foreground text-center">
        💡 Haz clic en cada celda para asignar un turno. Los cambios se guardan al presionar &quot;Guardar&quot;.
      </p>
    </div>
  );
}
