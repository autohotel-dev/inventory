/**
 * Permission Helper Functions
 * Provides utilities for checking and managing role-based permissions
 */

import { createClient } from '@/lib/supabase/client';

export type PermissionType = 'menu' | 'page';
export type UserRole = 'admin' | 'manager' | 'supervisor' | 'receptionist' | 'cochero' | 'camarista' | 'mantenimiento';

export interface Permission {
    id: string;
    role: UserRole;
    resource: string;
    permission_type: PermissionType;
    allowed: boolean;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

/**
 * Fetch all permissions for a specific role
 */
export async function getPermissionsByRole(role: UserRole): Promise<Permission[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', role)
        .eq('allowed', true)
        .order('resource');

    if (error) {
        console.error('Error fetching permissions:', error);
        return [];
    }

    return data || [];
}

/**
 * Fetch menu permissions for a specific role
 */
export async function getMenuPermissions(role: UserRole): Promise<string[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('role_permissions')
        .select('resource')
        .eq('role', role)
        .eq('permission_type', 'menu')
        .eq('allowed', true);

    if (error) {
        console.error('Error fetching menu permissions:', error);
        return [];
    }

    // Extract resource names (e.g., 'menu.dashboard' -> 'dashboard')
    return data?.map((p: any) => p.resource.replace('menu.', '')) || [];
}

/**
 * Fetch page permissions for a specific role
 */
export async function getPagePermissions(role: UserRole): Promise<string[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('role_permissions')
        .select('resource')
        .eq('role', role)
        .eq('permission_type', 'page')
        .eq('allowed', true);

    if (error) {
        console.error('Error fetching page permissions:', error);
        return [];
    }

    // Extract resource names (e.g., 'page./dashboard' -> '/dashboard')
    return data?.map((p: any) => p.resource.replace('page.', '')) || [];
}

/**
 * Check if a role has permission to access a specific resource
 */
export async function hasPermission(
    role: UserRole,
    resource: string,
    type: PermissionType
): Promise<boolean> {
    const supabase = createClient();

    // Construct the full resource identifier
    const fullResource = type === 'menu' ? `menu.${resource}` : `page.${resource}`;

    const { data, error } = await supabase
        .from('role_permissions')
        .select('allowed')
        .eq('role', role)
        .eq('resource', fullResource)
        .eq('permission_type', type)
        .single();

    if (error) {
        console.error('Error checking permission:', error);
        return false;
    }

    return data?.allowed || false;
}

/**
 * Update a permission
 */
export async function updatePermission(
    role: UserRole,
    resource: string,
    type: PermissionType,
    allowed: boolean
): Promise<boolean> {
    const supabase = createClient();

    const fullResource = type === 'menu' ? `menu.${resource}` : `page.${resource}`;

    const { error } = await supabase
        .from('role_permissions')
        .upsert({
            role,
            resource: fullResource,
            permission_type: type,
            allowed,
        }, {
            onConflict: 'role,resource'
        });

    if (error) {
        console.error('Error updating permission:', error);
        return false;
    }

    return true;
}

/**
 * Bulk update permissions for a role
 */
export async function bulkUpdatePermissions(
    role: UserRole,
    permissions: Array<{ resource: string; type: PermissionType; allowed: boolean }>
): Promise<boolean> {
    const supabase = createClient();

    const formattedPermissions = permissions.map(p => ({
        role,
        resource: p.type === 'menu' ? `menu.${p.resource}` : `page.${p.resource}`,
        permission_type: p.type,
        allowed: p.allowed,
    }));

    const { error } = await supabase
        .from('role_permissions')
        .upsert(formattedPermissions, {
            onConflict: 'role,resource'
        });

    if (error) {
        console.error('Error bulk updating permissions:', error);
        return false;
    }

    return true;
}

/**
 * Get all available menu resources (for configuration UI)
 */
export function getAllMenuResources(): Array<{ id: string; label: string; href: string }> {
    return [
        { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
        { id: 'products', label: 'Productos', href: '/products' },
        { id: 'categories', label: 'Categorías', href: '/categories' },
        { id: 'warehouses', label: 'Almacenes', href: '/warehouses' },
        { id: 'suppliers', label: 'Proveedores', href: '/suppliers' },
        { id: 'customers', label: 'Clientes', href: '/customers' },
        { id: 'notifications-admin', label: 'Notificaciones', href: '/notifications-admin' },
        { id: 'movements', label: 'Movimientos', href: '/movements' },
        { id: 'stock', label: 'Stock', href: '/stock' },
        { id: 'kardex', label: 'Kardex', href: '/kardex' },
        { id: 'analytics', label: 'Analytics', href: '/analytics' },
        { id: 'export', label: 'Exportar', href: '/export' },
        { id: 'purchases-sales', label: 'Dashboard Compras/Ventas', href: '/purchases-sales' },
        { id: 'purchases', label: 'Compras', href: '/purchases' },
        { id: 'sales', label: 'Ventas', href: '/sales' },
        { id: 'room-types', label: 'Tipos de Habitación', href: '/room-types' },
        { id: 'sales.pos', label: 'Habitaciones (POS)', href: '/sales/pos' },
        { id: 'sensors', label: 'Sensores (Tuya)', href: '/sensors' },
        { id: 'employees', label: 'Empleados', href: '/employees' },
        { id: 'employees.schedules', label: 'Horarios', href: '/employees/schedules' },
        { id: 'employees.closings', label: 'Cortes de Caja', href: '/employees/closings' },
        { id: 'reports.income', label: 'Reporte de Ingresos', href: '/reports/income' },
        { id: 'training', label: 'Capacitación', href: '/training' },
        { id: 'settings', label: 'Configuración', href: '/settings' },
        { id: 'settings.media', label: 'Biblioteca de Medios', href: '/settings/media' },
        { id: 'settings.permissions', label: 'Permisos de Roles', href: '/settings/permissions' },
    ];
}
