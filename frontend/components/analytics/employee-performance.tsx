"use client";

import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, CheckCircle } from "lucide-react";
import { useEmployeePerformance } from "@/hooks/analytics/use-employee-performance";
import { EmployeeSkeleton } from "./employee-performance/employee-skeleton";
import { EmployeeKpiCards } from "./employee-performance/employee-kpi-cards";
import { EmployeeFilters } from "./employee-performance/employee-filters";
import { EmployeeList } from "./employee-performance/employee-list";

export function EmployeePerformance() {
  const {
    employees,
    sortedEmployees,
    loading,
    searchTerm,
    setSearchTerm,
    roleFilter,
    setRoleFilter,
    sortBy,
    setSortBy,
  } = useEmployeePerformance();

  if (loading) {
    return <EmployeeSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 border border-purple-400/30 shadow-lg shadow-purple-500/25">
            <Users className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Desempeño de Empleados</h3>
            <p className="text-sm text-muted-foreground mt-1">Seguimiento en tiempo real del rendimiento del equipo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-0">
            <CheckCircle className="h-3 w-3 mr-1" />
            {employees.length} Activos
          </Badge>
          <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-0">
            <TrendingUp className="h-3 w-3 mr-1" />
            Monitoreo Activo
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <EmployeeFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      {/* KPI Cards */}
      <EmployeeKpiCards employees={employees} />

      {/* Employee List */}
      <EmployeeList sortedEmployees={sortedEmployees} />
    </div>
  );
}
