"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Priority = "baja" | "media" | "alta" | "urgente";
type Status = "pendiente" | "en_progreso" | "resuelto";

interface Note {
  id: string; created_by: string; created_by_name: string;
  room_number: string | null; title: string; description: string;
  priority: Priority; status: Status;
  resolved_by_name: string | null; resolved_at: string | null; resolution_note: string | null;
  created_at: string; updated_at: string;
}

interface Comment {
  id: string; note_id: string; user_id: string; user_name: string;
  content: string; created_at: string;
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
};

export function HandoffBoard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState("Staff");

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [search, setSearch] = useState("");

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

  const supabase = createClient();

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("shift_handoff_notes").select("*").order("created_at", { ascending: false });
    if (filterStatus === "open") q = q.in("status", ["pendiente", "en_progreso"]);
    else if (filterStatus !== "all") q = q.eq("status", filterStatus);
    if (filterPriority !== "all") q = q.eq("priority", filterPriority);
    if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%,room_number.ilike.%${search}%`);

    const { data } = await q;
    setNotes(data || []);
    setLoading(false);
  }, [filterStatus, filterPriority, search]);

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (u) {
        const { data: emp } = await supabase.from("employees").select("first_name, last_name").eq("auth_user_id", u.id).single();
        if (emp) setUserName(`${emp.first_name} ${emp.last_name}`.trim());
      }
    };
    init();
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("handoff-notes")
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_handoff_notes" }, () => fetchNotes())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "handoff_note_comments" }, (p: any) => {
        const c = p.new as Comment;
        setComments(prev => ({ ...prev, [c.note_id]: [...(prev[c.note_id] || []), c] }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchNotes]);

  const fetchComments = async (noteId: string) => {
    const { data } = await supabase.from("handoff_note_comments").select("*").eq("note_id", noteId).order("created_at", { ascending: true });
    if (data) setComments(prev => ({ ...prev, [noteId]: data }));
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !user) return;
    await supabase.from("shift_handoff_notes").insert({
      created_by: user.id, created_by_name: userName,
      title: newTitle.trim(), description: newDesc.trim(),
      priority: newPriority, room_number: newRoom.trim() || null,
    });
    setShowCreate(false); setNewTitle(""); setNewDesc(""); setNewPriority("media"); setNewRoom("");
  };

  const handleTake = async (note: Note) => {
    if (!user) return;
    await supabase.from("shift_handoff_notes").update({ status: "en_progreso" }).eq("id", note.id);
    await supabase.from("handoff_note_comments").insert({
      note_id: note.id, user_id: user.id, user_name: userName,
      content: `📋 ${userName} tomó este pendiente`,
    });
  };

  const handleResolve = async () => {
    if (!showResolve || !user) return;
    await supabase.from("shift_handoff_notes").update({
      status: "resuelto", resolved_by: user.id, resolved_by_name: userName,
      resolved_at: new Date().toISOString(), resolution_note: resolveNote.trim() || null,
    }).eq("id", showResolve.id);
    if (resolveNote.trim()) {
      await supabase.from("handoff_note_comments").insert({
        note_id: showResolve.id, user_id: user.id, user_name: userName,
        content: `✅ Resuelto: ${resolveNote.trim()}`,
      });
    }
    setShowResolve(null); setResolveNote("");
  };

  const handleAddComment = async (noteId: string) => {
    if (!commentText.trim() || !user) return;
    await supabase.from("handoff_note_comments").insert({
      note_id: noteId, user_id: user.id, user_name: userName, content: commentText.trim(),
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
          {[{ v: "open", l: "📌 Abiertos" }, { v: "all", l: "📋 Todos" }, { v: "resuelto", l: "✅ Resueltos" }].map(t => (
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
          <input placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[150px] h-8 px-3 rounded-lg bg-[#141420] border border-white/[0.08] text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
        </div>

        {/* NOTES LIST */}
        {loading ? (
          <div className="flex flex-col items-center py-24">
            <div className="w-10 h-10 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
            <p className="text-sm text-white/30">Cargando pendientes...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center py-24 border border-dashed border-white/[0.06] rounded-3xl">
            <span className="text-4xl mb-4">🎉</span>
            <p className="text-base font-semibold text-white/40 mb-1">No hay pendientes</p>
            <p className="text-xs text-white/20">¡Todo está al día! Crea uno nuevo si necesitas dejar una nota.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map(note => {
              const ps = P_STYLE[note.priority];
              const ss = S_STYLE[note.status];
              const expanded = expandedId === note.id;
              const noteComments = comments[note.id] || [];

              return (
                <div key={note.id} className={`rounded-2xl border transition-all duration-300 ${expanded ? "border-white/[0.1] bg-white/[0.025]" : "border-white/[0.04] bg-white/[0.01] hover:border-white/[0.07]"}`}>
                  <button onClick={() => toggleExpand(note.id)} className="w-full flex items-start gap-3 px-5 py-4 text-left">
                    <span className={`text-white/25 text-[10px] mt-1.5 transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${ps.bg} ${ps.text}`}>{ps.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${ss.bg} ${ss.text}`}>{ss.label}</span>
                        {note.room_number && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/[0.04] border border-white/[0.06] text-white/50">🏨 {note.room_number}</span>}
                      </div>
                      <p className="text-sm font-semibold text-white/85 leading-snug">{note.title}</p>
                      {note.description && <p className="text-xs text-white/35 mt-0.5 line-clamp-1">{note.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-white/20 tabular-nums">{relTime(note.created_at)}</p>
                      <p className="text-[10px] text-white/15">{note.created_by_name}</p>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-white/[0.04] px-5 py-4 space-y-3">
                      {note.description && <p className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap">{note.description}</p>}

                      {note.status === "resuelto" && note.resolution_note && (
                        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3">
                          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">✅ Resolución — {note.resolved_by_name}</p>
                          <p className="text-xs text-white/50">{note.resolution_note}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {note.status !== "resuelto" && (
                        <div className="flex gap-2">
                          {note.status === "pendiente" && (
                            <button onClick={(e) => { e.stopPropagation(); handleTake(note); }}
                              className="h-8 px-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-all">
                              📋 Tomar
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setShowResolve(note); }}
                            className="h-8 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all">
                            ✅ Resolver
                          </button>
                        </div>
                      )}

                      {/* Comments */}
                      <div className="space-y-2 pt-2 border-t border-white/[0.03]">
                        <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold">Seguimiento ({noteComments.length})</p>
                        {noteComments.map(c => (
                          <div key={c.id} className="flex gap-2 pl-3 border-l-2 border-white/[0.06]">
                            <div>
                              <p className="text-xs text-white/60"><span className="font-bold text-white/70">{c.user_name}</span> · <span className="text-white/25">{relTime(c.created_at)}</span></p>
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
            <p className="text-sm text-white/40 mb-4">"{showResolve.title}"</p>
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
