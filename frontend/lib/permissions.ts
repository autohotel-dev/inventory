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
        
        
        ;

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
        
        
        ;

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
        
        
        ;

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
        
        
        
        ;

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
 * Group metadata for the permissions UI
 */
export const MENU_GROUPS: Record<string, { icon: string; label: string; description: string; order: number }> = {
    'operaciones': { icon: '🏠', label: 'Operaciones Principales', description: 'Páginas principales de operación', order: 1 },
    'hotelera': { icon: '🏨', label: 'Gestión Hotelera', description: 'Tipos de habitación y sensores', order: 2 },
    'inventario': { icon: '📦', label: 'Inventario', description: 'Gestión de productos y almacenes', order: 3 },
    'compras-ventas': { icon: '💰', label: 'Compras y Ventas', description: 'Gestión de ventas y compras', order: 4 },
    'stock': { icon: '📊', label: 'Movimientos y Stock', description: 'Control de inventario y movimientos', order: 5 },
    'finanzas': { icon: '💵', label: 'Finanzas y Reportes', description: 'Cortes de caja y reimpresión', order: 6 },
    'analytics': { icon: '📈', label: 'Analytics y Auditoría', description: 'Reportes, análisis y auditoría', order: 7 },
    'personal': { icon: '👥', label: 'Personal', description: 'Gestión de empleados y capacitación', order: 8 },
    'sistema': { icon: '⚙️', label: 'Configuración y Sistema', description: 'Configuración, roles y notificaciones', order: 9 },
};

export interface MenuResource {
    id: string;
    label: string;
    href: string;
    group: string;
}

/**
 * Get all available menu resources (for configuration UI).
 * Single source of truth — add new modules here and they appear
 * automatically in both the sidebar permissions and the config UI.
 */
export function getAllMenuResources(): MenuResource[] {
    return [
        // 🏠 OPERACIONES PRINCIPALES
        { id: 'dashboard', label: 'Dashboard', href: '/dashboard', group: 'operaciones' },
        { id: 'sales.pos', label: 'Habitaciones (POS)', href: '/sales/pos', group: 'operaciones' },
        { id: 'operacion', label: 'Operación en Tiempo Real', href: '/operacion', group: 'operaciones' },

        // 🏨 GESTIÓN HOTELERA
        { id: 'room-types', label: 'Tipos de Habitación', href: '/room-types', group: 'hotelera' },
        { id: 'sensors', label: 'Sensores (Tuya)', href: '/sensors', group: 'hotelera' },

        // 📦 INVENTARIO
        { id: 'products', label: 'Productos', href: '/products', group: 'inventario' },
        { id: 'categories', label: 'Categorías', href: '/categories', group: 'inventario' },
        { id: 'warehouses', label: 'Almacenes', href: '/warehouses', group: 'inventario' },
        { id: 'suppliers', label: 'Proveedores', href: '/suppliers', group: 'inventario' },
        { id: 'customers', label: 'Clientes', href: '/customers', group: 'inventario' },

        // 💰 COMPRAS Y VENTAS
        { id: 'purchases-sales', label: 'Dashboard Compras/Ventas', href: '/purchases-sales', group: 'compras-ventas' },
        { id: 'purchases', label: 'Compras', href: '/purchases', group: 'compras-ventas' },
        { id: 'sales', label: 'Ventas', href: '/sales', group: 'compras-ventas' },

        // 📊 MOVIMIENTOS Y STOCK
        { id: 'movements', label: 'Movimientos', href: '/movements', group: 'stock' },
        { id: 'stock', label: 'Stock', href: '/stock', group: 'stock' },
        { id: 'kardex', label: 'Kardex', href: '/kardex', group: 'stock' },

        // 💵 FINANZAS Y REPORTES
        { id: 'reports.income', label: 'Pre-Cortes de Caja', href: '/reports/income', group: 'finanzas' },
        { id: 'employees.closings', label: 'Cortes de Caja (Cierre)', href: '/employees/closings', group: 'finanzas' },
        { id: 'reprint', label: 'Reimprimir Tickets', href: '/reprint', group: 'finanzas' },

        // 📈 ANALYTICS Y AUDITORÍA
        { id: 'analytics', label: 'Analytics', href: '/analytics', group: 'analytics' },
        { id: 'analytics.performance', label: 'Rendimiento y Tiempos', href: '/analytics/performance', group: 'analytics' },
        { id: 'export', label: 'Exportar', href: '/export', group: 'analytics' },
        { id: 'auditoria', label: 'Auditoría', href: '/auditoria', group: 'analytics' },

        // 👥 PERSONAL
        { id: 'employees', label: 'Empleados', href: '/employees', group: 'personal' },
        { id: 'employees.schedules', label: 'Horarios', href: '/employees/schedules', group: 'personal' },
        { id: 'training', label: 'Capacitación', href: '/training', group: 'personal' },

        // ⚙️ CONFIGURACIÓN Y SISTEMA
        { id: 'settings', label: 'Configuración', href: '/settings', group: 'sistema' },
        { id: 'settings.roles', label: 'Gestión de Roles', href: '/settings/roles', group: 'sistema' },
        { id: 'settings.permissions', label: 'Permisos de Roles', href: '/settings/permissions', group: 'sistema' },
        { id: 'settings.media', label: 'Biblioteca de Medios', href: '/settings/media', group: 'sistema' },
        { id: 'notifications-admin', label: 'Notificaciones', href: '/notifications-admin', group: 'sistema' },
        { id: 'staff-notifications', label: 'Comunicados Staff', href: '/staff-notifications', group: 'sistema' },
    ];
}

/**
 * Get menu resources grouped by category (for permissions UI).
 * Automatically groups based on the `group` field — no manual grouping needed.
 */
export function getGroupedMenuResources(filterFn?: (item: MenuResource) => boolean) {
    const items = getAllMenuResources();
    const filtered = filterFn ? items.filter(filterFn) : items;

    const groupMap = new Map<string, MenuResource[]>();
    filtered.forEach(item => {
        if (!groupMap.has(item.group)) groupMap.set(item.group, []);
        groupMap.get(item.group)!.push(item);
    });

    return Array.from(groupMap.entries())
        .map(([groupId, groupItems]) => ({
            id: groupId,
            ...(MENU_GROUPS[groupId] || { icon: '📁', label: groupId, description: '', order: 99 }),
            items: groupItems,
        }))
        .sort((a, b) => a.order - b.order);
}

