"use client";

import { useEffect } from "react";

export function ForceDashboardRedirect() {
  useEffect(() => {
    console.log(' FORCING DASHBOARD REDIRECT...');
    
    // Múltiples intentos de redirect
    const redirectToDashboard = () => {
      const dashboardUrl = String(process.env.NEXT_PUBLIC_DASHBOARD_URL);
      
      console.log('Attempting redirect to:', dashboardUrl);
      
      // Método 1: Inmediato
      window.location.href = dashboardUrl;
      
      // Método 2: Con delay
      setTimeout(() => {
        window.location.replace(dashboardUrl);
      }, 500);
      
      // Método 3: Forzar con assign
      setTimeout(() => {
        window.location.assign(dashboardUrl);
      }, 1000);
    };
    
    // Ejecutar inmediatamente
    redirectToDashboard();
    
    // Backup cada segundo por 5 segundos
    const interval = setInterval(() => {
      console.log('Backup redirect attempt...');
      redirectToDashboard();
    }, 1000);
    
    // Limpiar después de 5 segundos
    setTimeout(() => {
      clearInterval(interval);
    }, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirigiendo al dashboard...</p>
        <p className="text-xs text-muted-foreground mt-2">Si no redirige automáticamente,
          <a href={String(process.env.NEXT_PUBLIC_DASHBOARD_URL)} className="text-primary underline ml-1">
            haz click aquí
          </a>
        </p>
      </div>
    </div>
  );
}
