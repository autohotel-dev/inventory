"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { logAudit } from "@/lib/audit-logger";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  
  // State for handling force password change
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      showError("Contraseña inválida", "La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    
    setIsConfirming(true);
    try {
      const { confirmSignIn } = await import('aws-amplify/auth');
      const result = await confirmSignIn({ challengeResponse: newPassword });
      
      if (result.nextStep.signInStep === 'DONE') {
        success("¡Contraseña actualizada!", "Bienvenido al sistema");
        window.location.href = "/dashboard";
      } else {
        throw new Error(`Paso inesperado: ${result.nextStep.signInStep}`);
      }
    } catch (error: any) {
      showError("Error", error.message || "No se pudo actualizar la contraseña");
    } finally {
      setIsConfirming(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      const { signIn } = await import('aws-amplify/auth');

      const result = await signIn({
        username: data.email,
        password: data.password,
      });
      
      if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setNeedsNewPassword(true);
        return;
      }
      
      if (result.nextStep.signInStep !== 'DONE') {
        throw new Error(`Paso requerido: ${result.nextStep.signInStep}`);
      }

      logAudit("LOGIN", { description: `Login exitoso: ${data.email}` });
      success("¡Bienvenido!", "Has iniciado sesión correctamente");
      window.location.href = "/dashboard";
    } catch (error: any) {
      // Si por alguna razón sigue diciendo que ya hay sesión, redirigir
      if (error?.message?.includes('already a signed in user') || error?.name === 'UserAlreadyAuthenticatedException') {
        window.location.href = "/dashboard";
        return;
      }

      logAudit("LOGIN_FAILED", {
        description: `Intento fallido: ${data.email}`,
        metadata: { error: error?.message || "unknown" },
      });
      showError(
        "Error al iniciar sesión",
        error?.message || "Ocurrió un error inesperado"
      );
    }
  };

  if (needsNewPassword) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Actualiza tu contraseña</CardTitle>
            <CardDescription>
              Por seguridad, debes crear una contraseña nueva la primera vez que ingresas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNewPasswordSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="new-password">Nueva Contraseña</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isConfirming}>
                  {isConfirming ? "Actualizando..." : "Guardar y Entrar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 mb-4 relative">
            <Image src="/luxor-logo.png" alt="Luxor Logo" fill sizes="(max-width: 64px) 100vw, 64px" className="object-contain" />
          </div>
          <CardTitle className="text-2xl">Luxor Manager</CardTitle>
          <CardDescription>
            Sistema de Gestión para Auto Hotel Luxor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
