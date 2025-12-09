"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Breadcrumbs } from "./breadcrumbs";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Sincronizar con el estado del sidebar desde localStorage
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sidebar-compact");
    setSidebarCompact(stored === "1");

    // Escuchar cambios en localStorage (cuando el sidebar cambia)
    const handleStorageChange = () => {
      const stored = localStorage.getItem("sidebar-compact");
      setSidebarCompact(stored === "1");
    };

    // Custom event para detectar cambios del sidebar
    const handleSidebarChange = () => {
      const stored = localStorage.getItem("sidebar-compact");
      setSidebarCompact(stored === "1");
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("sidebar-compact-change", handleSidebarChange);

    // Polling como fallback (cada 100ms solo si hay cambio)
    let lastValue = stored;
    const interval = setInterval(() => {
      const current = localStorage.getItem("sidebar-compact");
      if (current !== lastValue) {
        lastValue = current;
        setSidebarCompact(current === "1");
      }
    }, 100);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sidebar-compact-change", handleSidebarChange);
      clearInterval(interval);
    };
  }, []);
  
  // Rutas que no deben mostrar el sidebar
  const noSidebarRoutes = ['/auth'];
  const isNoSidebarRoute = noSidebarRoutes.some(route => pathname.startsWith(route));
  const isLandingPage = pathname === '/';
  
  if (isNoSidebarRoute || isLandingPage) {
    // Layout simple para rutas de autenticación y landing page
    return <>{children}</>;
  }

  // Ancho del sidebar según estado
  const sidebarWidth = sidebarCompact ? "72px" : "256px";
  
  // Layout completo con sidebar para rutas principales
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <main 
        className="flex-1 px-3 py-4 md:px-6 md:py-6 w-full space-y-4 md:space-y-6 transition-all duration-200"
        style={{ 
          marginLeft: mounted ? undefined : undefined,
          maxWidth: "100%"
        }}
      >
        <Breadcrumbs />
        {children}
      </main>
    </div>
  );
}
