"use client";

import { useUserRole } from "@/hooks/use-user-role";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getMenuPermissions, type UserRole } from "@/lib/permissions";

interface RoleGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** If provided, non-admin users with this permission in role_permissions can access the page */
  permissionId?: string;
  fallbackUrl?: string;
}

export function RoleGuard({
  children,
  requireAdmin = false,
  permissionId,
  fallbackUrl = "/dashboard"
}: RoleGuardProps) {
  const { canAccessAdmin, isLoading, role } = useUserRole();
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [checkingPermission, setCheckingPermission] = useState(false);

  // For non-admin users, check DB permissions when permissionId is provided
  useEffect(() => {
    if (isLoading || canAccessAdmin || !requireAdmin || !permissionId || !role) return;

    let cancelled = false;
    setCheckingPermission(true);

    async function checkPerm() {
      try {
        const perms = await getMenuPermissions(role as UserRole);
        if (!cancelled) {
          setHasPermission(perms.includes(permissionId!));
        }
      } catch (err) {
        console.error('Error checking page permission:', err);
        if (!cancelled) setHasPermission(false);
      } finally {
        if (!cancelled) setCheckingPermission(false);
      }
    }
    checkPerm();
    return () => { cancelled = true; };
  }, [isLoading, canAccessAdmin, requireAdmin, permissionId, role]);

  // Determine if access is allowed
  const isAccessAllowed = () => {
    if (!requireAdmin) return true;
    if (canAccessAdmin) return true;
    // If permissionId provided, check DB permissions
    if (permissionId && hasPermission === true) return true;
    return false;
  };

  // Redirect if not allowed (after all checks finish)
  useEffect(() => {
    if (isLoading || checkingPermission) return;
    if (hasPermission === null && permissionId && !canAccessAdmin) return; // still waiting
    if (!isAccessAllowed()) {
      router.replace(fallbackUrl);
    }
  }, [isLoading, checkingPermission, hasPermission, canAccessAdmin, requireAdmin, permissionId, router, fallbackUrl]);

  if (isLoading || checkingPermission || (permissionId && hasPermission === null && !canAccessAdmin)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAccessAllowed()) {
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

