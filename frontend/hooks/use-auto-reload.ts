"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/**
 * Hook que escucha un canal Supabase Realtime para forzar recarga en todos los clientes.
 * 
 * Uso: incluir en el layout principal.
 * Trigger: broadcast al canal 'system:deploy' con evento 'force_reload'
 * 
 * Trigger manual (desde consola de Supabase o curl):
 *   supabase.channel('system:deploy').send({ type: 'broadcast', event: 'force_reload', payload: { message: 'Nueva versión' } })
 */
export function useAutoReload() {
    const hasReloaded = useRef(false);

    useEffect(() => {
        const supabase = createClient();

        const channel = supabase.channel('system:deploy')
            .on('broadcast', { event: 'force_reload' }, (payload: any) => {
                if (hasReloaded.current) return;
                hasReloaded.current = true;

                const message = payload?.payload?.message || 'Se detectó una actualización del sistema';
                const delay = payload?.payload?.delay ?? 5; // seconds

                toast.info('🔄 Actualización detectada', {
                    description: `${message}. Recargando en ${delay}s...`,
                    duration: (delay + 1) * 1000,
                });

                setTimeout(() => {
                    window.location.reload();
                }, delay * 1000);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);
}
