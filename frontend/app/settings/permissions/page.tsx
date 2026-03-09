"use client";

import * as React from "react";
import { RoleSelector } from "@/components/permissions/role-selector";
import { PermissionGroup } from "@/components/permissions/permission-group";
import { getAllMenuResources } from "@/lib/permissions";
import { useUserRole } from "@/hooks/use-user-role";
import { useRouter } from "next/navigation";

export default function PermissionsPage() {
    const router = useRouter();
    const { canAccessAdmin, isLoading: roleLoading } = useUserRole();
    const [selectedRole, setSelectedRole] = React.useState<string>("cochero");
    const [selectedPermissions, setSelectedPermissions] = React.useState<Set<string>>(new Set());
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [hasChanges, setHasChanges] = React.useState(false);
    const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");

    // Redirect if not admin
    React.useEffect(() => {
        if (!roleLoading && !canAccessAdmin) {
            router.push("/dashboard");
        }
    }, [canAccessAdmin, roleLoading, router]);

    // Fetch permissions for selected role
    React.useEffect(() => {
        async function fetchPermissions() {
            setLoading(true);
            setHasChanges(false);
            setMessage(null);

            try {
                const response = await fetch(`/api/permissions?role=${selectedRole}`);
                const data = await response.json();

                if (response.ok && data.permissions) {
                    const menuPerms = data.permissions
                        .filter((p: any) => p.permission_type === "menu" && p.allowed)
                        .map((p: any) => p.resource.replace("menu.", ""));

                    setSelectedPermissions(new Set(menuPerms));
                } else {
                    console.error("Error fetching permissions:", data.error);
                    setSelectedPermissions(new Set());
                }
            } catch (error) {
                console.error("Error fetching permissions:", error);
                setSelectedPermissions(new Set());
            } finally {
                setLoading(false);
            }
        }

        fetchPermissions();
    }, [selectedRole]);

    const handleToggle = (itemId: string, checked: boolean) => {
        setSelectedPermissions((prev) => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(itemId);
            } else {
                newSet.delete(itemId);
            }
            return newSet;
        });
        setHasChanges(true);
        // Clear success message when making changes
        if (message?.type === "success") {
            setMessage(null);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const allMenuItems = getAllMenuResources();
            const permissions = allMenuItems.map((item) => ({
                resource: item.id,
                type: "menu" as const,
                allowed: selectedPermissions.has(item.id),
            }));

            // Also add corresponding page permissions
            const pagePermissions = allMenuItems.map((item) => ({
                resource: item.href,
                type: "page" as const,
                allowed: selectedPermissions.has(item.id),
            }));

            const response = await fetch("/api/permissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    role: selectedRole,
                    permissions: [...permissions, ...pagePermissions],
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: "success", text: "✓ Permisos actualizados correctamente" });
                setHasChanges(false);
                // Auto-hide success message after 3 seconds
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: "error", text: data.error || "Error al actualizar permisos" });
            }
        } catch (error) {
            console.error("Error saving permissions:", error);
            setMessage({ type: "error", text: "Error al guardar los cambios" });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setSearchQuery("");
        setHasChanges(false);
        setMessage(null);
        // Re-fetch permissions
        window.location.reload();
    };

    const handleSelectAll = () => {
        const allMenuItems = getAllMenuResources();
        const filteredItems = searchQuery
            ? allMenuItems.filter(item =>
                item.label.toLowerCase().includes(searchQuery.toLowerCase())
            )
            : allMenuItems;

        setSelectedPermissions(new Set(filteredItems.map(item => item.id)));
        setHasChanges(true);
    };

    const handleDeselectAll = () => {
        setSelectedPermissions(new Set());
        setHasChanges(true);
    };

    if (roleLoading || !canAccessAdmin) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Cargando...</p>
                </div>
            </div>
        );
    }

    const allMenuItems = getAllMenuResources();

    // Filter items based on search
    const filteredMenuItems = searchQuery
        ? allMenuItems.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.href.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : allMenuItems;

    // Group menu items by category
    const menuGroups = [
        {
            title: "Principal",
            icon: "🏠",
            description: "Página principal del sistema",
            items: filteredMenuItems.filter((item) => ["dashboard"].includes(item.id)),
        },
        {
            title: "Inventario",
            icon: "📦",
            description: "Gestión de productos y almacenes",
            items: filteredMenuItems.filter((item) =>
                ["products", "categories", "warehouses", "suppliers", "customers"].includes(item.id)
            ),
        },
        {
            title: "Movimientos y Stock",
            icon: "📊",
            description: "Control de inventario y movimientos",
            items: filteredMenuItems.filter((item) =>
                ["movements", "stock", "kardex"].includes(item.id)
            ),
        },
        {
            title: "Análisis y Reportes",
            icon: "📈",
            description: "Reportes y análisis de datos",
            items: filteredMenuItems.filter((item) =>
                ["analytics", "export", "reports.income"].includes(item.id)
            ),
        },
        {
            title: "Ventas y Compras",
            icon: "💰",
            description: "Gestión de ventas y compras",
            items: filteredMenuItems.filter((item) =>
                ["purchases-sales", "purchases", "sales", "sales.pos"].includes(item.id)
            ),
        },
        {
            title: "Personal",
            icon: "👥",
            description: "Gestión de empleados y turnos",
            items: filteredMenuItems.filter((item) =>
                ["employees", "employees.schedules", "employees.closings"].includes(item.id)
            ),
        },
        {
            title: "Otros",
            icon: "⚙️",
            description: "Configuración y herramientas",
            items: filteredMenuItems.filter((item) =>
                ["notifications-admin", "sensors", "training", "settings", "settings.media", "settings.permissions", "settings.roles"].includes(item.id)
            ),
        },
    ];

    const visibleGroups = menuGroups.filter(group => group.items.length > 0);
    const totalFiltered = filteredMenuItems.length;

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Configuración de Permisos
                </h1>
                <p className="text-muted-foreground text-lg">
                    Gestiona los permisos de acceso a menús y páginas para cada rol
                </p>
            </div>

            <div className="space-y-6">
                {/* Role Selector */}
                <RoleSelector selectedRole={selectedRole} onRoleChange={setSelectedRole} />

                {/* Stats Cards */}
                {!loading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">✓</div>
                                <div>
                                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                        {selectedPermissions.size}
                                    </div>
                                    <div className="text-sm text-blue-700 dark:text-blue-300">Permisos Activos</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">📋</div>
                                <div>
                                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                                        {allMenuItems.length}
                                    </div>
                                    <div className="text-sm text-purple-700 dark:text-purple-300">Total Disponibles</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border border-green-200 dark:border-green-800 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">📊</div>
                                <div>
                                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                                        {Math.round((selectedPermissions.size / allMenuItems.length) * 100)}%
                                    </div>
                                    <div className="text-sm text-green-700 dark:text-green-300">Cobertura</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Message */}
                {message && (
                    <div
                        className={`p-4 rounded-lg border flex items-center gap-3 animate-in slide-in-from-top-2 ${message.type === "success"
                                ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-100"
                                : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-100"
                            }`}
                    >
                        <div className="text-xl">{message.type === "success" ? "✓" : "⚠"}</div>
                        <div className="flex-1">{message.text}</div>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Cargando permisos...</p>
                    </div>
                ) : (
                    <>
                        {/* Search and Actions Bar */}
                        <div className="bg-card border rounded-lg p-4">
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1 w-full">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="🔍 Buscar permisos..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            🔍
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSelectAll}
                                        disabled={saving}
                                        className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                    >
                                        Seleccionar Todo
                                    </button>
                                    <button
                                        onClick={handleDeselectAll}
                                        disabled={saving}
                                        className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                    >
                                        Deseleccionar Todo
                                    </button>
                                </div>
                            </div>

                            {searchQuery && (
                                <div className="mt-3 text-sm text-muted-foreground">
                                    Mostrando {totalFiltered} de {allMenuItems.length} permisos
                                </div>
                            )}
                        </div>

                        {/* Permissions Grid */}
                        <div className="bg-card border rounded-lg p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-semibold">Permisos de Menú</h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Selecciona los elementos del menú que este rol puede ver
                                    </p>
                                </div>
                            </div>

                            {visibleGroups.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <div className="text-4xl mb-3">🔍</div>
                                    <p>No se encontraron permisos que coincidan con "{searchQuery}"</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {visibleGroups.map((group) => (
                                        <div key={group.title} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start gap-3 mb-4">
                                                <div className="text-2xl">{group.icon}</div>
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-lg">{group.title}</h3>
                                                    <p className="text-xs text-muted-foreground">{group.description}</p>
                                                </div>
                                                <div className="text-xs bg-muted px-2 py-1 rounded">
                                                    {group.items.filter(item => selectedPermissions.has(item.id)).length}/{group.items.length}
                                                </div>
                                            </div>
                                            <PermissionGroup
                                                title=""
                                                items={group.items}
                                                selectedItems={selectedPermissions}
                                                onToggle={handleToggle}
                                                disabled={saving}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="sticky bottom-0 bg-background border-t pt-4 pb-2">
                            <div className="bg-card border rounded-lg p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        {hasChanges && (
                                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                                <span className="text-xl">⚠</span>
                                                <span className="text-sm font-medium">Tienes cambios sin guardar</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleReset}
                                            disabled={!hasChanges || saving}
                                            className="px-5 py-2.5 border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={!hasChanges || saving}
                                            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg hover:shadow-xl"
                                        >
                                            {saving ? (
                                                <span className="flex items-center gap-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    Guardando...
                                                </span>
                                            ) : (
                                                "💾 Guardar Cambios"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
