import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Cliente admin de Supabase (usa service_role key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, employeeId } = body;

    if (!email || !password || !employeeId) {
      return NextResponse.json(
        { error: "Email, password y employeeId son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que el service role key existe
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no está configurado en el servidor" },
        { status: 500 }
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
