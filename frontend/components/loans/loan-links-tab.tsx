"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Trash2, Utensils, Info, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: { id: string; name: string } | null;
}

interface LoanCatalogItem {
  id: string;
  name: string;
  icon: string | null;
  is_active: boolean;
}

interface ProductLoanLink {
  id: string;
  product_id: string;
  loan_item_id: string;
  quantity: number;
  loan_item: LoanCatalogItem;
}

type LinkFilter = "todos" | "con" | "sin";
const ALL_CATEGORIES = "__all__";
const LINK_SELECT = "id, product_id, loan_item_id, quantity, loan_item:loan_item_catalog(id, name, icon, is_active)";

const selectTriggerCls = "h-9 bg-white/[0.03] border-white/10 text-sm w-full";
const selectContentCls = "bg-[#141420]/95 backdrop-blur-xl border-white/10 text-white";
const inputCls = "h-9 px-3 rounded-md bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50";
const labelCls = "block text-[10px] uppercase tracking-wider text-white/40 mb-1.5 font-medium";

/** Qué artículos físicos se entregan con cada producto (y cuántos por unidad vendida). */
export function LoanLinksTab({ reloadKey }: { reloadKey: number }) {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [catalog, setCatalog] = useState<LoanCatalogItem[]>([]);
  const [links, setLinks] = useState<ProductLoanLink[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);

  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  // Cantidades editadas sin guardar, por vínculo
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});

  // Vincular un artículo a toda una categoría
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState({ categoryId: "", itemId: "", quantity: 1 });
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [pRes, cRes, lRes] = await Promise.all([
          supabase.from("products").select("id, name, sku, category:categories(id, name)").eq("is_active", true).order("name"),
          supabase.from("loan_item_catalog").select("id, name, icon, is_active").order("name"),
          supabase.from("product_loan_links").select(LINK_SELECT),
        ]);
        if (pRes.error) throw pRes.error;
        if (cRes.error) throw cRes.error;
        if (lRes.error) throw lRes.error;
        setProducts(pRes.data || []);
        setCatalog(cRes.data || []);
        setLinks(lRes.data || []);
      } catch (err: unknown) {
        if (err instanceof Error) toast.error("Error al cargar datos", { description: err.message });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [supabase, reloadKey]);

  const activeCatalog = useMemo(() => catalog.filter(c => c.is_active), [catalog]);

  const linksByProduct = useMemo(() => {
    const map = new Map<string, ProductLoanLink[]>();
    for (const l of links) map.set(l.product_id, [...(map.get(l.product_id) || []), l]);
    return map;
  }, [links]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) if (p.category) map.set(p.category.id, p.category.name.trim());
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter(p => {
      if (s && !p.name.toLowerCase().includes(s) && !(p.sku && p.sku.toLowerCase().includes(s))) return false;
      if (categoryFilter !== ALL_CATEGORIES && p.category?.id !== categoryFilter) return false;
      const linked = (linksByProduct.get(p.id)?.length || 0) > 0;
      if (linkFilter === "con" && !linked) return false;
      if (linkFilter === "sin" && linked) return false;
      return true;
    });
  }, [products, search, categoryFilter, linkFilter, linksByProduct]);

  const handleAddLink = async () => {
    if (!selectedProduct || !selectedItem || quantity < 1) {
      toast.warning("Incompleto", { description: "Selecciona un producto, artículo y cantidad." });
      return;
    }
    const { data, error } = await supabase
      .from("product_loan_links")
      .insert({ product_id: selectedProduct, loan_item_id: selectedItem, quantity })
      .select(LINK_SELECT)
      .single();
    if (error) {
      toast.error("Error al vincular", {
        description: error.code === "23505" ? "Este producto ya tiene ese artículo vinculado: cambia la cantidad en la lista." : error.message,
      });
      return;
    }
    setLinks([...links, data]);
    toast.success("Vínculo creado");
    setSelectedItem("");
    setQuantity(1);
  };

  const handleSaveQuantity = async (link: ProductLoanLink) => {
    const draft = qtyDrafts[link.id];
    const next = Number(draft);
    if (draft === undefined || next === link.quantity) return;
    if (!Number.isInteger(next) || next < 1) {
      toast.warning("La cantidad debe ser un número entero mayor a 0");
      return;
    }
    const { error } = await supabase.from("product_loan_links").update({ quantity: next }).eq("id", link.id);
    if (error) { toast.error("No se pudo guardar", { description: error.message }); return; }
    setLinks(links.map(l => l.id === link.id ? { ...l, quantity: next } : l));
    setQtyDrafts(prev => { const next = { ...prev }; delete next[link.id]; return next; });
    toast.success(`${link.loan_item.name}: ${next} por unidad`);
  };

  const handleDeleteLink = async (id: string) => {
    const { error } = await supabase.from("product_loan_links").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar", { description: error.message }); return; }
    setLinks(links.filter(l => l.id !== id));
    toast.success("Vínculo eliminado");
  };

  // Productos de la categoría elegida que aún no tienen el artículo
  const bulkTargets = useMemo(() => {
    if (!bulk.categoryId || !bulk.itemId) return [];
    return products.filter(p => p.category?.id === bulk.categoryId &&
      !(linksByProduct.get(p.id) || []).some(l => l.loan_item_id === bulk.itemId));
  }, [bulk, products, linksByProduct]);

  const handleBulkLink = async () => {
    if (bulkTargets.length === 0 || bulk.quantity < 1) return;
    const item = catalog.find(c => c.id === bulk.itemId);
    const category = categories.find(c => c.id === bulk.categoryId);
    if (!window.confirm(`¿Vincular ${item?.name} x${bulk.quantity} a ${bulkTargets.length} productos de ${category?.name}?`)) return;
    setBulkBusy(true);
    const { data, error } = await supabase
      .from("product_loan_links")
      .upsert(
        bulkTargets.map(p => ({ product_id: p.id, loan_item_id: bulk.itemId, quantity: bulk.quantity })),
        { onConflict: "product_id,loan_item_id", ignoreDuplicates: true }
      )
      .select(LINK_SELECT);
    setBulkBusy(false);
    if (error) { toast.error("No se pudo vincular", { description: error.message }); return; }
    setLinks([...links, ...(data || [])]);
    toast.success(`${data?.length || 0} productos vinculados a ${item?.name}`);
    setBulk({ categoryId: "", itemId: "", quantity: 1 });
    setBulkOpen(false);
  };

  if (loading) return <div className="p-8 text-white/50 animate-pulse">Cargando vínculos...</div>;

  const selected = products.find(p => p.id === selectedProduct);
  const selectedLinks = linksByProduct.get(selectedProduct) || [];
  const unlinkedCount = products.filter(p => !linksByProduct.has(p.id)).length;

  return (
    <div className="max-w-6xl mx-auto w-full space-y-4">
      {/* VINCULAR CATEGORÍA COMPLETA */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02]">
        <button onClick={() => setBulkOpen(o => !o)} className="w-full flex items-center gap-2 px-4 h-10 text-sm text-white/70 hover:text-white">
          <Layers className="w-4 h-4 text-amber-500" /> Vincular un artículo a toda una categoría
        </button>
        {bulkOpen && (
          <div className="flex flex-wrap items-end gap-3 px-4 pb-4">
            <div className="flex-1 min-w-[180px]">
              <label className={labelCls}>Categoría</label>
              <Select value={bulk.categoryId} onValueChange={v => setBulk({ ...bulk, categoryId: v })}>
                <SelectTrigger className={selectTriggerCls}><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent className={selectContentCls}>
                  {categories.map(c => <SelectItem key={c.id} value={c.id} className="cursor-pointer focus:bg-white/10">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className={labelCls}>Artículo</label>
              <Select value={bulk.itemId} onValueChange={v => setBulk({ ...bulk, itemId: v })}>
                <SelectTrigger className={selectTriggerCls}><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent className={selectContentCls}>
                  {activeCatalog.map(c => <SelectItem key={c.id} value={c.id} className="cursor-pointer focus:bg-white/10">{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <label className={labelCls}>Cant.</label>
              <input type="number" min={1} value={bulk.quantity}
                onChange={e => setBulk({ ...bulk, quantity: parseInt(e.target.value) || 1 })} className={`${inputCls} w-full`} />
            </div>
            <button onClick={handleBulkLink} disabled={bulkBusy || bulkTargets.length === 0}
              className="h-9 px-4 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-40">
              <Plus className="w-4 h-4" />
              {bulk.categoryId && bulk.itemId ? `Vincular ${bulkTargets.length} productos` : "Vincular"}
            </button>
            {bulk.categoryId && bulk.itemId && (
              <p className="w-full text-xs text-white/40">
                {bulkTargets.length === 0
                  ? "Todos los productos de esa categoría ya tienen este artículo."
                  : "Solo se agrega a los que aún no lo tienen; los vínculos existentes no cambian."}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA IZQ: BUSCADOR, FILTROS Y LISTA DE PRODUCTOS */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
            <input type="text" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/10 shrink-0">
              {([["todos", "Todos"], ["con", "Con"], ["sin", `Sin (${unlinkedCount})`]] as [LinkFilter, string][]).map(([id, label]) => (
                <button key={id} onClick={() => setLinkFilter(id)}
                  className={`px-2 h-7 rounded-md text-xs ${linkFilter === id ? "bg-amber-500/15 text-amber-300" : "text-white/50 hover:text-white/80"}`}>
                  {label}
                </button>
              ))}
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 bg-white/[0.03] border-white/10 text-xs flex-1 min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value={ALL_CATEGORIES} className="cursor-pointer focus:bg-white/10">Todas las categorías</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id} className="cursor-pointer focus:bg-white/10">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
            {filteredProducts.map(p => {
              const isSelected = selectedProduct === p.id;
              const pLinks = linksByProduct.get(p.id) || [];
              return (
                <button key={p.id} onClick={() => setSelectedProduct(p.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20" : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                  }`}>
                  <p className="text-sm font-medium text-white/90 truncate">{p.name}</p>
                  <div className="flex justify-between items-center mt-1 gap-2">
                    <p className="text-[10px] text-white/40 truncate">{p.category?.name || "Sin categoría"}</p>
                    {pLinks.length > 0 && (
                      <span className="text-xs shrink-0" title={pLinks.map(l => `${l.loan_item.name} x${l.quantity}`).join(", ")}>
                        {pLinks.map(l => <span key={l.id} className={l.loan_item.is_active ? "" : "opacity-30"}>{l.loan_item.icon || "•"}</span>)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {filteredProducts.length === 0 && <p className="text-center text-sm text-white/30 py-8">No se encontraron productos.</p>}
          </div>
        </div>

        {/* COLUMNA DER: VINCULACIÓN DEL PRODUCTO SELECCIONADO */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <Utensils className="w-10 h-10 text-white/20 mb-3" />
              <p className="text-white/40 text-sm">Selecciona un producto a la izquierda para configurar sus artículos.</p>
            </div>
          ) : (
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 shadow-xl">
              <div className="mb-6 pb-6 border-b border-white/10">
                <h2 className="text-lg font-medium text-white">{selected.name}</h2>
                <p className="text-xs text-white/40 mt-1">Configura qué artículos físicos se deben entregar con este producto.</p>
              </div>

              <div className="flex flex-wrap items-end gap-3 mb-8 bg-black/20 p-4 rounded-xl border border-white/5">
                <div className="flex-1 min-w-[200px]">
                  <label className={labelCls}>Artículo de Catálogo</label>
                  <Select value={selectedItem} onValueChange={setSelectedItem}>
                    <SelectTrigger className={selectTriggerCls}><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                    <SelectContent className={selectContentCls}>
                      {activeCatalog.map(c => <SelectItem key={c.id} value={c.id} className="cursor-pointer focus:bg-white/10">{c.icon} {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <label className={labelCls}>Cant.</label>
                  <input type="number" min={1} value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className={`${inputCls} w-full`} />
                </div>
                <button onClick={handleAddLink}
                  className="h-9 px-4 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Agregar
                </button>
              </div>

              <h3 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-500" />
                Artículos actualmente vinculados
              </h3>

              <div className="space-y-2">
                {selectedLinks.length === 0 ? (
                  <p className="text-sm text-white/30 italic py-4">Este producto no tiene artículos vinculados. No se asignarán artículos físicos automáticamente.</p>
                ) : selectedLinks.map(link => {
                  const draft = qtyDrafts[link.id];
                  const dirty = draft !== undefined && Number(draft) !== link.quantity;
                  return (
                    <div key={link.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-lg shrink-0">{link.loan_item.icon}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate">{link.loan_item.name}</p>
                          {!link.loan_item.is_active && <p className="text-[11px] text-white/40">Inactivo: ya no se presta</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-[11px] text-white/40">Por unidad</label>
                        <input type="number" min={1} value={draft ?? link.quantity}
                          onChange={e => setQtyDrafts({ ...qtyDrafts, [link.id]: e.target.value })}
                          onBlur={() => handleSaveQuantity(link)}
                          onKeyDown={e => { if (e.key === "Enter") handleSaveQuantity(link); }}
                          className={`${inputCls} w-16 h-8 ${dirty ? "border-amber-500/50" : ""}`} />
                        <button onClick={() => handleDeleteLink(link.id)} title="Eliminar vínculo"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
