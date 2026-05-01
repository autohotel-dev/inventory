"use client";

import { useState, useEffect } from "react";
import { PROMO_CONDITIONS } from "@/lib/promo-conditions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    Tag,
    Plus,
    Edit,
    Trash2,
    Save,
    Loader2,
    Percent,
    DollarSign,
    Package,
    Search,
} from "lucide-react";

// ---- Types ----

type PromoType = "NxM" | "PERCENT_DISCOUNT" | "FIXED_PRICE";

interface ProductPromotion {
    id: string;
    name: string;
    promo_type: PromoType;
    buy_quantity: number | null;
    pay_quantity: number | null;
    discount_percent: number | null;
    fixed_price: number | null;
    product_id: string | null;
    category_id: string | null;
    subcategory_id: string | null;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    // Relations
    product?: { id: string; name: string; price: number } | null;
    category?: { id: string; name: string } | null;
    subcategory?: { id: string; name: string } | null;
    conditions?: Record<string, any> | null;
}

interface FormData {
    name: string;
    promo_type: PromoType;
    buy_quantity: number;
    pay_quantity: number;
    discount_percent: number;
    fixed_price: number;
    scope: "product" | "category";
    product_id: string;
    category_id: string;
    subcategory_id: string;
    is_active: boolean;
    start_date: string;
    end_date: string;
    conditions: Record<string, any>;
}

interface SimpleProduct {
    id: string;
    name: string;
    price: number;
    sku: string;
}

interface SimpleCategory {
    id: string;
    name: string;
}

interface SimpleSubcategory {
    id: string;
    name: string;
    category_id: string;
}

const defaultFormData: FormData = {
    name: "",
    promo_type: "NxM",
    buy_quantity: 2,
    pay_quantity: 1,
    discount_percent: 10,
    fixed_price: 0,
    scope: "product",
    product_id: "",
    category_id: "",
    subcategory_id: "",
    is_active: true,
    start_date: "",
    end_date: "",
    conditions: {},
};

const PROMO_TYPE_LABELS: Record<PromoType, { label: string; icon: React.ReactNode; color: string }> = {
    NxM: { label: "NxM", icon: <Package className="h-3.5 w-3.5" />, color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
    PERCENT_DISCOUNT: { label: "% Desc.", icon: <Percent className="h-3.5 w-3.5" />, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    FIXED_PRICE: { label: "Precio Fijo", icon: <DollarSign className="h-3.5 w-3.5" />, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

// ---- Component ----

export function ProductPromotions() {
    const [promotions, setPromotions] = useState<ProductPromotion[]>([]);
    const [products, setProducts] = useState<SimpleProduct[]>([]);
    const [categories, setCategories] = useState<SimpleCategory[]>([]);
    const [subcategories, setSubcategories] = useState<SimpleSubcategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState<ProductPromotion | null>(null);
    const [formData, setFormData] = useState<FormData>(defaultFormData);
    const [deleteConfirm, setDeleteConfirm] = useState<ProductPromotion | null>(null);
    const [productSearch, setProductSearch] = useState("");

    // ---- Data loading ----

    const fetchPromotions = async () => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("product_promotions")
            .select(`
                *,
                product:products(id, name, price),
                category:categories!product_promotions_category_id_fkey(id, name),
                subcategory:subcategories(id, name)
            `)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching promotions:", error);
            toast.error("Error al cargar promociones");
        } else {
            setPromotions(data || []);
        }
    };

    useEffect(() => {
        const fetchAll = async () => {
            const supabase = createClient();

            // Fetch promotions
            await fetchPromotions();

            // Fetch products for selector
            const { data: prodData } = await supabase
                .from("products")
                .select("id, name, price, sku")
                .eq("is_active", true)
                .neq("sku", "SVC-ROOM")
                .neq("sku", "SVC-DAMAGE")
                .order("name");
            setProducts(prodData || []);

            // Fetch categories
            const { data: catData } = await supabase
                .from("categories")
                .select("id, name")
                .order("name");
            setCategories(catData || []);

            // Fetch subcategories
            const { data: subData } = await supabase
                .from("subcategories")
                .select("id, name, category_id")
                .order("name");
            setSubcategories(subData || []);

            setLoading(false);
        };

        fetchAll();
    }, []);

    // ---- CRUD ----

    const openAddModal = () => {
        setEditingPromo(null);
        setFormData(defaultFormData);
        setProductSearch("");
        setIsModalOpen(true);
    };

    const openEditModal = (promo: ProductPromotion) => {
        setEditingPromo(promo);
        setFormData({
            name: promo.name,
            promo_type: promo.promo_type,
            buy_quantity: promo.buy_quantity || 2,
            pay_quantity: promo.pay_quantity || 1,
            discount_percent: promo.discount_percent || 10,
            fixed_price: promo.fixed_price || 0,
            scope: promo.product_id ? "product" : "category",
            product_id: promo.product_id || "",
            category_id: promo.category_id || "",
            subcategory_id: promo.subcategory_id || "",
            is_active: promo.is_active,
            start_date: promo.start_date ? promo.start_date.slice(0, 16) : "",
            end_date: promo.end_date ? promo.end_date.slice(0, 16) : "",
            conditions: (promo.conditions as any) || {},
        });
        setProductSearch(promo.product?.name || "");
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        // Validations
        if (!formData.name.trim()) {
            toast.error("Ingresa un nombre para la promoción");
            return;
        }

        if (formData.scope === "product" && !formData.product_id) {
            toast.error("Selecciona un producto");
            return;
        }

        if (formData.scope === "category" && !formData.category_id) {
            toast.error("Selecciona una categoría");
            return;
        }

        if (formData.promo_type === "NxM") {
            if (formData.buy_quantity < 2 || formData.pay_quantity < 1 || formData.pay_quantity >= formData.buy_quantity) {
                toast.error("Las cantidades NxM deben ser válidas (N > M ≥ 1)");
                return;
            }
        }

        if (formData.promo_type === "PERCENT_DISCOUNT") {
            if (formData.discount_percent <= 0 || formData.discount_percent > 100) {
                toast.error("El descuento debe estar entre 1% y 100%");
                return;
            }
        }

        if (formData.promo_type === "FIXED_PRICE" && formData.fixed_price <= 0) {
            toast.error("El precio fijo debe ser mayor a 0");
            return;
        }

        setSaving(true);
        const supabase = createClient();

        try {
            const payload = {
                name: formData.name.trim(),
                promo_type: formData.promo_type,
                buy_quantity: formData.promo_type === "NxM" ? formData.buy_quantity : null,
                pay_quantity: formData.promo_type === "NxM" ? formData.pay_quantity : null,
                discount_percent: formData.promo_type === "PERCENT_DISCOUNT" ? formData.discount_percent : null,
                fixed_price: formData.promo_type === "FIXED_PRICE" ? formData.fixed_price : null,
                product_id: formData.scope === "product" ? formData.product_id : null,
                category_id: formData.scope === "category" ? formData.category_id : null,
                subcategory_id: formData.scope === "category" && formData.subcategory_id ? formData.subcategory_id : null,
                is_active: formData.is_active,
                start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
                end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
                conditions: formData.conditions,
                updated_at: new Date().toISOString(),
            };

            if (editingPromo) {
                const { error } = await supabase
                    .from("product_promotions")
                    .update(payload)
                    .eq("id", editingPromo.id);
                if (error) throw error;
                toast.success("Promoción actualizada");
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                const { error } = await supabase
                    .from("product_promotions")
                    .insert({ ...payload, created_by: user?.id || null });
                if (error) throw error;
                toast.success("Promoción creada");
            }

            await fetchPromotions();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving promotion:", error);
            toast.error("Error al guardar la promoción");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        const supabase = createClient();
        const { error } = await supabase
            .from("product_promotions")
            .delete()
            .eq("id", deleteConfirm.id);

        if (error) {
            toast.error("Error al eliminar la promoción");
        } else {
            setPromotions(prev => prev.filter(p => p.id !== deleteConfirm.id));
            toast.success("Promoción eliminada");
        }
        setDeleteConfirm(null);
    };

    const toggleActive = async (promo: ProductPromotion) => {
        const supabase = createClient();
        const { error } = await supabase
            .from("product_promotions")
            .update({ is_active: !promo.is_active, updated_at: new Date().toISOString() })
            .eq("id", promo.id);

        if (error) {
            toast.error("Error al cambiar el estado");
        } else {
            setPromotions(prev =>
                prev.map(p => (p.id === promo.id ? { ...p, is_active: !p.is_active } : p))
            );
        }
    };

    // ---- Helpers ----

    const getPromoDescription = (promo: ProductPromotion): string => {
        switch (promo.promo_type) {
            case "NxM":
                return `Compra ${promo.buy_quantity}, paga ${promo.pay_quantity}`;
            case "PERCENT_DISCOUNT":
                return `${promo.discount_percent}% de descuento`;
            case "FIXED_PRICE":
                return `$${promo.fixed_price?.toFixed(2)} precio especial`;
            default:
                return "";
        }
    };

    const getScopeLabel = (promo: ProductPromotion): string => {
        if (promo.product) return promo.product.name;
        if (promo.subcategory) return `${promo.category?.name || ""} → ${promo.subcategory.name}`;
        if (promo.category) return promo.category.name;
        return "Sin definir";
    };

    const isPromoCurrentlyActive = (promo: ProductPromotion): boolean => {
        if (!promo.is_active) return false;
        const now = new Date();
        if (promo.start_date && new Date(promo.start_date) > now) return false;
        if (promo.end_date && new Date(promo.end_date) < now) return false;
        return true;
    };

    const filteredProducts = products.filter(p =>
        !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())
    );

    const filteredSubcategories = subcategories.filter(s =>
        !formData.category_id || s.category_id === formData.category_id
    );

    // ---- Render ----

    if (loading) {
        return (
            <Card className="border-0 shadow-md">
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-md overflow-hidden">
                <CardHeader className="pb-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 text-white shadow-md shadow-rose-500/20">
                                <Tag className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold">Promociones de Productos</CardTitle>
                                <CardDescription>
                                    Configura descuentos y ofertas especiales
                                </CardDescription>
                            </div>
                        </div>
                        <Button onClick={openAddModal} className="gap-2 shadow-sm">
                            <Plus className="h-4 w-4" />
                            Nueva Promoción
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {promotions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="p-4 rounded-full bg-rose-50 dark:bg-rose-900/10 mb-4 animate-in zoom-in-50 duration-500">
                                <Tag className="h-10 w-10 text-rose-500/50" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">No hay promociones activas</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
                                Crea tu primera promoción para aumentar las ventas y atraer más clientes.
                            </p>
                            <Button variant="outline" onClick={openAddModal} className="group">
                                Crear Promoción
                                <Plus className="ml-2 h-4 w-4 transition-transform group-hover:rotate-90" />
                            </Button>
                        </div>
                    ) : (
                        <div className="rounded-md border-t border-border/50">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-[30%]">Promoción</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Alcance</TableHead>
                                        <TableHead>Detalle</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                        <TableHead className="text-right pr-6">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {promotions.map((promo) => {
                                        const typeInfo = PROMO_TYPE_LABELS[promo.promo_type];
                                        const active = isPromoCurrentlyActive(promo);
                                        const conditions = promo.conditions as any || {};

                                        return (
                                            <TableRow
                                                key={promo.id}
                                                className={`transition-colors hover:bg-muted/30 ${!active ? "opacity-60 bg-muted/10" : ""}`}
                                            >
                                                <TableCell className="py-3 pl-6">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-foreground">{promo.name}</span>
                                                        {(promo.start_date || promo.end_date) && (
                                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                                                                {promo.start_date && <span>Desde {new Date(promo.start_date).toLocaleDateString("es-MX")}</span>}
                                                                {promo.start_date && promo.end_date && <span>—</span>}
                                                                {promo.end_date && <span>Hasta {new Date(promo.end_date).toLocaleDateString("es-MX")}</span>}
                                                            </div>
                                                        )}
                                                        {Object.entries(conditions).map(([key, value]) => {
                                                            const def = PROMO_CONDITIONS[key];
                                                            if (def && value) {
                                                                return (
                                                                    <div key={key} className="mt-1">
                                                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
                                                                            {def.label}
                                                                        </Badge>
                                                                    </div>
                                                                )
                                                            }
                                                            return null;
                                                        })}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`gap-1.5 px-2.5 py-0.5 font-normal border-0 ${typeInfo.color}`}>
                                                        {typeInfo.icon}
                                                        {typeInfo.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="p-1.5 rounded-md bg-muted text-muted-foreground">
                                                            {promo.product ? <Package className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
                                                        </span>
                                                        <span className="text-sm font-medium text-foreground/80">{getScopeLabel(promo)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm font-medium">{getPromoDescription(promo)}</span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <button onClick={() => toggleActive(promo)} className="inline-flex cursor-pointer transition-all active:scale-95">
                                                        {promo.is_active ? (
                                                            <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-200 shadow-none gap-1">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                Activo
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-muted-foreground gap-1">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                                                                Inactivo
                                                            </Badge>
                                                        )}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEditModal(promo)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setDeleteConfirm(promo)}
                                                            className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ---- Add/Edit Modal ---- */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="w-[95vw] sm:w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingPromo ? "Editar Promoción" : "Nueva Promoción"}</DialogTitle>
                        <DialogDescription>
                            Configura los detalles de la oferta
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-4">
                        {/* Nombre */}
                        <div>
                            <Label className="text-sm font-medium">Nombre de la Promoción</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ej: 2x1 Cervezas"
                                className="mt-1.5"
                            />
                        </div>

                        {/* Tipo de Promo */}
                        <div>
                            <Label className="text-sm font-medium">Tipo de Promoción</Label>
                            <div className="grid grid-cols-3 gap-2 mt-1.5">
                                {(Object.entries(PROMO_TYPE_LABELS) as [PromoType, typeof PROMO_TYPE_LABELS[PromoType]][]).map(([key, info]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, promo_type: key })}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${formData.promo_type === key
                                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                                            : "border-border hover:border-muted-foreground/30 text-muted-foreground hover:bg-muted/50"
                                            }`}
                                    >
                                        {info.icon}
                                        <span className="text-xs">{info.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Type-specific fields */}
                        {formData.promo_type === "NxM" && (
                            <div className="p-4 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-800/30 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2 mb-3">
                                    <Package className="h-4 w-4 text-violet-500" />
                                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Compra N, Paga M</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs font-semibold">Compra (N)</Label>
                                        <Input
                                            type="number"
                                            min={2}
                                            max={20}
                                            value={formData.buy_quantity}
                                            onChange={(e) => setFormData({ ...formData, buy_quantity: parseInt(e.target.value) || 2 })}
                                            className="mt-1.5"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold">Paga (M)</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={19}
                                            value={formData.pay_quantity}
                                            onChange={(e) => setFormData({ ...formData, pay_quantity: parseInt(e.target.value) || 1 })}
                                            className="mt-1.5"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-violet-600 dark:text-violet-400 mt-3 font-medium text-center bg-violet-100/50 dark:bg-violet-900/40 py-2 rounded">
                                    El cliente compra <span className="font-bold">{formData.buy_quantity}</span> y paga solo <span className="font-bold">{formData.pay_quantity}</span>
                                </p>
                            </div>
                        )}

                        {formData.promo_type === "PERCENT_DISCOUNT" && (
                            <div className="p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2 mb-3">
                                    <Percent className="h-4 w-4 text-amber-500" />
                                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Descuento Porcentual</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={formData.discount_percent}
                                        onChange={(e) => setFormData({ ...formData, discount_percent: parseFloat(e.target.value) || 0 })}
                                        className="w-full text-lg font-medium"
                                    />
                                    <span className="text-lg font-bold text-amber-600">%</span>
                                </div>
                            </div>
                        )}

                        {formData.promo_type === "FIXED_PRICE" && (
                            <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2 mb-3">
                                    <DollarSign className="h-4 w-4 text-emerald-500" />
                                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Precio Especial</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-medium text-muted-foreground">$</span>
                                    <Input
                                        type="number"
                                        min={0.01}
                                        step={0.01}
                                        value={formData.fixed_price || ""}
                                        onChange={(e) => setFormData({ ...formData, fixed_price: parseFloat(e.target.value) || 0 })}
                                        className="w-full text-lg font-medium"
                                    />
                                    <span className="text-sm text-muted-foreground">MXN</span>
                                </div>
                            </div>
                        )}

                        {/* Scope */}
                        <div>
                            <Label className="text-sm font-medium">Aplica a</Label>
                            <div className="grid grid-cols-2 gap-2 mt-1.5">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, scope: "product", category_id: "", subcategory_id: "" })}
                                    className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${formData.scope === "product"
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border text-muted-foreground hover:border-muted-foreground/30"
                                        }`}
                                >
                                    Producto específico
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, scope: "category", product_id: "" })}
                                    className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${formData.scope === "category"
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border text-muted-foreground hover:border-muted-foreground/30"
                                        }`}
                                >
                                    Categoría
                                </button>
                            </div>
                        </div>

                        {/* Product selector */}
                        {formData.scope === "product" && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                <Label className="text-xs mb-1 block">Buscar Producto</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder="Buscar por nombre o SKU..."
                                        className="pl-8"
                                    />
                                </div>
                                <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg divide-y bg-background/50">
                                    {filteredProducts.slice(0, 20).map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => {
                                                setFormData({ ...formData, product_id: p.id });
                                                setProductSearch(p.name);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors ${formData.product_id === p.id ? "bg-primary/5 text-primary" : ""
                                                }`}
                                        >
                                            <div>
                                                <span className="font-medium">{p.name}</span>
                                                <span className="text-xs text-muted-foreground ml-2">{p.sku}</span>
                                            </div>
                                            <span className="text-xs font-mono text-muted-foreground">${p.price.toFixed(2)}</span>
                                        </button>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <div className="p-3 text-center text-sm text-muted-foreground">
                                            No se encontraron productos
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Category/Subcategory selector */}
                        {formData.scope === "category" && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div>
                                    <Label className="text-xs">Categoría</Label>
                                    <select
                                        value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value, subcategory_id: "" })}
                                        className="w-full px-3 py-2 border rounded-lg bg-background mt-1 focus:ring-2 focus:ring-ring focus:outline-none"
                                    >
                                        <option value="">Seleccionar categoría...</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {formData.category_id && filteredSubcategories.length > 0 && (
                                    <div>
                                        <Label className="text-xs">Subcategoría (opcional)</Label>
                                        <select
                                            value={formData.subcategory_id}
                                            onChange={(e) => setFormData({ ...formData, subcategory_id: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg bg-background mt-1 focus:ring-2 focus:ring-ring focus:outline-none"
                                        >
                                            <option value="">Toda la categoría</option>
                                            {filteredSubcategories.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Conditions */}
                        <div>
                            <Label className="text-sm font-medium">Condiciones</Label>
                            <div className="mt-2 space-y-2">
                                {Object.values(PROMO_CONDITIONS).map((condition) => (
                                    <div key={condition.id}>
                                        {condition.type === 'BOOLEAN' && (
                                            <label className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(formData.conditions && formData.conditions[condition.id]) || false}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        conditions: { ...(formData.conditions || {}), [condition.id]: e.target.checked }
                                                    })}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{condition.label}</span>
                                                    {condition.description && (
                                                        <span className="text-xs text-muted-foreground">{condition.description}</span>
                                                    )}
                                                </div>
                                            </label>
                                        )}
                                        {/* Future support for other types like NUMBER or SELECT can be added here */}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Vigencia */}
                        <div>
                            <Label className="text-sm font-medium">Vigencia (opcional)</Label>
                            <div className="grid grid-cols-2 gap-3 mt-1.5">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Desde</Label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.start_date}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Hasta</Label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.end_date}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Deja vacío para que aplique sin límite de tiempo
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {editingPromo ? "Guardar" : "Crear"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ---- Delete Confirmation ---- */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="w-[95vw] sm:w-full sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>¿Eliminar promoción?</DialogTitle>
                        <DialogDescription>
                            Se eliminará &quot;{deleteConfirm?.name}&quot; permanentemente.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
