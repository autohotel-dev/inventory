"use client";

import * as React from "react";
import { RoleFormModal } from "@/components/roles/role-form-modal";
import { useUserRole } from "@/hooks/use-user-role";
import { useRouter } from "next/navigation";

interface Role {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    is_protected: boolean;
    is_active: boolean;
    created_at: string;
}

export default function RolesManagementPage() {
    const router = useRouter();
    const { canAccessAdmin, isLoading: roleLoading } = useUserRole();
    const [roles, setRoles] = React.useState<Role[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [modalOpen, setModalOpen] = React.useState(false);
    const [modalMode, setModalMode] = React.useState<"create" | "edit">("create");
    const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);
    const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

    // Redirect if not admin
    React.useEffect(() => {
        if (!roleLoading && !canAccessAdmin) {
            router.push("/dashboard");
        }
    }, [canAccessAdmin, roleLoading, router]);

    // Fetch roles
    const fetchRoles = React.useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/roles");
            const data = await response.json();

            if (response.ok && data.roles) {
                setRoles(Array.isArray(data.roles) ? data.roles : [data.roles]);
            } else {
                console.error("Error fetching roles:", data.error);
                setRoles([]);
            }
        } catch (error) {
            console.error("Error fetching roles:", error);
            setRoles([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (canAccessAdmin) {
            fetchRoles();
        }
    }, [canAccessAdmin, fetchRoles]);

    const handleCreateRole = () => {
        setSelectedRole(null);
        setModalMode("create");
        setModalOpen(true);
    };

    const handleEditRole = (role: Role) => {
        setSelectedRole(role);
        setModalMode("edit");
        setModalOpen(true);
    };

    const handleSaveRole = async (roleData: Partial<Role>) => {
        setMessage(null);

        try {
            const url = "/api/roles";
            const method = modalMode === "create" ? "POST" : "PUT";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(roleData),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({
                    type: "success",
                    text: modalMode === "create" ? "Rol creado exitosamente" : "Rol actualizado exitosamente"
                });
                fetchRoles();
            } else {
                throw new Error(data.error || "Error al guardar el rol");
            }
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
            throw error;
        }
    };

    const handleDeleteRole = async (role: Role) => {
        if (role.is_protected) {
            setMessage({ type: "error", text: "No se pueden eliminar roles protegidos (admin, manager)" });
            return;
        }

        if (!confirm(`¿Estás seguro de que deseas eliminar el rol "${role.display_name}"?`)) {
            return;
        }

        setMessage(null);

        try {
            const response = await fetch("/api/roles", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: role.id }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: "success", text: "Rol eliminado exitosamente" });
                fetchRoles();
            } else {
                setMessage({ type: "error", text: data.error || "Error al eliminar el rol" });
            }
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Error al eliminar el rol" });
        }
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

    return (
        <div className="container mx-auto px-2 sm:px-4 md:p-6 max-w-6xl">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">Gestión de Roles</h1>
                    <p className="text-sm text-muted-foreground">
                        Crea, edita y elimina roles para el sistema
                    </p>
                </div>
                <button
                    onClick={handleCreateRole}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm sm:text-base self-start sm:self-auto"
                >
                    + Crear Rol
                </button>
            </div>

            {message && (
                <div
                    className={`p-4 rounded-lg border mb-6 ${message.type === "success"
                            ? "bg-green-50 border-green-200 text-green-800"
                            : "bg-red-50 border-red-200 text-red-800"
                        }`}
                >
                    {message.text}
                </div>
            )}

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Cargando roles...</p>
                </div>
            ) : (
                <div className="bg-card border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="text-left p-4 font-semibold">Nombre</th>
                                <th className="text-left p-4 font-semibold">Descripción</th>
                                <th className="text-center p-4 font-semibold">Estado</th>
                                <th className="text-right p-4 font-semibold">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center p-8 text-muted-foreground">
                                        No hay roles disponibles
                                    </td>
                                </tr>
                            ) : (
                                roles.map((role) => (
                                    <tr key={role.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                                        <td className="p-4">
                                            <div>
                                                <div className="font-medium">{role.display_name}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {role.name}
                                                    {role.is_protected && (
                                                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                                            Protegido
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm text-muted-foreground">
                                                {role.description || "Sin descripción"}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span
                                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${role.is_active
                                                        ? "bg-green-100 text-green-800"
                                                        : "bg-gray-100 text-gray-800"
                                                    }`}
                                            >
                                                {role.is_active ? "Activo" : "Inactivo"}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => handleEditRole(role)}
                                                    className="px-3 py-1 text-sm border rounded hover:bg-muted transition-colors"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRole(role)}
                                                    disabled={role.is_protected}
                                                    className="px-3 py-1 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}

            <RoleFormModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSaveRole}
                role={selectedRole}
                mode={modalMode}
            />
        </div>
    );
}
