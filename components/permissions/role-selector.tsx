"use client";

import * as React from "react";

interface Role {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    is_protected: boolean;
    is_active: boolean;
}

interface RoleSelectorProps {
    selectedRole: string; // role name or id
    onRoleChange: (roleName: string) => void;
}

export function RoleSelector({ selectedRole, onRoleChange }: RoleSelectorProps) {
    const [roles, setRoles] = React.useState<Role[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        async function fetchRoles() {
            try {
                const response = await fetch('/api/roles');
                const data = await response.json();

                if (response.ok && data.roles) {
                    setRoles(Array.isArray(data.roles) ? data.roles : [data.roles]);
                }
            } catch (error) {
                console.error('Error fetching roles:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchRoles();
    }, []);

    if (loading) {
        return (
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold mb-2">Seleccionar Rol</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Cargando roles...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold mb-2">Seleccionar Rol</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Selecciona el rol para configurar sus permisos de acceso
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {roles.map((role) => (
                    <button
                        key={role.id}
                        onClick={() => onRoleChange(role.name)}
                        className={`
              p-4 rounded-lg border-2 text-left transition-all
              ${selectedRole === role.name
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }
            `}
                    >
                        <div className="font-semibold mb-1 flex items-center gap-2">
                            {role.display_name}
                            {role.is_protected && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                    Protegido
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground">{role.description || 'Sin descripción'}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
