"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Cocheros y camaristas trabajan solo desde la app móvil; el middleware los manda aquí
 * si entran a la versión web.
 */
export default function AppOnlyPage() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const logout = async () => {
    setLeaving(true);
    await createClient().auth.signOut();
    router.replace("/auth/login");
  };

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
          <Smartphone className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-xl">Usa la app móvil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Las cuentas de cochero y camarista operan solo desde la app Luxor en el teléfono.
          La versión web es para recepción y administración.
        </p>
        <button
          type="button"
          onClick={logout}
          disabled={leaving}
          className="w-full h-10 rounded-md border text-sm hover:bg-muted disabled:opacity-50"
        >
          {leaving ? "Cerrando sesión..." : "Cerrar sesión"}
        </button>
      </CardContent>
    </Card>
  );
}
