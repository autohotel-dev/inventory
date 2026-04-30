import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Star } from "lucide-react";
import { EmployeePerformanceData } from "./types";

interface EmployeeListProps {
  sortedEmployees: EmployeePerformanceData[];
}

export function EmployeeList({ sortedEmployees }: EmployeeListProps) {
  return (
    <Card className="border-0 bg-gradient-to-br from-muted/30 to-transparent">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-400/20 to-indigo-400/20">
            <Users className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <CardTitle>Empleados</CardTitle>
            <p className="text-sm text-muted-foreground">Rendimiento del equipo</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedEmployees.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">No hay empleados activos</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Los empleados aparecerán aquí</p>
            </div>
          ) : (
            sortedEmployees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400/20 to-indigo-400/20 flex items-center justify-center text-purple-600 font-bold shadow-sm">
                    {employee.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div className="font-medium group-hover:text-primary transition-colors">{employee.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="capitalize">{employee.role}</span>
                      <span>•</span>
                      <Badge variant="secondary" className="text-xs">
                        {employee.status === "active"
                          ? "Activo"
                          : employee.status === "on_break"
                          ? "Pausa"
                          : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-bold">{employee.checkIns}</div>
                    <div className="text-xs text-muted-foreground">entradas</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${employee.revenue.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">ingresos</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{employee.efficiency}%</div>
                    <div className="text-xs text-muted-foreground">eficiencia</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < Math.floor(employee.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
