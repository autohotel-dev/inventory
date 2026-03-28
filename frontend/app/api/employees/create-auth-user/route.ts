import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Verificar que el service role key existe
    if (!serviceRoleKey) {
      console.error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in environment variables");
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no está configurado en el servidor" },
        { status: 500 }
      );
    }

    const supabase = await createClient();

    // Check if user is authenticated and is admin/manager
    const { data: { user }, error: authUserError } = await supabase.auth.getUser();
    if (authUserError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or manager
    const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .single();

    if (!employee || !['admin', 'manager'].includes(employee.role)) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Cliente admin de Supabase (usa service_role key)
    const supabaseAdmin = createSupabaseAdminClient(
      supabaseUrl!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body = await request.json();
    const { email, password, employeeId } = body;

    if (!email || !password || !employeeId) {
      return NextResponse.json(
        { error: "Email, password y employeeId son requeridos" },
        { status: 400 }
      );
    }

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmar email automáticamente
      user_metadata: {
        employee_id: employeeId,
      },
    });

    if (authError) {
      // Manejar errores comunes
      if (authError.message.includes("already been registered")) {
        return NextResponse.json(
          { error: "Este email ya tiene una cuenta de usuario" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // Vincular el auth_user_id con el empleado
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ auth_user_id: authData.user.id })
      .eq("id", employeeId);

    if (updateError) {
      // Si falla la vinculación, eliminar el usuario creado
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Error al vincular usuario con empleado" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
      message: "Usuario creado y vinculado correctamente",
    });
  } catch (error: any) {
    console.error("Error creating auth user:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
