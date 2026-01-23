"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SimpleProduct, Subcategory } from "@/lib/types/inventory";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { createClient } from "@/lib/supabase/client";

interface ProductModalFormProps {
    product: SimpleProduct | null;
    categories: any[];
    suppliers: any[];
    onSave: (data: any) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export function ProductModalForm({
    product,
    categories,
    suppliers,
    onSave,
    onCancel,
    isLoading = false
}: ProductModalFormProps) {
    const [formData, setFormData] = useState({
        name: product?.name || "",
        description: product?.description || "",
        sku: product?.sku || product?.barcode || "",
        price: product?.price || 0,
        cost: product?.cost || 0,
        min_stock: product?.min_stock || 0,
        unit: product?.unit || "EA",
        barcode: product?.barcode || "",
        category_id: product?.category?.id || "",
        subcategory_id: (product as any)?.subcategory_id || "",
        supplier_id: (product as any)?.supplier_id || "",
        is_active: product?.is_active ?? true,
    });

    const [showScanner, setShowScanner] = useState(false);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
    const [loadingSubcategories, setLoadingSubcategories] = useState(false);

    // Cargar subcategorías cuando cambia la categoría seleccionada
    useEffect(() => {
        const fetchSubcategories = async () => {
            if (!formData.category_id) {
                setSubcategories([]);
                setFormData(prev => ({ ...prev, subcategory_id: "" }));
                return;
            }

            setLoadingSubcategories(true);
            const supabase = createClient();

            try {
                const { data, error } = await supabase
                    .from("subcategories")
                    .select("*")
                    .eq("category_id", formData.category_id)
                    .eq("is_active", true)
                    .order("name", { ascending: true });

                if (error) {
                    console.warn("Error fetching subcategories:", error);
                    setSubcategories([]);
                } else {
                    setSubcategories(data || []);
                }
            } catch (err) {
                console.error("Error:", err);
                setSubcategories([]);
            } finally {
                setLoadingSubcategories(false);
            }
        };

        fetchSubcategories();
    }, [formData.category_id]);

    // Mantener el SKU sincronizado con el código de barras si no se ha escrito uno manual
    useEffect(() => {
        if (!product) { // Solo al crear
            setFormData(prev => ({ ...prev, sku: formData.barcode || prev.sku }));
        }
    }, [formData.barcode, product]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Enviar subcategory_id solo si tiene valor
        const dataToSave = {
            ...formData,
            subcategory_id: formData.subcategory_id || null
        };
        onSave(dataToSave);
    };

    const handleCategoryChange = (categoryId: string) => {
        setFormData({
            ...formData,
            category_id: categoryId,
            subcategory_id: "" // Resetear subcategoría al cambiar categoría
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Nombre del producto"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Categoría</label>
                    {categories.length > 0 ? (
                        <select
                            value={formData.category_id}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                        >
                            <option value="">Sin categoría</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/20">
                            No hay categorías
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Subcategoría</label>
                    {loadingSubcategories ? (
                        <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/20 flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            Cargando...
                        </div>
                    ) : !formData.category_id ? (
                        <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/20">
                            Selecciona una categoría primero
                        </div>
                    ) : subcategories.length > 0 ? (
                        <select
                            value={formData.subcategory_id}
                            onChange={(e) => setFormData({ ...formData, subcategory_id: e.target.value })}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                        >
                            <option value="">Sin subcategoría</option>
                            {subcategories.map((subcategory) => (
                                <option key={subcategory.id} value={subcategory.id}>
                                    {subcategory.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/20">
                            No hay subcategorías
                        </div>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Proveedor</label>
                {suppliers.length > 0 ? (
                    <select
                        value={formData.supplier_id}
                        onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                    >
                        <option value="">Sin proveedor</option>
                        {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/20">
                        No hay proveedores
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-2">
                <div>
                    <label className="block text-sm font-medium mb-1">Precio Venta *</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                            className="pl-7"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            required
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Costo *</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                            className="pl-7"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.cost}
                            onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            required
                        />
                    </div>
                </div>
            </div>

            {/* Margen de ganancia calculado */}
            {formData.price > 0 && formData.cost > 0 && (
                <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="text-sm font-medium">
                        Margen de Ganancia:
                        <span className={`ml-2 ${((formData.price - formData.cost) / formData.cost * 100) > 50 ? 'text-green-600' :
                            ((formData.price - formData.cost) / formData.cost * 100) > 20 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                            {((formData.price - formData.cost) / formData.cost * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Ganancia por unidad: ${(formData.price - formData.cost).toFixed(2)}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Stock Mínimo</label>
                    <Input
                        type="number"
                        min="0"
                        value={formData.min_stock}
                        onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                        placeholder="Cantidad mínima en stock"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Unidad</label>
                    <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    >
                        <option value="PZ">PZ - Pieza</option>
                        <option value="KG">KG - Kilogramo</option>
                        <option value="LT">LT - Litro</option>
                        <option value="MT">MT - Metro</option>
                        <option value="EA">EA - Each (Cada uno)</option>
                        <option value="PAQ">PAQ - Paquete</option>
                        <option value="CAJ">CAJ - Caja</option>
                        <option value="BOL">BOL - Bolsa</option>
                        <option value="PZBOT">PZBOT - Botella grande</option>
                        <option value="PZBOTAN">PZBOTAN - Botella anforita</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción detallada del producto"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background min-h-[80px] resize-none"
                    rows={3}
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Código de Barras</label>
                <div className="flex gap-2">
                    <Input
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="Código de barras del producto"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowScanner(true)}
                        className="px-3"
                        title="Escanear código"
                    >
                        <span className="sr-only">Escanear</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-scan"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /></svg>
                    </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                    El SKU se genera automáticamente del código de barras
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    SKU *
                    <span className="text-xs text-muted-foreground ml-2">(Se genera automáticamente del código de barras)</span>
                </label>
                <Input
                    value={formData.sku}
                    disabled={true}
                    required
                    className="bg-muted"
                    placeholder="Se genera automáticamente..."
                />
            </div>

            <div className="flex items-center gap-2 pt-2">
                <input
                    id="is_active"
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" className="text-sm font-medium">Producto activo</label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Guardando...</span>
                        </div>
                    ) : (
                        product ? "Actualizar" : "Crear"
                    )}
                </Button>
            </div>

            {/* Escáner de código de barras */}
            {showScanner && (
                <BarcodeScanner
                    onScan={(code) => {
                        setFormData({ ...formData, barcode: code });
                        setShowScanner(false);
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </form>
    );
}
