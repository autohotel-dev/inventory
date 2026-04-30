import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, DollarSign, Star } from "lucide-react";
import { EmployeePerformanceData } from "./types";

interface EmployeeKpiCardsProps {
  employees: EmployeePerformanceData[];
}

export function EmployeeKpiCards({ employees }: EmployeeKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Empleados */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Empleados</CardTitle>
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
            <Users className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{employees.length}</div>
          <p className="text-xs text-muted-foreground pt-2">Personal registrado</p>
        </CardContent>
      </Card>

      {/* Activos Hoy */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Activos Hoy</CardTitle>
          <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
            <CheckCircle className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{employees.filter((e) => e.status === "active").length}</div>
          <p className="text-xs text-muted-foreground pt-2">Empleados en turno</p>
        </CardContent>
      </Card>

      {/* Total Ingresos */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Hoy</CardTitle>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <DollarSign className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${employees.reduce((sum, e) => sum + e.revenue, 0).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground pt-2">Generados por el equipo</p>
        </CardContent>
      </Card>

      {/* Rating Promedio */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Rating Promedio</CardTitle>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
            <Star className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {employees.length > 0 ? (employees.reduce((sum, e) => sum + e.rating, 0) / employees.length).toFixed(1) : "0.0"}
          </div>
          <p className="text-xs text-muted-foreground pt-2">Calificación del equipo</p>
        </CardContent>
      </Card>
    </div>
  );
}
