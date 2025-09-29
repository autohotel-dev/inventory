"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <button
      type="button"
      onClick={logout}
      className="border rounded px-2 py-1 text-xs w-full flex items-center justify-center gap-1 hover:bg-destructive/10 hover:border-destructive transition-colors"
      title="Cerrar sesión"
    >
      <svg className="w-3 h-3 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
      <span>Cerrar Sesión</span>
    </button>
  );
}
