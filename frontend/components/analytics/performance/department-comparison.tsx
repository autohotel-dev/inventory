"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PerformanceScoreBar } from "./performance-score-bar";
import {
  EmployeeRanking,
  getScoreColor,
  getTrendIcon,
} from "./types";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Medal,
  Target,
} from "lucide-react";

interface DepartmentComparisonProps {
  rankings: EmployeeRanking[];
  loading: boolean;
}

function TrendArrow({ pct }: { pct: number }) {
  const { icon, color } = getTrendIcon(pct);
  const Icon = icon === "up" ? TrendingUp : icon === "down" ? TrendingDown : Minus;

  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-sm">
        <Crown className="h-3.5 w-3.5 text-white" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 shadow-sm">
        <Medal className="h-3.5 w-3.5 text-white" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 shadow-sm">
        <Medal className="h-3.5 w-3.5 text-white" />
      </div>
    );
  return (
    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold">
      {rank}
    </div>
  );
}

function getDepartmentLabel(role: string): string {
  switch (role.toLowerCase()) {
    case "cochero":
    case "valet":
      return "Cochero";
    case "recepcionista":
    case "receptionist":
      return "Recepción";
    case "camarista":
    case "recamarista":
      return "Camarista";
    default:
      return role;
  }
}

function getDepartmentColor(role: string): string {
  switch (role.toLowerCase()) {
    case "cochero":
    case "valet":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "recepcionista":
    case "receptionist":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
    case "camarista":
    case "recamarista":
      return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function DepartmentComparison({
  rankings,
  loading,
}: DepartmentComparisonProps) {
  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 bg-muted rounded" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-muted/50 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (rankings.length === 0) {
    return (
      <Card className="border-0 shadow-sm bg-gradient-to-br from-muted/30 to-transparent">
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No hay datos de ranking para este periodo</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Separate by department
  const departments = ["cochero", "recepcionista", "camarista"];
  const summaries = departments.map((dept) => {
    const deptEmployees = rankings.filter(
      (r) => r.employee_role.toLowerCase() === dept
    );
    if (deptEmployees.length === 0) return null;

    const avgScore =
      deptEmployees.reduce((sum, e) => sum + Number(e.performance_score || 0), 0) /
      deptEmployees.length;
    const avgSla =
      deptEmployees.reduce((sum, e) => sum + Number(e.sla_compliance_pct || 0), 0) /
      deptEmployees.length;
    const best = deptEmployees[0]; // already sorted by rank
    const totalActions = deptEmployees.reduce(
      (sum, e) => sum + Number(e.total_actions || 0),
      0
    );

    return { dept, deptEmployees, avgScore, avgSla, best, totalActions };
  }).filter(Boolean) as NonNullable<ReturnType<typeof departments.map>>;

  return (
    <div className="space-y-6">
      {/* Department Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaries.map((s: any) => (
          <Card
            key={s.dept}
            className="border-0 shadow-sm bg-gradient-to-br from-muted/50 to-transparent hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge
                  variant="secondary"
                  className={`${getDepartmentColor(s.dept)} border-0 font-semibold`}
                >
                  {getDepartmentLabel(s.dept)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {s.deptEmployees.length} empleados
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">
                    Score Promedio
                  </p>
                  <PerformanceScoreBar score={s.avgScore} size="sm" showLabel={false} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">SLA Compliance</span>
                  <span className={`font-bold ${getScoreColor(s.avgSla)}`}>
                    {s.avgSla.toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Acciones totales</span>
                  <span className="font-bold">{s.totalActions}</span>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-1">Mejor</p>
                  <div className="flex items-center gap-2">
                    <RankBadge rank={1} />
                    <span className="text-sm font-semibold truncate">
                      {s.best.employee_name}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unified Ranking Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 md:px-6 py-3 bg-muted/30 border-b flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold">Ranking General por Departamento</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm text-left">
              <thead className="text-[10px] md:text-xs text-muted-foreground uppercase bg-muted/20 border-b">
                <tr>
                  <th className="px-3 md:px-6 py-3 font-bold w-12">#</th>
                  <th className="px-3 md:px-6 py-3 font-bold">Empleado</th>
                  <th className="px-3 md:px-6 py-3 font-bold hidden md:table-cell">Depto.</th>
                  <th className="px-3 md:px-6 py-3 font-bold">Acciones</th>
                  <th className="px-3 md:px-6 py-3 font-bold hidden md:table-cell">T. Prom.</th>
                  <th className="px-3 md:px-6 py-3 font-bold">Score</th>
                  <th className="px-3 md:px-6 py-3 font-bold hidden md:table-cell">SLA</th>
                  <th className="px-3 md:px-6 py-3 font-bold">Tendencia</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rankings.map((emp) => (
                  <tr
                    key={emp.employee_id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 md:px-6 py-3">
                      <RankBadge rank={emp.department_rank} />
                    </td>
                    <td className="px-3 md:px-6 py-3">
                      <div>
                        <span className="font-semibold">{emp.employee_name}</span>
                        <span className="md:hidden block text-[10px] text-muted-foreground">
                          {getDepartmentLabel(emp.employee_role)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 hidden md:table-cell">
                      <Badge
                        variant="secondary"
                        className={`${getDepartmentColor(emp.employee_role)} border-0 text-[10px]`}
                      >
                        {getDepartmentLabel(emp.employee_role)}
                      </Badge>
                    </td>
                    <td className="px-3 md:px-6 py-3 font-medium tabular-nums">
                      {emp.total_actions}
                    </td>
                    <td className="px-3 md:px-6 py-3 hidden md:table-cell tabular-nums">
                      {Number(emp.avg_time_minutes || 0).toFixed(1)} min
                    </td>
                    <td className="px-3 md:px-6 py-3 min-w-[140px]">
                      <PerformanceScoreBar
                        score={Number(emp.performance_score || 0)}
                        size="sm"
                        showLabel={false}
                      />
                    </td>
                    <td className="px-3 md:px-6 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        <span className={`font-semibold ${getScoreColor(Number(emp.sla_compliance_pct || 0))}`}>
                          {Number(emp.sla_compliance_pct || 0).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3">
                      <TrendArrow pct={Number(emp.trend_pct || 0)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
