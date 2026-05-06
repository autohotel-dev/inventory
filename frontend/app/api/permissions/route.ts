import { apiClient } from '@/lib/api/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/permissions
 * Fetch permissions for a specific role or all roles
 * Query params: ?role=cochero (optional - role name)
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const roleName = searchParams.get('role');

        if (roleName) {
            // Get role_id from role name
            const { data: rolesData } = await apiClient.get('/system/crud/roles', { params: { name: roleName } });
            const roles = Array.isArray(rolesData) ? rolesData : (rolesData?.items || rolesData?.results || []);
            const roleData = roles[0];

            if (!roleData) {
                return NextResponse.json({ error: 'Role not found' }, { status: 404 });
            }

            // Fetch permissions for this role using role_id
            const { data: permsData } = await apiClient.get('/system/crud/role_permissions', { params: { role_id: roleData.id } });
            const permissions = Array.isArray(permsData) ? permsData : (permsData?.items || permsData?.results || []);

            return NextResponse.json({ permissions });
        } else {
            // Fetch all permissions
            const { data: permsData } = await apiClient.get('/system/crud/role_permissions');
            const permissions = Array.isArray(permsData) ? permsData : (permsData?.items || permsData?.results || []);

            return NextResponse.json({ permissions });
        }
    } catch (error) {
        console.error('Error in GET /api/permissions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/permissions
 * Create or update permissions (bulk operation)
 * Body: { role: string (role name), permissions: Array<{ resource: string, type: string, allowed: boolean }> }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { role: roleName, permissions } = body;

        if (!roleName || !permissions || !Array.isArray(permissions)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        // Get role_id from role name
        const { data: rolesData } = await apiClient.get('/system/crud/roles', { params: { name: roleName } });
        const roles = Array.isArray(rolesData) ? rolesData : (rolesData?.items || rolesData?.results || []);
        const roleData = roles[0];

        if (!roleData) {
            return NextResponse.json({ error: `Role '${roleName}' not found` }, { status: 404 });
        }

        // Format permissions for upsert using role_id
        const formattedPermissions = permissions.map((p: any) => ({
            role_id: roleData.id,
            resource: p.type === 'menu' ? `menu.${p.resource}` : `page.${p.resource}`,
            permission_type: p.type,
            allowed: p.allowed,
        }));

        // Upsert permissions via backend
        await apiClient.post('/system/crud/role_permissions', formattedPermissions);

        return NextResponse.json({ success: true, message: 'Permissions updated successfully' });
    } catch (error) {
        console.error('Error in POST /api/permissions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/permissions
 * Delete a specific permission
 * Body: { role: string (role name), resource: string, type: string }
 */
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { role: roleName, resource, type } = body;

        if (!roleName || !resource || !type) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        // Get role_id from role name
        const { data: rolesData } = await apiClient.get('/system/crud/roles', { params: { name: roleName } });
        const roles = Array.isArray(rolesData) ? rolesData : (rolesData?.items || rolesData?.results || []);
        const roleData = roles[0];

        if (!roleData) {
            return NextResponse.json({ error: `Role '${roleName}' not found` }, { status: 404 });
        }

        const fullResource = type === 'menu' ? `menu.${resource}` : `page.${resource}`;

        // Delete via backend CRUD
        const { data: existingPerms } = await apiClient.get('/system/crud/role_permissions', {
            params: { role_id: roleData.id, resource: fullResource }
        });
        const perms = Array.isArray(existingPerms) ? existingPerms : (existingPerms?.items || existingPerms?.results || []);
        
        for (const perm of perms) {
            await apiClient.delete(`/system/crud/role_permissions/${perm.id}`);
        }

        return NextResponse.json({ success: true, message: 'Permission deleted successfully' });
    } catch (error) {
        console.error('Error in DELETE /api/permissions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
