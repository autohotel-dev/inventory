"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Role {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    is_protected: boolean;
    is_active: boolean;
}

interface RoleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (role: Partial<Role>) => Promise<void>;
    role?: Role | null;
    mode: "create" | "edit";
}

export function RoleFormModal({ isOpen, onClose, onSave, role, mode }: RoleFormModalProps) {
    const [formData, setFormData] = React.useState({
        name: "",
        display_name: "",
        description: "",
    });
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (role && mode === "edit") {
            setFormData({
                name: role.name,
                display_name: role.display_name,
                description: role.description || "",
            });
        } else {
            setFormData({
                name: "",
                display_name: "",
                description: "",
            });
        }
        setError(null);
    }, [role, mode, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);

        try {
            const dataToSave: Partial<Role> = {
                ...formData,
            };

            if (mode === "edit" && role) {
                dataToSave.id = role.id;
                // Don't send name for edit (it's immutable)
                delete dataToSave.name;
            }

            await onSave(dataToSave);
            onClose();
        } catch (err: any) {
            setError(err.message || "Error al guardar el rol");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !saving && !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "Crear Nuevo Rol" : "Editar Rol"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "create" && (
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium mb-1">
                                Identificador <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                placeholder="ej: supervisor"
                                required
                                pattern="[a-z0-9_]+"
                                title="Solo letras minúsculas, números y guiones bajos"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Solo letras minúsculas, números y guiones bajos. No se puede cambiar después.
                            </p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="display_name" className="block text-sm font-medium mb-1">
                            Nombre para Mostrar <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="display_name"
                            value={formData.display_name}
                            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                            placeholder="ej: Supervisor"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium mb-1">
                            Descripción
                        </label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-background"
                            placeholder="Descripción del rol..."
                            rows={3}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
                        >
                            {saving ? "Guardando..." : mode === "create" ? "Crear Rol" : "Guardar Cambios"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

