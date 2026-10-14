"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeResilient } from "@/lib/supabase/resilient-channel";

/** Estancia afectada por el cambio; null si Realtime no la incluye (p.ej. un DELETE) o al reconectar */
type LoanChangeListener = (stayId: string | null) => void;

// Un solo canal para todos los que escuchan préstamos (Pendientes tiene un panel por estancia)
const listeners = new Set<LoanChangeListener>();
let unsubscribe: (() => void) | null = null;

function addListener(listener: LoanChangeListener) {
  listeners.add(listener);
  if (!unsubscribe) {
    unsubscribe = subscribeResilient(
      createClient(),
      "stay-loaned-items",
      (channel) => channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stay_loaned_items" },
        (payload: { new?: { room_stay_id?: string }; old?: { room_stay_id?: string } }) => {
          const stayId = payload.new?.room_stay_id ?? payload.old?.room_stay_id ?? null;
          listeners.forEach((l) => l(stayId));
        }
      ),
      // (Re)conectado: lo que cambió mientras estaba caído no llega, todos recargan
      () => listeners.forEach((l) => l(null))
    );
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

/**
 * Llama a onChange cuando cambia un préstamo (lo crea un consumo, lo revisa un cochero,
 * recepción decide un faltante). Con stayId, solo por cambios de esa estancia.
 * Las ráfagas se agrupan: un consumo con varios artículos dispara una sola recarga.
 */
export function useLoanChanges(onChange: () => void, stayId?: string) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const remove = addListener((changedStay) => {
      if (stayId && changedStay && changedStay !== stayId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      remove();
    };
  }, [stayId]);
}
