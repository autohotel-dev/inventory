"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
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
import { useToast } from "@/hooks/use-toast";
import {
    Wine,
    Plus,
    Edit,
    Trash2,
    Package,
    GlassWater,
    Save,
    Loader2,
    Settings,
} from "lucide-react";
import type { BottlePackageRule, Category, Subcategory } from "@/lib/types/inventory";


// IDs de categorías conocidas
const REFRESCOS_CATEGORY_ID = "233bd65d-9bb6-48e0-a956-0bb971ad24bc";
const JUGOS_CATEGORY_ID = "58226037-829e-491c-8c11-5d7ae7b31f78";

interface FormData {
    unit_type: "PZBOT" | "PZBOTAN";
    subcategory_id: string;
    included_category_id: string;
    quantity: number;
    is_active: boolean;
}

const defaultFormData: FormData = {
    unit_type: "PZBOT",
    subcategory_id: "",
    included_category_id: REFRESCOS_CATEGORY_ID,
    quantity: 5,
    is_active: true,
};

export function BottlePackageRules() {
    const toast = useToast();
    const [rules, setRules] = useState<BottlePackageRule[]>([]);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<BottlePackageRule | null>(null);
    const [formData, setFormData] = useState<FormData>(defaultFormData);
    const [deleteConfirm, setDeleteConfirm] = useState<BottlePackageRule | null>(null);

    const showSuccess = (title: string, description: string) => {
        toast.success(title, description);
    };

    const showError = (title: string, description: string) => {
        toast.error(title, description);
    };

    // Fetch rules and subcategories
    const fetchData = useCallback(async () => {
        try {
            const [rulesRes, subRes] = await Promise.allSettled([
                apiClient.get("/system/crud/bottle_package_rules", { params: { include_relations: true } }),
                apiClient.get("/catalogs/subcategories", { params: { include_category: true } }),
            ]);

            if (rulesRes.status === 'fulfilled') {
                const raw = rulesRes.value.data;
                setRules(Array.isArray(raw) ? raw : (raw?.items || raw?.results || []));
            } else {
                showError("Error", "No se pudieron cargar las reglas de paquetes");
            }

            if (subRes.status === 'fulfilled') {
                const raw = subRes.value.data;
                setSubcategories(Array.isArray(raw) ? raw : (raw?.items || raw?.results || []));
            }
        } catch (err) {
            console.error("Error fetching data:", err);
            showError("Error", "No se pudieron cargar los datos");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openAddModal = () => {
        setEditingRule(null);
        setFormData(defaultFormData);
        setIsModalOpen(true);
    };

    const openEditModal = (rule: BottlePackageRule) => {
        setEditingRule(rule);
        setFormData({
            unit_type: rule.unit_type,
            subcategory_id: rule.subcategory_id,
            included_category_id: rule.included_category_id,
            quantity: rule.quantity,
            is_active: rule.is_active,
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.subcategory_id || !formData.included_category_id || formData.quantity < 0) {
            showError("Error", "Por favor completa todos los campos");
            return;
        }

        setSaving(true);

        try {
            const payload = {
                unit_type: formData.unit_type,
                subcategory_id: formData.subcategory_id,
                included_category_id: formData.included_category_id,
                quantity: formData.quantity,
                is_active: formData.is_active,
            };

            if (editingRule) {
                await apiClient.put(`/bottle-package-rules/${editingRule.id}`, payload);
                showSuccess("Actualizado", "La regla se actualiz\u00f3 correctamente");
            } else {
                await apiClient.post("/system/crud/bottle_package_rules", payload);
                showSuccess("Creado", "La regla se cre\u00f3 correctamente");
            }

            // Refresh rules
            const { data: rawRules } = await apiClient.get("/system/crud/bottle_package_rules", { params: { include_relations: true } });
            setRules(Array.isArray(rawRules) ? rawRules : (rawRules?.items || rawRules?.results || []));
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving rule:", error);
            showError("Error", "No se pudo guardar la regla");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;

        try {
            await apiClient.delete(`/bottle-package-rules/${deleteConfirm.id}`);
            setRules(prev => prev.filter(r => r.id !== deleteConfirm.id));
            showSuccess("Eliminado", "La regla se elimin\u00f3 correctamente");
        } catch (error) {
            showError("Error", "No se pudo eliminar la regla");
        }
        setDeleteConfirm(null);
    };

    const toggleActive = async (rule: BottlePackageRule) => {
        try {
            await apiClient.patch(`/bottle-package-rules/${rule.id}`, { is_active: !rule.is_active });
            setRules(prev =>
                prev.map(r => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
            );
        } catch (error) {
            showError("Error", "No se pudo actualizar el estado");
        }
    };

    const getIncludedCategoryName = (categoryId: string) => {
        if (categoryId === REFRESCOS_CATEGORY_ID) return "Refrescos";
        if (categoryId === JUGOS_CATEGORY_ID) return "Jugos";
        return "Desconocido";
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                                <Wine className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Reglas de Paquetes de Botellas</CardTitle>
                                <CardDescription>
                                    Configura las bebidas incluidas por tipo de botella y subcategoría
                                </CardDescription>
                            </div>
                        </div>
                        <Button onClick={openAddModal} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nueva Regla
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {rules.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No hay reglas configuradas</p>
                            <p className="text-sm">Agrega reglas para definir las bebidas incluidas con cada botella</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tipo de Unidad</TableHead>
                                    <TableHead>Subcategoría</TableHead>
                                    <TableHead>Incluye</TableHead>
                                    <TableHead className="text-center">Cantidad</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.map((rule) => (
                                    <TableRow key={rule.id}>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono">
                                                {rule.unit_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Wine className="h-4 w-4 text-purple-500" />
                                                {(rule as any).subcategory?.name || "N/A"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <GlassWater className="h-4 w-4 text-cyan-500" />
                                                {getIncludedCategoryName(rule.included_category_id)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                {rule.quantity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <button
                                                onClick={() => toggleActive(rule)}
                                                className="cursor-pointer"
                                            >
                                                <Badge
                                                    variant={rule.is_active ? "default" : "secondary"}
                                                    className={rule.is_active ? "bg-green-500" : ""}
                                                >
                                                    {rule.is_active ? "Activo" : "Inactivo"}
                                                </Badge>
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditModal(rule)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDeleteConfirm(rule)}
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="w-[95vw] sm:w-full sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRule ? "Editar Regla" : "Nueva Regla de Paquete"}
                        </DialogTitle>
                        <DialogDescription>
                            Define cuántas bebidas incluye cada tipo de botella
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Unit Type */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Tipo de Unidad</label>
                            <select
                                value={formData.unit_type}
                                onChange={(e) => setFormData({ ...formData, unit_type: e.target.value as "PZBOT" | "PZBOTAN" })}
                                className="w-full px-3 py-2 border rounded-lg bg-background"
                            >
                                <option value="PZBOT">PZBOT - Botella grande</option>
                                <option value="PZBOTAN">PZBOTAN - Botella anforita</option>
                            </select>
                        </div>

                        {/* Subcategory */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Subcategoría de Licores</label>
                            <select
                                value={formData.subcategory_id}
                                onChange={(e) => setFormData({ ...formData, subcategory_id: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg bg-background"
                            >
                                <option value="">Seleccionar subcategoría...</option>
                                {subcategories.map((sub) => (
                                    <option key={sub.id} value={sub.id}>
                                        {(sub as any).category?.name} → {sub.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Included Category */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Bebidas a Incluir</label>
                            <select
                                value={formData.included_category_id}
                                onChange={(e) => setFormData({ ...formData, included_category_id: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg bg-background"
                            >
                                <option value={REFRESCOS_CATEGORY_ID}>Refrescos</option>
                                <option value={JUGOS_CATEGORY_ID}>Jugos</option>
                            </select>
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Cantidad Incluida</label>
                            <Input
                                type="number"
                                min="0"
                                max="20"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                placeholder="Cantidad de bebidas"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Número de bebidas gratis con cada botella
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {editingRule ? "Guardar" : "Crear"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="w-[95vw] sm:w-full sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>¿Eliminar regla?</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. La regla se eliminará permanentemente.
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
