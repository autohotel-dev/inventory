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

export interface MenuResource {
    id: string;
    label: string;
    href: string;
    group: string;
    /** Human-readable section label (set on the FIRST item of a group) */
    groupLabel?: string;
    /** Emoji icon for the section (set on the FIRST item of a group) */
    groupIcon?: string;
    /** Sort order for the section (set on the FIRST item of a group) */
    groupOrder?: number;
    /** Description shown in permissions UI (set on the FIRST item of a group) */
    groupDescription?: string;
    /** Lucide icon name for the sidebar */
    iconName: string;
    /** Only visible for admin/manager/supervisor by default */
    adminOnly?: boolean;
    /** Visible for all non-admin roles */
    allowedForNonAdmin?: boolean;
    /** Visible specifically for receptionist role */
    allowedForReceptionist?: boolean;
}

/**
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  🔑 SINGLE SOURCE OF TRUTH                                      │
 * │  Add new modules ONLY here — the sidebar AND permissions page   │
 * │  both read from this list. No dual-maintenance needed.          │
 * └──────────────────────────────────────────────────────────────────┘
 */
export function getAllMenuResources(): MenuResource[] {
    return [
        // 🏠 OPERACIONES PRINCIPALES
        { id: 'dashboard', label: 'Dashboard', href: '/dashboard', group: 'operaciones', groupLabel: 'Operaciones', groupIcon: '🏠', groupOrder: 1, groupDescription: 'Páginas principales de operación', iconName: 'Home', allowedForNonAdmin: true, allowedForReceptionist: true },
        { id: 'sales.pos', label: 'Habitaciones (POS)', href: '/sales/pos', group: 'operaciones', iconName: 'Building', allowedForNonAdmin: true, allowedForReceptionist: true },
        { id: 'operacion-en-vivo', label: 'Operación en Vivo', href: '/operacion-en-vivo', group: 'operaciones', iconName: 'Activity', allowedForNonAdmin: true, allowedForReceptionist: true },
        { id: 'pendientes', label: 'Pendientes', href: '/pendientes', group: 'operaciones', iconName: 'ClipboardList', allowedForNonAdmin: true, allowedForReceptionist: true },

        // 🏨 GESTIÓN HOTELERA
        { id: 'room-types', label: 'Tipos de Habitación', href: '/room-types', group: 'hotelera', groupLabel: 'Gestión Hotelera', groupIcon: '🏨', groupOrder: 2, groupDescription: 'Tipos de habitación y sensores', iconName: 'Settings', adminOnly: true },
        { id: 'sensors', label: 'Sensores (Tuya)', href: '/sensors', group: 'hotelera', iconName: 'Activity', adminOnly: true },

        // 📦 INVENTARIO
        { id: 'products', label: 'Productos', href: '/products', group: 'inventario', groupLabel: 'Inventario', groupIcon: '📦', groupOrder: 3, groupDescription: 'Gestión de productos y almacenes', iconName: 'Package', adminOnly: true },
        { id: 'products.loan-mapping', label: 'Artículos en Préstamo', href: '/products/loan-mapping', group: 'inventario', iconName: 'Utensils', adminOnly: true },
        { id: 'categories', label: 'Categorías', href: '/categories', group: 'inventario', iconName: 'ArrowRightLeft', adminOnly: true },
        { id: 'warehouses', label: 'Almacenes', href: '/warehouses', group: 'inventario', iconName: 'Building', adminOnly: true },
        { id: 'suppliers', label: 'Proveedores', href: '/suppliers', group: 'inventario', iconName: 'Truck', adminOnly: true },
        { id: 'customers', label: 'Clientes', href: '/customers', group: 'inventario', iconName: 'Users', adminOnly: true },

        // 💰 COMPRAS Y VENTAS
        { id: 'purchases-sales', label: 'Dashboard Movimientos', href: '/purchases-sales', group: 'compras-ventas', groupLabel: 'Compras y Ventas', groupIcon: '💰', groupOrder: 4, groupDescription: 'Gestión de ventas y compras', iconName: 'BarChart3', adminOnly: true },
        { id: 'purchases', label: 'Compras', href: '/purchases', group: 'compras-ventas', iconName: 'ShoppingCart', adminOnly: true },
        { id: 'sales', label: 'Ventas', href: '/sales', group: 'compras-ventas', iconName: 'ShoppingCart', adminOnly: true },

        // 📊 MOVIMIENTOS Y STOCK
        { id: 'movements', label: 'Movimientos', href: '/movements', group: 'stock', groupLabel: 'Control de Stock', groupIcon: '📊', groupOrder: 5, groupDescription: 'Control de inventario y movimientos', iconName: 'Activity', adminOnly: true },
        { id: 'stock', label: 'Stock', href: '/stock', group: 'stock', iconName: 'Package', adminOnly: true },
        { id: 'kardex', label: 'Kardex', href: '/kardex', group: 'stock', iconName: 'Activity', adminOnly: true },

        // 💵 FINANZAS Y REPORTES
        { id: 'reports.income', label: 'Pre-Cortes de Caja', href: '/precortes-de-caja', group: 'finanzas', groupLabel: 'Finanzas y Reportes', groupIcon: '💵', groupOrder: 6, groupDescription: 'Cortes de caja y reimpresión', iconName: 'FileText', allowedForReceptionist: true },
        { id: 'employees.closings', label: 'Cortes de Caja (Cierre)', href: '/employees/closings', group: 'finanzas', iconName: 'Briefcase', allowedForReceptionist: true },
        { id: 'reprint', label: 'Reimprimir Tickets', href: '/reprint', group: 'finanzas', iconName: 'FileText', allowedForNonAdmin: true, allowedForReceptionist: true },

        // 📈 ANALYTICS Y AUDITORÍA
        { id: 'analytics', label: 'Analytics', href: '/analytics', group: 'analytics', groupLabel: 'Analítica y Auditoría', groupIcon: '📈', groupOrder: 7, groupDescription: 'Reportes, análisis y auditoría', iconName: 'BarChart3', adminOnly: true },
        { id: 'analytics.performance', label: 'Rendimiento y Tiempos', href: '/analytics/performance', group: 'analytics', iconName: 'Activity', adminOnly: true },
        { id: 'export', label: 'Exportar', href: '/export', group: 'analytics', iconName: 'Download', adminOnly: true },
        { id: 'auditoria', label: 'Auditoría', href: '/auditoria', group: 'analytics', iconName: 'Activity', adminOnly: true },
        { id: 'auditoria.controles', label: 'Auditoría Controles TV', href: '/auditoria/controles', group: 'analytics', iconName: 'Activity', adminOnly: true },
        { id: 'logs', label: 'Registro de Actividad', href: '/logs', group: 'analytics', iconName: 'FileText', adminOnly: true },
        { id: 'auditoria.telemetria', label: 'Telemetría y Rendimiento', href: '/auditoria/telemetria', group: 'analytics', iconName: 'Activity', adminOnly: true },

        // 👥 PERSONAL
        { id: 'employees', label: 'Empleados', href: '/employees', group: 'personal', groupLabel: 'Recursos Humanos', groupIcon: '👥', groupOrder: 8, groupDescription: 'Gestión de empleados y capacitación', iconName: 'Users', adminOnly: true },
        { id: 'employees.schedules', label: 'Horarios', href: '/employees/schedules', group: 'personal', iconName: 'Activity', adminOnly: true },
        { id: 'training', label: 'Capacitación', href: '/training', group: 'personal', iconName: 'GraduationCap', allowedForReceptionist: true },

        // ⚙️ CONFIGURACIÓN Y SISTEMA
        { id: 'settings', label: 'Configuración', href: '/settings', group: 'sistema', groupLabel: 'Sistema', groupIcon: '⚙️', groupOrder: 9, groupDescription: 'Configuración, roles y notificaciones', iconName: 'Settings', adminOnly: true },
        { id: 'settings.roles', label: 'Gestión de Roles', href: '/settings/roles', group: 'sistema', iconName: 'Users', adminOnly: true },
        { id: 'settings.permissions', label: 'Permisos de Roles', href: '/settings/permissions', group: 'sistema', iconName: 'Settings', adminOnly: true },
        { id: 'settings.media', label: 'Biblioteca de Medios', href: '/settings/media', group: 'sistema', iconName: 'Image', adminOnly: true },
        { id: 'notifications-admin', label: 'Notificaciones', href: '/notifications-admin', group: 'sistema', iconName: 'Bell', adminOnly: true },
        { id: 'staff-notifications', label: 'Comunicados Staff', href: '/staff-notifications', group: 'sistema', iconName: 'Bell', adminOnly: true },
    ];
}

/**
 * Derive group metadata dynamically from the items themselves.
 * The FIRST item in each group that has groupLabel/groupIcon defines the section.
 * No separate dictionary to maintain.
 */
export function getMenuGroups() {
    const items = getAllMenuResources();
    const groups: Record<string, { icon: string; label: string; description: string; order: number; adminOnly?: boolean; allowedForNonAdmin?: boolean; allowedForReceptionist?: boolean }> = {};

    for (const item of items) {
        if (!groups[item.group]) {
            const groupItems = items.filter(i => i.group === item.group);
            groups[item.group] = {
                icon: item.groupIcon || '📁',
                label: item.groupLabel || item.group.charAt(0).toUpperCase() + item.group.slice(1).replace(/-/g, ' '),
                description: item.groupDescription || '',
                order: item.groupOrder ?? 99,
                adminOnly: groupItems.every(i => i.adminOnly) || undefined,
                allowedForNonAdmin: groupItems.some(i => i.allowedForNonAdmin) || undefined,
                allowedForReceptionist: groupItems.some(i => i.allowedForReceptionist) || undefined,
            };
        }
    }
    return groups;
}

/** Auto-derived from items — backward compatible export */
export const MENU_GROUPS = getMenuGroups();

/**
 * Get menu resources grouped by category (for permissions UI).
 * Fully auto-derived — no manual grouping needed.
 */
export function getGroupedMenuResources(filterFn?: (item: MenuResource) => boolean) {
    const items = getAllMenuResources();
    const filtered = filterFn ? items.filter(filterFn) : items;
    const groups = getMenuGroups();

    const groupMap = new Map<string, MenuResource[]>();
    filtered.forEach(item => {
        if (!groupMap.has(item.group)) groupMap.set(item.group, []);
        groupMap.get(item.group)!.push(item);
    });

    return Array.from(groupMap.entries())
        .map(([groupId, groupItems]) => ({
            id: groupId,
            ...(groups[groupId] || { icon: '📁', label: groupId, description: '', order: 99 }),
            items: groupItems,
        }))
        .sort((a, b) => a.order - b.order);
}

