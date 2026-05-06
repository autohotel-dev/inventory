import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/roles
 * Fetch all roles or a specific role
 * Query params: ?id=uuid (optional)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get('id');

        if (id) {
            // Fetch single role by ID
            const { data, error } = await supabase
                .from('roles')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching role:', error);
                return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
            }

            return NextResponse.json({ roles: data });
        } else {
            // Fetch all roles
            const { data, error } = await supabase
                .from('roles')
                .select('*')
                
                ;

            if (error) {
                console.error('Error fetching roles:', error);
                return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
            }

            return NextResponse.json({ roles: data });
        }
    } catch (error) {
        console.error('Error in GET /api/roles:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/roles
 * Create a new role
 * Body: { name: string, display_name: string, description?: string }
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
            .eq('user_id', user.id)
            .single();

        if (!employee || !['admin', 'manager'].includes(employee.role)) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { name, display_name, description } = body;

        if (!name || !display_name) {
            return NextResponse.json({ error: 'Name and display_name are required' }, { status: 400 });
        }

        // Validate name format (lowercase, no spaces, alphanumeric + underscore)
        if (!/^[a-z0-9_]+$/.test(name)) {
            return NextResponse.json({
                error: 'Name must be lowercase alphanumeric with underscores only'
            }, { status: 400 });
        }

        // Create role
        const { data, error } = await supabase
            .from('roles')
            .insert({
                name,
                display_name,
                description,
                is_protected: false,
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                return NextResponse.json({ error: 'Role name already exists' }, { status: 409 });
            }
            console.error('Error creating role:', error);
            return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
        }

        return NextResponse.json({ role: data, message: 'Role created successfully' });
    } catch (error) {
        console.error('Error in POST /api/roles:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT /api/roles
 * Update an existing role
 * Body: { id: string, display_name?: string, description?: string, is_active?: boolean }
 */
export async function PUT(request: NextRequest) {
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
            .eq('user_id', user.id)
            .single();

        if (!employee || !['admin', 'manager'].includes(employee.role)) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { id, display_name, description, is_active } = body;

        if (!id) {
            return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }

        // Build update object
        const updates: any = {};
        if (display_name !== undefined) updates.display_name = display_name;
        if (description !== undefined) updates.description = description;
        if (is_active !== undefined) updates.is_active = is_active;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        // Update role
        const { data, error } = await supabase
            .from('roles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating role:', error);
            return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
        }

        return NextResponse.json({ role: data, message: 'Role updated successfully' });
    } catch (error) {
        console.error('Error in PUT /api/roles:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/roles
 * Delete a role
 * Body: { id: string }
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
            .eq('user_id', user.id)
            .single();

        if (!employee || !['admin', 'manager'].includes(employee.role)) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }

        // Delete role (triggers will prevent deletion if protected or in use)
        const { error } = await supabase
            .from('roles')
            .delete()
            .eq('id', id);

        if (error) {
            // Check if it's a trigger error
            if (error.message.includes('Cannot delete protected role')) {
                return NextResponse.json({
                    error: 'Cannot delete protected role (admin, manager)'
                }, { status: 403 });
            }
            if (error.message.includes('employee(s) are assigned to it')) {
                return NextResponse.json({
                    error: error.message
                }, { status: 409 });
            }
            console.error('Error deleting role:', error);
            return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Error in DELETE /api/roles:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
