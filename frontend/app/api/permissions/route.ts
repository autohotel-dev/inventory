import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/permissions
 * Fetch permissions for a specific role or all roles
 * Query params: ?role=cochero (optional - role name)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get role from query params (role name)
        const searchParams = request.nextUrl.searchParams;
        const roleName = searchParams.get('role');

        if (roleName) {
            // Get role_id from role name
            const { data: roleData, error: roleError } = await supabase
                .from('roles')
                .select('id')
                
                ;

            if (roleError || !roleData) {
                return NextResponse.json({ error: 'Role not found' }, { status: 404 });
            }

            // Fetch permissions for this role using role_id
            const { data, error } = await supabase
                .from('role_permissions')
                .select('*')
                
                ;

            if (error) {
                console.error('Error fetching permissions:', error);
                return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
            }

            return NextResponse.json({ permissions: data });
        } else {
            // Fetch all permissions
            const { data, error } = await supabase
                .from('role_permissions')
                .select(`
          *,
          roles (
            id,
            name,
            display_name
          )
        `)
                ;

            if (error) {
                console.error('Error fetching permissions:', error);
                return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
            }

            return NextResponse.json({ permissions: data });
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
        const supabase = await createClient();

        // Check if user is authenticated and is admin/manager
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin or manager
        const { data: employee } = await supabase
            .from('employees')
            .select('role')
            
            
            ;

        if (!employee || !['admin', 'manager'].includes(employee.role)) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { role: roleName, permissions } = body;

        if (!roleName || !permissions || !Array.isArray(permissions)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        // Get role_id from role name
        const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('id')
            
            ;

        if (roleError || !roleData) {
            return NextResponse.json({ error: `Role '${roleName}' not found` }, { status: 404 });
        }

        // Format permissions for upsert using role_id
        const formattedPermissions = permissions.map((p: any) => ({
            role_id: roleData.id,
            resource: p.type === 'menu' ? `menu.${p.resource}` : `page.${p.resource}`,
            permission_type: p.type,
            allowed: p.allowed,
        }));

        // Upsert permissions
        const { error } = await supabase
            .from('role_permissions')
            .upsert(formattedPermissions, {
                onConflict: 'role_id,resource'
            });

        if (error) {
            console.error('Error upserting permissions:', error);
            return NextResponse.json({
                error: 'Failed to update permissions',
                details: error.message
            }, { status: 500 });
        }

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
        const supabase = await createClient();

        // Check if user is authenticated and is admin/manager
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin or manager
        const { data: employee } = await supabase
            .from('employees')
            .select('role')
            
            
            ;

        if (!employee || !['admin', 'manager'].includes(employee.role)) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { role: roleName, resource, type } = body;

        if (!roleName || !resource || !type) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        // Get role_id from role name
        const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('id')
            
            ;

        if (roleError || !roleData) {
            return NextResponse.json({ error: `Role '${roleName}' not found` }, { status: 404 });
        }

        const fullResource = type === 'menu' ? `menu.${resource}` : `page.${resource}`;

        const { error } = await supabase
            .from('role_permissions')
            .delete()
            
            
            ;

        if (error) {
            console.error('Error deleting permission:', error);
            return NextResponse.json({
                error: 'Failed to delete permission',
                details: error.message
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Permission deleted successfully' });
    } catch (error) {
        console.error('Error in DELETE /api/permissions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
