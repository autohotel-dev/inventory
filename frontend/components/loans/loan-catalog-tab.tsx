"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CatalogItem {
  id: string;
  name: string;
  icon: string | null;
  damage_price: number | null;
  min_available: number | null;
  is_active: boolean;
}

type Draft = { name: string; icon: string; damage_price: string; min_available: string };

const toDraft = (item: CatalogItem): Draft => ({
  name: item.name,
  icon: item.icon || "",
  damage_price: String(item.damage_price ?? 0),
  min_available: item.min_available === null ? "" : String(item.min_available),
});

const minOrNull = (d: Draft) => d.min_available.trim() === "" ? null : Number(d.min_available);

/** Artículos físicos que se prestan y su precio sugerido de cobro si faltan. */
export function LoanCatalogTab({ onChanged }: { onChanged?: () => void }) {
  const supabase = createClient();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newItem, setNewItem] = useState<Draft>({ name: "", icon: "", damage_price: "", min_available: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("loan_item_catalog").select("id, name, icon, damage_price, min_available, is_active").order("is_active", { ascending: false }).order("name");
    if (error) { toast.error("Error al cargar el catálogo", { description: error.message }); return; }
    setItems(data || []);
    setDrafts(Object.fromEntries((data || []).map((i: CatalogItem) => [i.id, toDraft(i)])));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const validate = (d: Draft) => {
    if (!d.name.trim()) return "El nombre es obligatorio";
    const price = Number(d.damage_price);
    if (!Number.isFinite(price) || price < 0) return "El precio por daño debe ser 0 o mayor";
    const min = minOrNull(d);
    if (min !== null && (!Number.isInteger(min) || min < 0)) return "El mínimo disponible debe ser un entero, 0 o mayor";
    return null;
  };

  const save = async (id: string) => {
    const d = drafts[id];
    const problem = validate(d);
    if (problem) { toast.warning(problem); return; }
    setBusy(id);
    const { error } = await supabase.from("loan_item_catalog")
      .update({ name: d.name.trim(), icon: d.icon.trim() || null, damage_price: Number(d.damage_price), min_available: minOrNull(d), updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    if (error) { toast.error("No se pudo guardar", { description: error.message }); return; }
    toast.success("Artículo actualizado");
    await load();
    onChanged?.();
  };

  const create = async () => {
    const problem = validate(newItem);
    if (problem) { toast.warning(problem); return; }
    setBusy("new");
    const { error } = await supabase.from("loan_item_catalog")
      .insert({ name: newItem.name.trim(), icon: newItem.icon.trim() || null, damage_price: Number(newItem.damage_price), min_available: minOrNull(newItem) });
    setBusy(null);
    if (error) { toast.error("No se pudo agregar", { description: error.message }); return; }
    toast.success("Artículo agregado al catálogo");
    setNewItem({ name: "", icon: "", damage_price: "", min_available: "" });
    await load();
    onChanged?.();
  };

  const setActive = async (item: CatalogItem, isActive: boolean) => {
    setBusy(item.id);
    const { error } = await supabase.from("loan_item_catalog")
      .update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", item.id);
    setBusy(null);
    if (error) { toast.error("No se pudo actualizar", { description: error.message }); return; }
    toast.success(isActive ? `${item.name} activado` : `${item.name} desactivado: ya no se presta`);
    await load();
    onChanged?.();
  };

  const remove = async (item: CatalogItem) => {
    if (!window.confirm(`¿Eliminar "${item.name}" del catálogo? También se quitan sus vínculos con productos.`)) return;
    setBusy(item.id);
    const { error } = await supabase.from("loan_item_catalog").delete().eq("id", item.id);
    setBusy(null);
    if (error) {
      // stay_loaned_items lo referencia con ON DELETE RESTRICT: hay historial de préstamos
      if (error.code === "23503") {
        if (item.is_active && window.confirm(`"${item.name}" ya se ha prestado y conserva su historial, no se puede borrar.\n\n¿Desactivarlo? Ya no se prestará con ningún producto.`)) {
          await setActive(item, false);
        }
        return;
      }
      toast.error("No se pudo eliminar", { description: error.message });
      return;
    }
    toast.success("Artículo eliminado");
    await load();
    onChanged?.();
  };

  const inputCls = "h-9 px-3 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-amber-500/50";

  const row = (d: Draft, set: (d: Draft) => void) => (
    <>
      <input value={d.icon} onChange={e => set({ ...d, icon: e.target.value })} placeholder="🍽️" maxLength={4} className={`${inputCls} w-14 text-center`} />
      <input value={d.name} onChange={e => set({ ...d, name: e.target.value })} placeholder="Nombre del artículo" className={`${inputCls} flex-1 min-w-[160px]`} />
      <div className="flex items-center gap-1">
        <span className="text-xs text-white/40">$</span>
        <input type="number" min={0} step="0.01" value={d.damage_price} onChange={e => set({ ...d, damage_price: e.target.value })} placeholder="0.00" className={`${inputCls} w-24`} />
      </div>
      <input type="number" min={0} step={1} value={d.min_available} onChange={e => set({ ...d, min_available: e.target.value })}
        placeholder="Mín." title="Alerta en Inventario cuando los disponibles bajan de este número" className={`${inputCls} w-20`} />
    </>
  );

  return (
    <div className="max-w-3xl mx-auto w-full space-y-4">
      <p className="text-sm text-white/50">
        El precio por daño es el monto <strong className="text-white/70">sugerido</strong> cuando un artículo falta; recepción puede ajustarlo al cobrar.
        El mínimo es opcional: avisa en Inventario cuando quedan pocos disponibles.
      </p>

      <div className="flex flex-wrap items-center gap-2 bg-black/20 p-3 rounded-xl border border-white/5">
        {row(newItem, setNewItem)}
        <button onClick={create} disabled={busy === "new"}
          className="h-9 px-4 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      <div className="space-y-2">
        {items.map(item => {
          const d = drafts[item.id];
          if (!d) return null;
          const dirty = JSON.stringify(d) !== JSON.stringify(toDraft(item));
          return (
            <div key={item.id} className={`flex flex-wrap items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 ${item.is_active ? "" : "opacity-50"}`}>
              {row(d, next => setDrafts({ ...drafts, [item.id]: next }))}
              <button onClick={() => setActive(item, !item.is_active)} disabled={busy === item.id}
                title={item.is_active ? "Desactivar: deja de prestarse" : "Activar"}
                className={`h-9 px-2.5 rounded-lg text-xs border disabled:opacity-50 ${item.is_active ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" : "border-white/10 text-white/50 hover:bg-white/5"}`}>
                {item.is_active ? "Activo" : "Inactivo"}
              </button>
              <button onClick={() => save(item.id)} disabled={!dirty || busy === item.id} title="Guardar cambios"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-amber-400 hover:bg-amber-500/10 disabled:opacity-30 disabled:hover:bg-transparent">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={() => remove(item)} disabled={busy === item.id} title="Eliminar"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
