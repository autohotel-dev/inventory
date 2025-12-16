"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { Employee, ShiftDefinition, EmployeeSchedule, SHIFT_COLORS } from "./types";

// Días de la semana
const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Iconos y colores por turno
const SHIFT_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  MORNING: { 
    icon: <Sun className="h-4 w-4" />, 
    label: "Mañana", 
    color: "text-yellow-700",
    bg: "bg-yellow-400 hover:bg-yellow-500 border-yellow-500 text-yellow-900"
  },
  AFTERNOON: { 
    icon: <Sunset className="h-4 w-4" />, 
    label: "Tarde", 
    color: "text-orange-700",
    bg: "bg-orange-400 hover:bg-orange-500 border-orange-500 text-orange-900"
  },
  NIGHT: { 
    icon: <Moon className="h-4 w-4" />, 
    label: "Noche", 
    color: "text-blue-700",
    bg: "bg-blue-500 hover:bg-blue-600 border-blue-600 text-white"
  },
  OFF: { 
    icon: <Coffee className="h-4 w-4" />, 
    label: "Descanso", 
    color: "text-slate-600",
    bg: "bg-slate-300 hover:bg-slate-400 border-slate-400 text-slate-700"
  },
};

type ShiftValue = "MORNING" | "AFTERNOON" | "NIGHT" | "OFF" | "NONE";

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
  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, [weekStart]);

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

        // Buscar si ya existe un schedule
        const existing = schedules.find(
          (s) => s.employee_id === employeeId && s.schedule_date === date
        );

        const shiftDef = shifts.find((s) => s.code === value.shift);

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
              schedule_date: date,
              shift_definition_id: value.isDayOff ? null : shiftDef?.id,
              is_day_off: value.isDayOff,
            }).then()
          );
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
    <div className="space-y-4">
      {/* Header con navegación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToCurrentWeek}>
            <Calendar className="h-4 w-4 mr-2" />
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 font-medium">
            {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
          </span>
        </div>

        {/* Botones de guardar/descartar */}
        {pendingChanges.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{pendingChanges.size} cambios</Badge>
            <Button variant="outline" size="sm" onClick={handleDiscard}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Descartar
            </Button>
            <Button size="sm" onClick={handleSaveAll} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Guardar
            </Button>
          </div>
        )}
      </div>

      {/* Leyenda de turnos */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(SHIFT_CONFIG).map(([code, config]) => (
          <Badge key={code} variant="outline" className={`${config.bg} border`}>
            {config.icon}
            <span className="ml-1">{config.label}</span>
          </Badge>
        ))}
      </div>

      {/* Tabla de horarios */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium w-48">Empleado</th>
                {weekDays.map((day, idx) => (
                  <th
                    key={idx}
                    className={`text-center p-2 font-medium ${
                      isToday(day) ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">{DAYS_SHORT[day.getDay()]}</div>
                    <div className={isToday(day) ? "text-primary font-bold" : ""}>
                      {day.getDate()}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employeeRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay empleados registrados
                  </td>
                </tr>
              ) : (
                employeeRows.map(({ employee, cells }) => (
                  <tr key={employee.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {employee.role}
                      </div>
                    </td>
                    {cells.map((cell, idx) => {
                      const hasChange = pendingChanges.has(`${employee.id}-${cell.date}`);
                      return (
                        <td
                          key={idx}
                          className={`p-1 text-center ${
                            isToday(weekDays[idx]) ? "bg-primary/5" : ""
                          }`}
                        >
                          <Select
                            value={cell.shift}
                            onValueChange={(val) =>
                              handleCellChange(employee.id, cell.date, val as ShiftValue)
                            }
                          >
                            <SelectTrigger
                              className={`h-10 w-full text-xs ${
                                cell.shift && SHIFT_CONFIG[cell.shift]
                                  ? SHIFT_CONFIG[cell.shift].bg
                                  : "bg-white hover:bg-gray-50"
                              } ${hasChange ? "ring-2 ring-primary" : ""}`}
                            >
                              <SelectValue placeholder="-">
                                {cell.shift && SHIFT_CONFIG[cell.shift] ? (
                                  <span className="flex items-center justify-center gap-1">
                                    {SHIFT_CONFIG[cell.shift].icon}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">
                                <span className="text-muted-foreground">Sin asignar</span>
                              </SelectItem>
                              {shifts.map((shift) => (
                                <SelectItem key={shift.id} value={shift.code}>
                                  <span className="flex items-center gap-2">
                                    {SHIFT_CONFIG[shift.code]?.icon}
                                    {shift.name}
                                    <span className="text-xs text-muted-foreground">
                                      ({shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)})
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                              <SelectItem value="OFF">
                                <span className="flex items-center gap-2">
                                  <Coffee className="h-4 w-4" />
                                  Descanso
                                </span>
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
        💡 Haz clic en cada celda para asignar un turno. Los cambios se guardan al presionar "Guardar".
      </p>
    </div>
  );
}
