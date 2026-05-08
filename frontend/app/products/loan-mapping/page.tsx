"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Plus, Trash2, Utensils, Info } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: { name: string } | null;
}

interface LoanCatalogItem {
  id: string;
  name: string;
  icon: string | null;
}

interface ProductLoanLink {
  id: string;
  product_id: string;
  loan_item_id: string;
  quantity: number;
  loan_item: LoanCatalogItem;
}

export default function LoanMappingPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [catalog, setCatalog] = useState<LoanCatalogItem[]>([]);
  const [links, setLinks] = useState<ProductLoanLink[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // New Link State
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load active products
        const { data: pData, error: pErr } = await supabase
          .from("products")
          .select("id, name, sku, category:categories(name)")
          .eq("status", "ACTIVE")
          .order("name");
        if (pErr) throw pErr;
        
        // Load catalog
        const { data: cData, error: cErr } = await supabase
          .from("loan_item_catalog")
          .select("*")
          .order("name");
        if (cErr) throw cErr;

        // Load links
        const { data: lData, error: lErr } = await supabase
          .from("product_loan_links")
          .select("id, product_id, loan_item_id, quantity, loan_item:loan_item_catalog(id, name, icon)");
        if (lErr) throw lErr;

        setProducts(pData || []);
        setCatalog(cData || []);
        setLinks(lData || []);
      } catch (err: unknown) {
        if (err instanceof Error) {
          toast.error("Error al cargar datos", { description: err.message });
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [supabase]);

  const handleAddLink = async () => {
    if (!selectedProduct || !selectedItem || quantity < 1) {
      toast.warning("Incompleto", { description: "Selecciona un producto, artículo y cantidad." });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("product_loan_links")
        .insert({
          product_id: selectedProduct,
          loan_item_id: selectedItem,
          quantity
        })
        .select("id, product_id, loan_item_id, quantity, loan_item:loan_item_catalog(id, name, icon)")
        .single();

      if (error) throw error;
      
      setLinks([...links, data]);
      toast.success("Vínculo creado exitosamente");
      setSelectedItem("");
      setQuantity(1);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error("Error al vincular", { description: err.message });
      }
    }
  };

  const handleDeleteLink = async (id: string) => {
    try {
      const { error } = await supabase.from("product_loan_links").delete().eq("id", id);
      if (error) throw error;
      setLinks(links.filter(l => l.id !== id));
      toast.success("Vínculo eliminado");
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error("Error al eliminar", { description: err.message });
      }
    }
  };

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(s) || (p.sku && p.sku.toLowerCase().includes(s)));
  }, [products, search]);

  if (loading) return <div className="p-8 text-white/50 animate-pulse">Cargando sistema de loza...</div>;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* HEADER */}
      <header className="px-6 py-5 border-b border-white/10 bg-white/[0.02] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-6xl mx-auto w-full">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <Utensils className="w-5 h-5 text-amber-500" />
              Vinculación de Loza y Préstamos
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Asigna platos, vasos o hieleras a los productos. Se asignarán automáticamente a la habitación cuando se vendan.
            </p>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMNA IZQ: BUSCADOR Y LISTA DE PRODUCTOS */}
          <div className="lg:col-span-1 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
            
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              {filteredProducts.map(p => {
                const isSelected = selectedProduct === p.id;
                const pLinks = links.filter(l => l.product_id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20" : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                    }`}
                  >
                    <p className="text-sm font-medium text-white/90 truncate">{p.name}</p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-[10px] text-white/40">{p.category?.name || "Sin categoría"}</p>
                      {pLinks.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                          {pLinks.length} items
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <p className="text-center text-sm text-white/30 py-8">No se encontraron productos.</p>
              )}
            </div>
          </div>

          {/* COLUMNA DER: VINCULACIÓN DEL PRODUCTO SELECCIONADO */}
          <div className="lg:col-span-2">
            {!selectedProduct ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                <Utensils className="w-10 h-10 text-white/20 mb-3" />
                <p className="text-white/40 text-sm">Selecciona un producto a la izquierda para configurar su loza.</p>
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 shadow-xl">
                <div className="mb-6 pb-6 border-b border-white/10">
                  <h2 className="text-lg font-medium text-white">
                    {products.find(p => p.id === selectedProduct)?.name}
                  </h2>
                  <p className="text-xs text-white/40 mt-1">Configura qué artículos físicos se deben entregar con este producto.</p>
                </div>

                {/* FORMULARIO DE AGREGAR */}
                <div className="flex flex-wrap items-end gap-3 mb-8 bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5 font-medium">Artículo de Catálogo</label>
                    <Select value={selectedItem} onValueChange={setSelectedItem}>
                      <SelectTrigger className="h-9 bg-white/[0.03] border-white/10 text-sm w-full">
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141420]/95 backdrop-blur-xl border-white/10 text-white">
                        {catalog.map(c => (
                          <SelectItem key={c.id} value={c.id} className="cursor-pointer focus:bg-white/10">
                            {c.icon} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5 font-medium">Cant.</label>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full h-9 px-3 rounded-md bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                  </div>
                  <button
                    onClick={handleAddLink}
                    className="h-9 px-4 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Agregar
                  </button>
                </div>

                {/* LISTA ACTUAL */}
                <h3 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-500" />
                  Artículos actualmente vinculados
                </h3>
                
                <div className="space-y-2">
                  {links.filter(l => l.product_id === selectedProduct).length === 0 ? (
                    <p className="text-sm text-white/30 italic py-4">Este producto no tiene artículos vinculados. No se asignará loza automáticamente.</p>
                  ) : (
                    links.filter(l => l.product_id === selectedProduct).map(link => (
                      <div key={link.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-lg">
                            {link.loan_item.icon}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white/90">{link.loan_item.name}</p>
                            <p className="text-[11px] text-amber-400/80">Cantidad por orden: {link.quantity}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                          title="Eliminar vínculo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
