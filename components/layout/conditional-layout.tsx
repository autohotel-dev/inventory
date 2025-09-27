"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Breadcrumbs } from "./breadcrumbs";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  
  // Rutas que no deben mostrar el sidebar
  const noSidebarRoutes = ['/auth', '/protected'];
  const isNoSidebarRoute = noSidebarRoutes.some(route => pathname.startsWith(route));
  const isLandingPage = pathname === '/';
  
  if (isNoSidebarRoute || isLandingPage) {
    // Layout simple para rutas de autenticación y landing page
    return <>{children}</>;
  }
  
  // Layout completo con sidebar para rutas principales
  return (
    <div className="min-h-screen flex flex-col md:grid md:grid-cols-[240px_1fr]">
      <Sidebar />
      <main className="flex-1 px-3 py-4 md:px-6 md:py-6 max-w-7xl w-full mx-auto space-y-4 md:space-y-6">
        <Breadcrumbs />
        {children}
      </main>
    </div>
  );
}
