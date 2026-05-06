import { apiClient } from '@/lib/api/client';
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/employees/create-auth-user
 * Creates a Cognito user for an employee and links the auth_user_id.
 * This should be called by admins when assigning login credentials to employees.
 */
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

    // Delegate user creation to backend (which handles Cognito)
    const { data } = await apiClient.post('/hr/employees/create-auth-user', {
      email,
      password,
      employee_id: employeeId,
    });

    return NextResponse.json({
      success: true,
      userId: data?.user_id,
      message: "Usuario creado y vinculado correctamente",
    });
  } catch (error: any) {
    const detail = error?.response?.data?.detail || error.message || "Error interno del servidor";
    const status = error?.response?.status || 500;

    if (detail.includes("already") || status === 409) {
      return NextResponse.json(
        { error: "Este email ya tiene una cuenta de usuario" },
        { status: 409 }
      );
    }

    console.error("Error creating auth user:", error);
    return NextResponse.json(
      { error: detail },
      { status }
    );
  }
}
