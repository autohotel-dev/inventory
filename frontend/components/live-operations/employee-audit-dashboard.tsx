"use client";

import { useState } from "react";
import { Search, Shield, AlertTriangle, DollarSign, Users, Clock, FileText, Plus, Eye, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployeeRiskOverview, useHistoricalAnomalies, useIncidentReports, useEmployeeAuditTrail, createIncidentReport, EmployeeRiskSummary } from "@/hooks/use-employee-audit";
import { cn } from "@/lib/utils";

const RISK_COLORS: Record<string, string> = {
  LOW: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  MEDIUM: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  HIGH: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  CRITICAL: "bg-red-500/10 text-red-500 border-red-500/30",
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-500 text-white",
  MEDIUM: "bg-yellow-500 text-black",
  HIGH: "bg-orange-500 text-white",
  CRITICAL: "bg-red-500 text-white",
};

function RiskScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-red-500" : score >= 50 ? "bg-orange-500" : score >= 25 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={cn("h-2 rounded-full transition-all", color)} style={{ width: `${Math.min(score, 100)}%` }} />
    </div>
  );
}

function EmployeeRiskCard({ employee, onSelect }: { employee: EmployeeRiskSummary; onSelect: () => void }) {
  return (
    <div onClick={onSelect} className="p-4 rounded-xl border bg-card hover:shadow-lg transition-all cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-sm">{employee.employee_name}</h3>
          <p className="text-xs text-muted-foreground">{employee.employee_role}</p>
        </div>
        <Badge className={cn("text-[10px] px-2 py-0.5", RISK_COLORS[employee.risk_level])}>
          {employee.risk_level}
        </Badge>
      </div>
      <RiskScoreBar score={employee.risk_score} />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">Riesgo: {employee.risk_score.toFixed(0)}%</span>
        <div className="flex gap-2 text-[10px]">
          {employee.payment_discrepancies > 0 && (
            <span className="text-red-500 flex items-center gap-1"><DollarSign className="h-3 w-3" />{employee.payment_discrepancies}</span>
          )}
          {employee.person_mismatches > 0 && (
            <span className="text-orange-500 flex items-center gap-1"><Users className="h-3 w-3" />{employee.person_mismatches}</span>
          )}
          {employee.incidents_reported > 0 && (
            <span className="text-red-600 flex items-center gap-1"><FileText className="h-3 w-3" />{employee.incidents_reported}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeeDetail({ employee, onClose }: { employee: EmployeeRiskSummary; onClose: () => void }) {
  const { logs, loading: logsLoading } = useEmployeeAuditTrail(employee.employee_id);
  const { anomalies } = useHistoricalAnomalies(30);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    incident_type: "THEFT", severity: "HIGH", title: "", description: "",
    evidence_type: "CAMERA", evidence_notes: "", room_number: "", amount_involved: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const employeeAnomalies = anomalies.filter(a => a.employee_id === employee.employee_id);

  const handleSubmitIncident = async () => {
    setSubmitting(true);
    const success = await createIncidentReport({
      target_employee_id: employee.employee_id,
      target_employee_name: employee.employee_name,
      ...incidentForm,
      amount_involved: incidentForm.amount_involved ? parseFloat(incidentForm.amount_involved) : undefined,
    });
    setSubmitting(false);
    if (success) { setShowIncidentForm(false); setIncidentForm({ incident_type: "THEFT", severity: "HIGH", title: "", description: "", evidence_type: "CAMERA", evidence_notes: "", room_number: "", amount_involved: "" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{employee.employee_name}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
      </div>

      {/* Risk Summary */}
      <Card className={cn("border", RISK_COLORS[employee.risk_level])}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="text-3xl font-black">{employee.risk_score.toFixed(0)}%</div>
            <div className="flex-1">
              <p className="font-bold">Nivel de Riesgo: {employee.risk_level}</p>
              <RiskScoreBar score={employee.risk_score} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{employee.total_operations}</p>
              <p className="text-[10px] text-muted-foreground">Operaciones</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-500/10">
              <p className="text-lg font-bold text-red-500">{employee.payment_discrepancies}</p>
              <p className="text-[10px] text-muted-foreground">Pagos Discrepantes</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-orange-500/10">
              <p className="text-lg font-bold text-orange-500">{employee.incidents_reported}</p>
              <p className="text-[10px] text-muted-foreground">Incidentes</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-500/10">
              <p className="text-lg font-bold text-amber-500">{employee.cash_payment_ratio}%</p>
              <p className="text-[10px] text-muted-foreground">Efectivo</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{employee.void_count}</p>
              <p className="text-[10px] text-muted-foreground">Anulaciones</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{employee.refund_count}</p>
              <p className="text-[10px] text-muted-foreground">Reembolsos</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{employee.courtesy_abuse_count}</p>
              <p className="text-[10px] text-muted-foreground">Cortesías</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{employee.last_anomaly_days}d</p>
              <p className="text-[10px] text-muted-foreground">Última Anomalía</p>
            </div>
          </div>

          {/* Risk Factors */}
          {employee.risk_factors && employee.risk_factors.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Factores de Riesgo:</p>
              {employee.risk_factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-red-500/5 border border-red-500/10">
                  <span>{f.factor}</span>
                  <span className="font-mono text-red-500">+{f.points}pts</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historical Anomalies */}
      {employeeAnomalies.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Anomalías Históricas (30 días)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employeeAnomalies.map((a, i) => (
              <div key={i} className="p-2 rounded-lg bg-muted/50 text-xs">
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[9px]", SEVERITY_COLORS[a.severity])}>{a.severity}</Badge>
                  <span className="font-medium">{a.anomaly_type}</span>
                  <span className="text-muted-foreground">×{a.occurrence_count}</span>
                  {a.total_amount && <span className="text-red-500">${a.total_amount.toFixed(2)}</span>}
                </div>
                <p className="text-muted-foreground mt-1">{a.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Incidents */}
      {employee.recent_incidents && employee.recent_incidents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-red-500" />
              Incidentes Recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.recent_incidents.map((inc, i) => (
              <div key={i} className="p-2 rounded-lg bg-muted/50 text-xs">
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[9px]", SEVERITY_COLORS[inc.severity])}>{inc.severity}</Badge>
                  <span className="font-medium">{inc.title}</span>
                  <Badge variant="outline" className="text-[9px]">{inc.status}</Badge>
                </div>
                <p className="text-muted-foreground mt-1">{new Date(inc.created_at).toLocaleDateString("es-MX")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Actividad Reciente
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowIncidentForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Reportar Incidente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando actividad...
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin actividad registrada en los últimos 7 días</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {logs.slice(0, 30).map((log) => (
                <div key={log.log_id} className="flex items-start gap-2 p-2 rounded text-xs hover:bg-muted/30">
                  <span className="text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-medium">{log.description}</span>
                  {log.room_number && <Badge variant="outline" className="text-[9px]">Hab. {log.room_number}</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident Report Dialog */}
      <Dialog open={showIncidentForm} onOpenChange={setShowIncidentForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reportar Incidente — {employee.employee_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Tipo de Incidente</label>
                <Select value={incidentForm.incident_type} onValueChange={v => setIncidentForm({ ...incidentForm, incident_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="THEFT">Robo</SelectItem>
                    <SelectItem value="COLLUSION">Colusión</SelectItem>
                    <SelectItem value="SKIMMING">Descuento no autorizado</SelectItem>
                    <SelectItem value="UNDERREPORTING">Sub-registro</SelectItem>
                    <SelectItem value="COURTESY_ABUSE">Abuso de cortesías</SelectItem>
                    <SelectItem value="OTHER">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Severidad</label>
                <Select value={incidentForm.severity} onValueChange={v => setIncidentForm({ ...incidentForm, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="CRITICAL">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Título</label>
              <Input value={incidentForm.title} onChange={e => setIncidentForm({ ...incidentForm, title: e.target.value })} placeholder="Ej: Robo de $500 detectado en cámara" />
            </div>
            <div>
              <label className="text-xs font-medium">Descripción detallada</label>
              <Textarea value={incidentForm.description} onChange={e => setIncidentForm({ ...incidentForm, description: e.target.value })} placeholder="Describe lo que se observó, cuándo, dónde..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Habitación</label>
                <Input value={incidentForm.room_number} onChange={e => setIncidentForm({ ...incidentForm, room_number: e.target.value })} placeholder="Ej: 101" />
              </div>
              <div>
                <label className="text-xs font-medium">Monto involucrado</label>
                <Input type="number" value={incidentForm.amount_involved} onChange={e => setIncidentForm({ ...incidentForm, amount_involved: e.target.value })} placeholder="$0.00" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Notas de evidencia (cámaras, testigos)</label>
              <Textarea value={incidentForm.evidence_notes} onChange={e => setIncidentForm({ ...incidentForm, evidence_notes: e.target.value })} placeholder="Cámara 3, 14:32, se observa a... etc." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIncidentForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmitIncident} disabled={!incidentForm.title || !incidentForm.description || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar Incidente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EmployeeAuditDashboard() {
  const { employees, loading } = useEmployeeRiskOverview();
  const { anomalies, loading: anomaliesLoading } = useHistoricalAnomalies(30);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRiskSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("ALL");

  const filtered = employees.filter(e => {
    const matchSearch = e.employee_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchLevel = filterLevel === "ALL" || e.risk_level === filterLevel;
    return matchSearch && matchLevel;
  });

  if (selectedEmployee) {
    return <EmployeeDetail employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />;
  }

  const criticalCount = employees.filter(e => e.risk_level === "CRITICAL").length;
  const highCount = employees.filter(e => e.risk_level === "HIGH").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            Auditoría de Empleados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Análisis de riesgo, anomalías históricas e investigación de incidentes</p>
        </div>
      </div>

      {/* Risk Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-red-500">{criticalCount}</p>
            <p className="text-xs text-muted-foreground">Riesgo Crítico</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-orange-500">{highCount}</p>
            <p className="text-xs text-muted-foreground">Riesgo Alto</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-amber-500">{anomalies.length}</p>
            <p className="text-xs text-muted-foreground">Anomalías Históricas</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empleado..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Nivel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="CRITICAL">Crítico</SelectItem>
            <SelectItem value="HIGH">Alto</SelectItem>
            <SelectItem value="MEDIUM">Medio</SelectItem>
            <SelectItem value="LOW">Bajo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Employee Risk Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <EmployeeRiskCard key={emp.employee_id} employee={emp} onSelect={() => setSelectedEmployee(emp)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No se encontraron empleados
            </div>
          )}
        </div>
      )}
    </div>
  );
}
