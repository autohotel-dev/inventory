"use client";

import { useUserRole } from "@/hooks/use-user-role";
import { ReceptionistDashboard } from "./receptionist-dashboard";
import { Loader2 } from "lucide-react";

interface DashboardWrapperProps {
  children: React.ReactNode; // Dashboard de admin (server component content)
}

export function DashboardWrapper({ children }: DashboardWrapperProps) {
  const { canAccessAdmin, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Si es recepcionista, mostrar dashboard simplificado
  if (!canAccessAdmin) {
    return <ReceptionistDashboard />;
  }

  // Si es admin/manager, mostrar dashboard completo
  return <>{children}</>;
}
