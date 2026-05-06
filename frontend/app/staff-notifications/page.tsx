"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Megaphone, AlertTriangle, Siren, ClipboardList, PartyPopper,
  Send, Loader2, Users, User, Shield, Clock, ChevronDown, Search, X, History
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ── Types ── */
type NotificationType = "comunicado" | "warning" | "urgent" | "instruction" | "recognition";
type TargetType = "employee" | "role" | "all";

interface Employee { id: string; name: string; role: string; }
interface HistoryItem {
  title: string; message: string; data: any;
  created_at: string; recipientCount: number;
}

/* ── Constants ── */
const NOTIF_TYPES: { value: NotificationType; label: string; emoji: string; icon: any; color: string; bg: string; border: string; }[] = [
  { value: "comunicado", label: "Comunicado", emoji: "📢", icon: Megaphone, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  { value: "warning", label: "Llamada de Atención", emoji: "⚠️", icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  { value: "urgent", label: "Urgente", emoji: "🚨", icon: Siren, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  { value: "instruction", label: "Instrucción", emoji: "📋", icon: ClipboardList, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
  { value: "recognition", label: "Reconocimiento", emoji: "🎉", icon: PartyPopper, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
];

const ROLE_OPTIONS = [
  { value: "cochero", label: "Cocheros / Valets" },
  { value: "recepcionista", label: "Recepcionistas" },
  { value: "camarista", label: "Camaristas" },
  { value: "admin", label: "Administradores" },
  { value: "manager", label: "Managers" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Justo ahora";
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `Hace ${days}d`;
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ── Page Component ── */
export default function StaffNotificationsPage() {
  // Form state
  const [notifType, setNotifType] = useState<NotificationType>("comunicado");
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch employees
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("employees")
        .select("id, first_name, last_name, role")
        
        
        ;
      if (data) {
        setEmployees(data.map((e: any) => ({
          id: e.id,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Sin nombre',
          role: e.role,
        })));
      }
    })();
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/staff-notifications/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.notifications || []);
      }
    } catch { /* silent */ }
    setLoadingHistory(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Send handler
  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      setFeedback({ type: "error", text: "Título y mensaje son requeridos" });
      return;
    }
    if (targetType === "employee" && !targetEmployeeId) {
      setFeedback({ type: "error", text: "Selecciona un empleado" });
      return;
    }
    if (targetType === "role" && selectedRoles.length === 0) {
      setFeedback({ type: "error", text: "Selecciona al menos un rol" });
      return;
    }

    setIsSending(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/staff-notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationType: notifType,
          targetType,
          targetEmployeeId: targetType === "employee" ? targetEmployeeId : undefined,
          targetRoles: targetType === "role" ? selectedRoles : undefined,
          title: title.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", text: `¡Notificación enviada a ${data.sentCount} empleado(s)!` });
        setTitle("");
        setMessage("");
        setTargetEmployeeId("");
        setSelectedRoles([]);
        fetchHistory();
      } else {
        setFeedback({ type: "error", text: data.error || "Error al enviar" });
      }
    } catch {
      setFeedback({ type: "error", text: "Error de conexión" });
    } finally {
      setIsSending(false);
    }
  }

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    e.role.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const selectedTypeMeta = NOTIF_TYPES.find(t => t.value === notifType)!;

  return (
    <div className="min-h-screen bg-neutral-950 p-2 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Comunicados al Staff</h1>
              <p className="text-neutral-500 text-sm">Envía notificaciones personalizadas a la app móvil</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Compose Panel ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Notification Type Selector */}
            <div className="bg-neutral-900/50 backdrop-blur-xl rounded-2xl p-3 sm:p-6 border border-white/5 shadow-2xl">
              <label className="block text-sm font-medium text-neutral-400 mb-3 sm:mb-4">Tipo de Notificación</label>
              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                {NOTIF_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = notifType === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setNotifType(t.value)}
                      className={`group relative flex flex-col items-center gap-1.5 sm:gap-2 p-2.5 sm:p-4 rounded-xl border-2 transition-all duration-200 ${
                        isSelected
                          ? `${t.bg} ${t.border} shadow-lg`
                          : "bg-neutral-950/50 border-white/5 hover:border-white/10 hover:bg-neutral-900/50"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                        isSelected ? t.bg : "bg-neutral-800/50 group-hover:bg-neutral-800"
                      }`}>
                        <Icon className={`w-5 h-5 ${isSelected ? t.color : "text-neutral-500 group-hover:text-neutral-300"}`} />
                      </div>
                      <span className={`text-[10px] sm:text-xs font-medium text-center leading-tight ${
                        isSelected ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"
                      }`}>{t.label}</span>
                      {isSelected && (
                        <div className={`absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${t.color.replace("text-", "bg-")}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target + Compose */}
            <div className="bg-neutral-900/50 backdrop-blur-xl rounded-2xl p-3 sm:p-6 border border-white/5 shadow-2xl space-y-4 sm:space-y-6">
              {/* Target Type */}
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-3">Destinatarios</label>
                <div className="flex flex-wrap gap-3">
                  {([
                    { value: "all" as TargetType, label: "Todos", icon: Users },
                    { value: "role" as TargetType, label: "Por Rol", icon: Shield },
                    { value: "employee" as TargetType, label: "Empleado Específico", icon: User },
                  ]).map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = targetType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setTargetType(opt.value)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                          isSelected
                            ? "bg-violet-500/10 border-violet-500/30 text-violet-300"
                            : "bg-neutral-950/50 border-white/5 text-neutral-500 hover:border-white/10 hover:text-neutral-300"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Role Selector */}
              {targetType === "role" && (
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Seleccionar Roles</label>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map((role) => {
                      const isSelected = selectedRoles.includes(role.value);
                      return (
                        <button
                          key={role.value}
                          onClick={() => {
                            setSelectedRoles(prev =>
                              isSelected ? prev.filter(r => r !== role.value) : [...prev, role.value]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            isSelected
                              ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                              : "bg-neutral-950/50 border-white/5 text-neutral-500 hover:text-neutral-300 hover:border-white/10"
                          }`}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Employee Selector */}
              {targetType === "employee" && (
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Seleccionar Empleado</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-600" />
                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      placeholder="Buscar por nombre o rol..."
                      className="w-full pl-10 pr-4 py-2.5 border border-white/10 rounded-xl bg-neutral-950/50 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all text-sm"
                    />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/5 bg-neutral-950/50 divide-y divide-white/5">
                    {filteredEmployees.length === 0 ? (
                      <div className="p-4 text-center text-neutral-600 text-sm">Sin resultados</div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => setTargetEmployeeId(emp.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                            targetEmployeeId === emp.id
                              ? "bg-violet-500/10 text-violet-300"
                              : "hover:bg-white/[0.03] text-neutral-400"
                          }`}
                        >
                          <span className="text-sm font-medium">{emp.name}</span>
                          <span className="text-xs text-neutral-600 capitalize">{emp.role}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Ej: ${selectedTypeMeta.label} importante`}
                  maxLength={100}
                  className="w-full px-4 py-3 border border-white/10 rounded-xl bg-neutral-950/50 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Mensaje</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe el contenido de la notificación..."
                  rows={4}
                  maxLength={500}
                  className="w-full px-4 py-3 border border-white/10 rounded-xl bg-neutral-950/50 text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all resize-none"
                />
                <p className="text-xs text-neutral-600 mt-1 text-right">{message.length}/500</p>
              </div>

              {/* Feedback */}
              {feedback && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${
                  feedback.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    : "bg-red-500/10 border border-red-500/20 text-red-300"
                }`}>
                  {feedback.type === "success" ? <PartyPopper className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                  <span className="text-sm">{feedback.text}</span>
                  <button onClick={() => setFeedback(null)} className="ml-auto">
                    <X className="w-4 h-4 text-neutral-500 hover:text-white transition-colors" />
                  </button>
                </div>
              )}

              {/* Preview + Send */}
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                {/* Mini Preview */}
                {title && (
                  <div className="flex-1 p-3 rounded-xl bg-neutral-950/80 border border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">Vista previa</p>
                    <p className="text-sm font-semibold text-white truncate">{selectedTypeMeta.emoji} {title}</p>
                    <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">{message || "..."}</p>
                  </div>
                )}

                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className="shrink-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
                >
                  {isSending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /><span>Enviando...</span></>
                  ) : (
                    <><Send className="w-5 h-5" /><span>Enviar Notificación</span></>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── History Panel ── */}
          <div className="lg:col-span-1">
            <div className="bg-neutral-900/50 backdrop-blur-xl rounded-2xl p-3 sm:p-6 border border-white/5 shadow-2xl h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-neutral-500" />
                  Historial
                </h2>
                <button onClick={fetchHistory} className="text-neutral-600 hover:text-neutral-300 transition-colors">
                  <Loader2 className={`w-4 h-4 ${loadingHistory ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <Megaphone className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                  <p className="text-neutral-600 text-sm">No hay comunicados enviados</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {history.map((item, i) => {
                    const typeMeta = NOTIF_TYPES.find(t => t.value === item.data?.notificationType);
                    const Icon = typeMeta?.icon || Megaphone;
                    return (
                      <div key={i} className="bg-neutral-950/50 border border-white/5 rounded-xl p-4 group hover:border-white/10 transition-all">
                        <div className="flex items-start gap-3">
                          <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${typeMeta?.bg || "bg-neutral-800/50"}`}>
                            <Icon className={`w-4 h-4 ${typeMeta?.color || "text-neutral-500"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                            <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">{item.message}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] text-neutral-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {timeAgo(item.created_at)}
                              </span>
                              <span className="text-[10px] text-neutral-600 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {item.recipientCount} destinatario{item.recipientCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                            {item.data?.senderName && (
                              <p className="text-[10px] text-neutral-600 mt-1">
                                Enviado por: {item.data.senderName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
