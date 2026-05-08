"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Priority = "baja" | "media" | "alta" | "urgente";
type Status = "pendiente" | "en_progreso" | "resuelto" | "reabierto";
type EventType = "comment" | "taken" | "resolved" | "reopened" | "reassigned" | "priority_changed";

interface Note {
  id: string; created_by: string; created_by_name: string;
  shift_session_id: string | null; created_shift_name: string | null;
  room_number: string | null; title: string; description: string;
  priority: Priority; status: Status;
  taken_by: string | null; taken_by_name: string | null; taken_at: string | null;
  taken_shift_session_id: string | null;
  resolved_by_name: string | null; resolved_at: string | null; resolution_note: string | null;
  resolved_shift_session_id: string | null;
  created_at: string; updated_at: string;
}

interface Comment {
  id: string; note_id: string; user_id: string; user_name: string;
  content: string; event_type: EventType; created_at: string;
}

const P_STYLE: Record<Priority, { bg: string; text: string; label: string }> = {
  urgente: { bg: "bg-red-500/15 border-red-500/30", text: "text-red-400", label: "🔴 Urgente" },
  alta:    { bg: "bg-orange-500/15 border-orange-500/30", text: "text-orange-400", label: "🟠 Alta" },
  media:   { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", label: "🟡 Media" },
  baja:    { bg: "bg-zinc-500/15 border-zinc-500/30", text: "text-zinc-400", label: "⚪ Baja" },
};

const S_STYLE: Record<Status, { bg: string; text: string; label: string }> = {
  pendiente:   { bg: "bg-blue-500/15 border-blue-500/25", text: "text-blue-300", label: "Pendiente" },
  en_progreso: { bg: "bg-amber-500/15 border-amber-500/25", text: "text-amber-300", label: "En Progreso" },
  resuelto:    { bg: "bg-emerald-500/15 border-emerald-500/25", text: "text-emerald-300", label: "Resuelto" },
  reabierto:   { bg: "bg-violet-500/15 border-violet-500/25", text: "text-violet-300", label: "Reabierto" },
};

const EVENT_ICONS: Record<EventType, string> = {
  comment: "💬", taken: "📋", resolved: "✅", reopened: "🔄", reassigned: "🔀", priority_changed: "⚡",
};

export function HandoffBoard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("Staff");
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [activeShiftName, setActiveShiftName] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterShift, setFilterShift] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Reference data for filters
  const [employees, setEmployees] = useState<{ name: string }[]>([]);
  const [shifts, setShifts] = useState<{ id: string; name: string }[]>([]);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showResolve, setShowResolve] = useState<Note | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("media");
  const [newRoom, setNewRoom] = useState("");
  const [resolveNote, setResolveNote] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("shift_handoff_notes").select("*").order("created_at", { ascending: false });
    if (filterStatus === "open") q = q.in("status", ["pendiente", "en_progreso", "reabierto"]);
    else if (filterStatus !== "all") q = q.eq("status", filterStatus);
    if (filterPriority !== "all") q = q.eq("priority", filterPriority);
    if (filterEmployee !== "all") q = q.eq("created_by_name", filterEmployee);
    if (filterShift === "none") q = q.is("created_shift_name", null);
    else if (filterShift !== "all") q = q.eq("created_shift_name", filterShift);
    if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%,room_number.ilike.%${search}%`);

    const { data } = await q;
    setNotes(data || []);
    setLoading(false);
  }, [supabase, filterStatus, filterPriority, filterEmployee, filterShift, search]);

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (u) {
        const { data: emp } = await supabase.from("employees").select("id, first_name, last_name").eq("auth_user_id", u.id).single();
        if (emp) {
          setUserName(`${emp.first_name} ${emp.last_name}`.trim());
          // Find active shift
          const { data: shift } = await supabase.from("shift_sessions")
            .select("id, shift_definitions(name)")
            .eq("employee_id", emp.id)
            .is("clock_out_at", null)
            .order("clock_in_at", { ascending: false })
            .limit(1)
            .single();
          if (shift) {
            setActiveShiftId(shift.id);
            setActiveShiftName((shift as unknown as { shift_definitions: { name: string } | null }).shift_definitions?.name || "Turno activo");
          }
        }
      }
    };
    init();
    // Load filter reference data
    const loadFilters = async () => {
      const { data: emps } = await supabase.from("employees").select("first_name, last_name").order("first_name");
      if (emps) setEmployees(emps.map(e => ({ name: `${e.first_name} ${e.last_name}`.trim() })));
      const { data: shiftDefs } = await supabase.from("shift_definitions").select("id, name").order("name");
      if (shiftDefs) setShifts(shiftDefs);
    };
    loadFilters();
  }, [supabase]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("handoff-notes")
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_handoff_notes" }, () => fetchNotes())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "handoff_note_comments" }, (p: { new: Comment }) => {
        const c = p.new as Comment;
        setComments(prev => ({ ...prev, [c.note_id]: [...(prev[c.note_id] || []), c] }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, fetchNotes]);

  const fetchComments = async (noteId: string) => {
    const { data } = await supabase.from("handoff_note_comments").select("*").eq("note_id", noteId).order("created_at", { ascending: true });
    if (data) setComments(prev => ({ ...prev, [noteId]: data }));
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !user) return;
    await supabase.from("shift_handoff_notes").insert({
      created_by: user.id, created_by_name: userName,
      shift_session_id: activeShiftId, created_shift_name: activeShiftName,
      title: newTitle.trim(), description: newDesc.trim(),
      priority: newPriority, room_number: newRoom.trim() || null,
    });
    setShowCreate(false); setNewTitle(""); setNewDesc(""); setNewPriority("media"); setNewRoom("");
  };

  const handleTake = async (note: Note) => {
    if (!user) return;
    await supabase.from("shift_handoff_notes").update({
      status: "en_progreso", taken_by: user.id, taken_by_name: userName,
      taken_at: new Date().toISOString(), taken_shift_session_id: activeShiftId,
    }).eq("id", note.id);
    await supabase.from("handoff_note_comments").insert({
      note_id: note.id, user_id: user.id, user_name: userName,
      content: `${userName} tomó este pendiente${activeShiftName ? ` (${activeShiftName})` : ""}`,
      event_type: "taken",
    });
  };

  const handleReassign = async (note: Note) => {
    if (!user) return;
    await supabase.from("shift_handoff_notes").update({
      status: "pendiente", taken_by: null, taken_by_name: null,
      taken_at: null, taken_shift_session_id: null,
    }).eq("id", note.id);
    await supabase.from("handoff_note_comments").insert({
      note_id: note.id, user_id: user.id, user_name: userName,
      content: `${userName} liberó este pendiente para reasignación`,
      event_type: "reassigned",
    });
  };

  const handleReopen = async (note: Note) => {
    if (!user) return;
    await supabase.from("shift_handoff_notes").update({
      status: "reabierto", resolved_by: null, resolved_by_name: null,
      resolved_at: null, resolution_note: null, resolved_shift_session_id: null,
    }).eq("id", note.id);
    await supabase.from("handoff_note_comments").insert({
      note_id: note.id, user_id: user.id, user_name: userName,
      content: `${userName} reabrió este pendiente`,
      event_type: "reopened",
    });
  };

  const handleResolve = async () => {
    if (!showResolve || !user) return;
    await supabase.from("shift_handoff_notes").update({
      status: "resuelto", resolved_by: user.id, resolved_by_name: userName,
      resolved_at: new Date().toISOString(), resolution_note: resolveNote.trim() || null,
      resolved_shift_session_id: activeShiftId,
    }).eq("id", showResolve.id);
    await supabase.from("handoff_note_comments").insert({
      note_id: showResolve.id, user_id: user.id, user_name: userName,
      content: resolveNote.trim() ? `Resuelto: ${resolveNote.trim()}` : `${userName} resolvió este pendiente`,
      event_type: "resolved",
    });
    setShowResolve(null); setResolveNote("");
  };

  const handleChangePriority = async (note: Note, newP: Priority) => {
    if (!user || newP === note.priority) return;
    const oldLabel = P_STYLE[note.priority].label;
    const newLabel = P_STYLE[newP].label;
    await supabase.from("shift_handoff_notes").update({ priority: newP }).eq("id", note.id);
    await supabase.from("handoff_note_comments").insert({
      note_id: note.id, user_id: user.id, user_name: userName,
      content: `Prioridad cambiada: ${oldLabel} → ${newLabel}`,
      event_type: "priority_changed",
    });
  };

  const handleAddComment = async (noteId: string) => {
    if (!commentText.trim() || !user) return;
    await supabase.from("handoff_note_comments").insert({
      note_id: noteId, user_id: user.id, user_name: userName,
      content: commentText.trim(), event_type: "comment",
    });
    setCommentText("");
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!comments[id]) fetchComments(id);
  };

  // Stats
  const openCount = notes.filter(n => n.status !== "resuelto").length;
  const urgentCount = notes.filter(n => n.priority === "urgente" && n.status !== "resuelto").length;
  const inProgressCount = notes.filter(n => n.status === "en_progreso").length;
  const resolvedToday = notes.filter(n => n.status === "resuelto" && n.resolved_at && new Date(n.resolved_at).toDateString() === new Date().toDateString()).length;

  const relTime = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return "Ahora";
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    return `hace ${Math.floor(h / 24)}d`;
  };

  return (
    <>
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-white/[0.04] bg-[#0a0a0f]/80 backdrop-blur-2xl">
        <div className="max-w-[1400px] mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600/30 via-orange-500/30 to-red-500/20 border border-white/[0.08] flex items-center justify-center">
              <span className="text-lg">📋</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
                Bitácora de Pendientes
              </h1>
              <p className="text-[10px] text-white/25 tracking-widest uppercase">Handoff entre turnos</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-semibold hover:brightness-110 transition-all shadow-lg shadow-amber-900/20">
            + Nuevo Pendiente
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-5 py-6 space-y-5">
        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: "📌", label: "Abiertos", value: openCount, g: "from-blue-600/20 to-blue-900/10", b: "border-blue-500/15", a: "text-blue-400", pulse: openCount > 0 },
            { icon: "🔄", label: "En Progreso", value: inProgressCount, g: "from-amber-600/20 to-amber-900/10", b: "border-amber-500/15", a: "text-amber-400" },
            { icon: "✅", label: "Resueltos Hoy", value: resolvedToday, g: "from-emerald-600/20 to-emerald-900/10", b: "border-emerald-500/15", a: "text-emerald-400" },
            { icon: "🚨", label: "Urgentes", value: urgentCount, g: "from-red-600/20 to-red-900/10", b: "border-red-500/15", a: "text-red-400", pulse: urgentCount > 0 },
          ].map((s, i) => (
            <div key={i} className={`relative overflow-hidden rounded-2xl border ${s.b} bg-gradient-to-br ${s.g} p-4`}>
              <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mb-1">{s.icon} {s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.a}`}>{s.value}</p>
              {s.pulse && <span className="absolute top-3 right-3 flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-current opacity-75" style={{ color: s.a.includes("blue") ? "#60a5fa" : "#f87171" }} /><span className={`relative rounded-full h-2 w-2 ${s.a.includes("blue") ? "bg-blue-500" : "bg-red-500"}`} /></span>}
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-4 flex flex-wrap gap-2 items-center">
          {[{ v: "open", l: "📌 Abiertos" }, { v: "all", l: "📋 Todos" }, { v: "resuelto", l: "✅ Resueltos" }, { v: "reabierto", l: "🔄 Reabiertos" }].map(t => (
            <button key={t.v} onClick={() => setFilterStatus(t.v)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${filterStatus === t.v ? "bg-white/[0.08] text-white border border-white/[0.06]" : "text-white/30 hover:text-white/60"}`}>
              {t.l}
            </button>
          ))}
          <span className="w-px h-6 bg-white/[0.06] mx-1" />
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-[#141420] border border-white/[0.08] text-xs text-white/70 focus:outline-none">
            <option value="all">Todas las prioridades</option>
            <option value="urgente">🔴 Urgente</option>
            <option value="alta">🟠 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">⚪ Baja</option>
          </select>
          <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-[#141420] border border-white/[0.08] text-xs text-white/70 focus:outline-none min-w-[160px]">
            <option value="all">👤 Todos los empleados</option>
            {employees.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
          </select>
          <select value={filterShift} onChange={e => setFilterShift(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-[#141420] border border-white/[0.08] text-xs text-white/70 focus:outline-none min-w-[140px]">
            <option value="all">🕐 Todos los turnos</option>
            {shifts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            <option value="none">⚠️ Sin turno asignado</option>
          </select>
          <input placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[150px] h-8 px-3 rounded-lg bg-[#141420] border border-white/[0.08] text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
        </div>

        {/* NOTES LIST */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 rounded-3xl border border-white/[0.03] bg-white/[0.01] backdrop-blur-sm">
            <div className="w-12 h-12 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-6" />
            <p className="text-sm font-medium text-white/40 tracking-wide uppercase">Cargando bitácora...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.01] backdrop-blur-sm">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-5 border border-white/[0.05]">
              <span className="text-2xl">🎉</span>
            </div>
            <p className="text-lg font-bold text-white/70 mb-2">No hay pendientes por mostrar</p>
            <p className="text-sm text-white/30 text-center max-w-sm">
              La vista actual no tiene registros. ¡Todo el equipo está al día!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map(note => {
              const ps = P_STYLE[note.priority];
              const ss = S_STYLE[note.status];
              const expanded = expandedId === note.id;
              const noteComments = comments[note.id] || [];

              return (
                <div key={note.id} className={`group rounded-2xl border transition-all duration-300 overflow-hidden ${expanded ? "border-white/[0.15] bg-white/[0.03] shadow-2xl shadow-black/50" : "border-white/[0.05] bg-white/[0.015] hover:border-amber-500/30 hover:bg-white/[0.02] hover:shadow-xl hover:shadow-amber-500/5 backdrop-blur-sm"}`}>
                  <button onClick={() => toggleExpand(note.id)} className="w-full flex items-start gap-4 px-6 py-5 text-left relative">
                    {/* Hover subtle glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/0 to-amber-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className={`mt-1.5 shrink-0 transition-transform duration-300 ${expanded ? "rotate-90 text-amber-400" : "text-white/20 group-hover:text-amber-500/50"}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                    
                    <div className="flex-1 min-w-0 z-10">
                      <div className="flex items-center gap-2.5 flex-wrap mb-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${ps.bg} ${ps.text}`}>{ps.label}</span>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${ss.bg} ${ss.text}`}>{ss.label}</span>
                        {note.room_number && <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-white/[0.05] border border-white/[0.08] text-white/60 shadow-sm">🏨 HAB {note.room_number}</span>}
                      </div>
                      <p className={`text-base font-bold leading-snug transition-colors ${expanded ? "text-white" : "text-white/90 group-hover:text-white"}`}>{note.title}</p>
                      {note.description && <p className="text-sm text-white/40 mt-1 line-clamp-1 group-hover:text-white/50 transition-colors">{note.description}</p>}
                    </div>
                    
                    <div className="text-right shrink-0 z-10 space-y-1">
                      <p className="text-[11px] font-medium text-white/30 tabular-nums">{relTime(note.created_at)}</p>
                      <p className="text-[11px] font-medium text-white/40">👤 {note.created_by_name}</p>
                      {note.created_shift_name && <p className="text-[10px] font-medium text-amber-400/60">🕐 {note.created_shift_name}</p>}
                      {note.taken_by_name && <p className="text-[10px] font-medium text-blue-400/60">📋 {note.taken_by_name}</p>}
                      {note.resolved_by_name && <p className="text-[10px] font-medium text-emerald-400/60">✅ {note.resolved_by_name}</p>}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-white/[0.06] bg-black/20 px-6 py-5 space-y-5">
                      {note.description && <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{note.description}</p>}

                      {/* METADATA GRID */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                        <div>
                          <p className="text-[9px] text-white/20 uppercase tracking-wider">Creado por</p>
                          <p className="text-[11px] text-white/60 font-medium">{note.created_by_name}</p>
                          <p className="text-[9px] text-white/25 tabular-nums">{new Date(note.created_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          {note.created_shift_name && <p className="text-[9px] text-amber-400/60">🕐 {note.created_shift_name}</p>}
                        </div>
                        {note.taken_by_name && (
                          <div>
                            <p className="text-[9px] text-white/20 uppercase tracking-wider">Tomado por</p>
                            <p className="text-[11px] text-white/60 font-medium">{note.taken_by_name}</p>
                            {note.taken_at && <p className="text-[9px] text-white/25 tabular-nums">{new Date(note.taken_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                          </div>
                        )}
                        {note.resolved_by_name && (
                          <div>
                            <p className="text-[9px] text-white/20 uppercase tracking-wider">Resuelto por</p>
                            <p className="text-[11px] text-emerald-400/80 font-medium">{note.resolved_by_name}</p>
                            {note.resolved_at && <p className="text-[9px] text-white/25 tabular-nums">{new Date(note.resolved_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                          </div>
                        )}
                        {note.resolution_note && (
                          <div className="col-span-2 md:col-span-1">
                            <p className="text-[9px] text-white/20 uppercase tracking-wider">Resolución</p>
                            <p className="text-[11px] text-white/50">{note.resolution_note}</p>
                          </div>
                        )}
                      </div>

                      {/* ACTIONS */}
                      <div className="flex flex-wrap gap-2.5 mt-2">
                        {(note.status === "pendiente" || note.status === "reabierto") && (
                          <button onClick={(e) => { e.stopPropagation(); handleTake(note); }}
                            className="h-8 px-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:from-amber-500/20 hover:to-orange-500/20 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
                            📋 Tomar
                          </button>
                        )}
                        {note.status === "en_progreso" && (
                          <button onClick={(e) => { e.stopPropagation(); handleReassign(note); }}
                            className="h-8 px-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold hover:from-violet-500/20 hover:to-fuchsia-500/20 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/10 transition-all">
                            🔀 Liberar / Reasignar
                          </button>
                        )}
                        {note.status !== "resuelto" && (
                          <button onClick={(e) => { e.stopPropagation(); setShowResolve(note); }}
                            className="h-8 px-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:from-emerald-500/20 hover:to-teal-500/20 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
                            ✅ Resolver
                          </button>
                        )}
                        {note.status === "resuelto" && (
                          <button onClick={(e) => { e.stopPropagation(); handleReopen(note); }}
                            className="h-8 px-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold hover:from-indigo-500/20 hover:to-blue-500/20 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
                            🔄 Reabrir
                          </button>
                        )}
                        {note.status !== "resuelto" && (
                          <select value={note.priority}
                            onChange={(e) => { e.stopPropagation(); handleChangePriority(note, e.target.value as Priority); }}
                            className="h-8 px-3 rounded-xl bg-[#141420] border border-white/[0.08] text-[11px] font-medium text-white/70 focus:outline-none focus:ring-1 focus:ring-amber-500/30 hover:border-white/[0.15] cursor-pointer transition-all shadow-sm">
                            <option value="baja">⚪ Baja</option>
                            <option value="media">🟡 Media</option>
                            <option value="alta">🟠 Alta</option>
                            <option value="urgente">🔴 Urgente</option>
                          </select>
                        )}
                      </div>

                      {/* AUDIT TRAIL */}
                      <div className="space-y-1.5 pt-2 border-t border-white/[0.03]">
                        <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold">Historial ({noteComments.length})</p>
                        {noteComments.map(c => (
                          <div key={c.id} className={`flex gap-2.5 pl-3 border-l-2 ${c.event_type === "comment" ? "border-white/[0.06]" : "border-amber-500/20"}`}>
                            <span className="text-xs mt-0.5 shrink-0">{EVENT_ICONS[c.event_type] || "📌"}</span>
                            <div className="min-w-0">
                              <p className="text-xs text-white/60">
                                <span className="font-bold text-white/70">{c.user_name}</span>
                                <span className="text-white/20"> · </span>
                                <span className="text-white/25 tabular-nums">{new Date(c.created_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              </p>
                              <p className="text-xs text-white/40">{c.content}</p>
                            </div>
                          </div>
                        ))}
                        {note.status !== "resuelto" && (
                          <div className="flex gap-2 mt-2">
                            <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Agregar nota de seguimiento..."
                              onKeyDown={e => e.key === "Enter" && handleAddComment(note.id)}
                              className="flex-1 h-8 px-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
                            <button onClick={() => handleAddComment(note.id)}
                              className="h-8 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:text-white hover:bg-white/[0.08] transition-all">
                              Enviar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-lg mx-4 rounded-3xl bg-[#12121a] border border-white/[0.08] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">📋 Nuevo Pendiente</h2>
            <div className="space-y-3">
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título del pendiente *"
                className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descripción detallada..." rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/30 resize-none" />
              <div className="flex gap-3">
                <select value={newPriority} onChange={e => setNewPriority(e.target.value as Priority)}
                  className="flex-1 h-10 px-3 rounded-xl bg-[#141420] border border-white/[0.08] text-sm text-white/70 focus:outline-none">
                  <option value="baja">⚪ Baja</option>
                  <option value="media">🟡 Media</option>
                  <option value="alta">🟠 Alta</option>
                  <option value="urgente">🔴 Urgente</option>
                </select>
                <input value={newRoom} onChange={e => setNewRoom(e.target.value)} placeholder="Habitación (opc.)"
                  className="w-28 h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/25 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors">Cancelar</button>
              <button onClick={handleCreate} disabled={!newTitle.trim()}
                className="h-9 px-5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-30">
                Crear Pendiente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLVE MODAL */}
      {showResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowResolve(null)}>
          <div className="w-full max-w-lg mx-4 rounded-3xl bg-[#12121a] border border-white/[0.08] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">✅ Resolver Pendiente</h2>
            <p className="text-sm text-white/40 mb-4">&ldquo;{showResolve.title}&rdquo;</p>
            <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} placeholder="¿Cómo se resolvió? (opcional)" rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none" />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowResolve(null)} className="h-9 px-4 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors">Cancelar</button>
              <button onClick={handleResolve}
                className="h-9 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold hover:brightness-110 transition-all">
                Marcar como Resuelto
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
