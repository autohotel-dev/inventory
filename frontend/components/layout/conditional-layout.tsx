"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { BottomNav } from "./bottom-nav";
import { UserNav } from "./user-nav";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ConnectionIndicator } from "./connection-indicator";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sidebar-compact");
    setSidebarCompact(stored === "1");

    const handleStorageChange = () => {
      const stored = localStorage.getItem("sidebar-compact");
      setSidebarCompact(stored === "1");
    };

    const handleSidebarChange = () => {
      const stored = localStorage.getItem("sidebar-compact");
      setSidebarCompact(stored === "1");
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("sidebar-compact-change", handleSidebarChange);

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


  const noSidebarRoutes = ['/auth', '/reports/income/print', '/guest-portal'];
  const isNoSidebarRoute = noSidebarRoutes.some(route => pathname.startsWith(route));
  const isLandingPage = pathname === '/';

  if (isNoSidebarRoute || isLandingPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar />
      <main
        className="flex-1 w-full transition-all duration-200 pb-24 md:pb-0"
        style={{ maxWidth: "100%" }}
      >
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="flex items-center justify-between gap-4 px-4 md:px-7 py-3">
            <Breadcrumbs />
            <div className="flex items-center gap-2">
              <ConnectionIndicator />
              <NotificationCenter />
              <UserNav />
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="px-4 md:px-7 py-5 space-y-5">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
