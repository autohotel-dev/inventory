"use client";

import { ScheduleCalendar } from "@/components/employees/schedule-calendar";
import { RoleGuard } from "@/components/auth/role-guard";

export default function SchedulesPage() {
  return (
    <RoleGuard requireAdmin>
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Horarios de Empleados</h1>
          <p className="text-muted-foreground">
            Asigna turnos y días de descanso a los empleados
          </p>
        </div>
        <ScheduleCalendar />
      </div>
    </RoleGuard>
  );
}
