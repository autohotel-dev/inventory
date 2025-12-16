"use client";

import { useUserRole } from "@/hooks/use-user-role";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface RoleGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  fallbackUrl?: string;
}

export function RoleGuard({ 
  children, 
  requireAdmin = false,
  fallbackUrl = "/dashboard"
}: RoleGuardProps) {
  const { canAccessAdmin, isLoading, role } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && requireAdmin && !canAccessAdmin) {
      router.replace(fallbackUrl);
    }
  }, [isLoading, requireAdmin, canAccessAdmin, router, fallbackUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requireAdmin && !canAccessAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
        <p className="text-muted-foreground">
          No tienes permisos para acceder a esta sección.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
