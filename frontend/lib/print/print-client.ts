"use client";

import { toast } from 'sonner';
import { PRINT_SERVER_URL } from './constants';

// Re-export for convenience
export { PRINT_SERVER_URL } from './constants';

// ─── Types ───────────────────────────────────────────────────────────

export interface PrintJobOptions {
  /** No mostrar toast de error (fire-and-forget) */
  silent?: boolean;
  /** Toast de éxito custom */
  successMsg?: string;
  /** Descripción del toast de éxito */
  successDesc?: string;
  /** Endpoint del print-server ('/print' por defecto) */
  endpoint?: string;
  /** Enviar data directamente sin wrapper { type, data }. Para endpoints como /print-closing */
  rawBody?: boolean;
}

// ─── Core Print Function ─────────────────────────────────────────────

/**
 * Envía un trabajo de impresión al print-server.
 * Centraliza: URL, fetch, error handling, toasts.
 *
 * @param type — Tipo de ticket: 'reception', 'client', 'checkout', 'entry', 'payment', 'tolerance', 'qr', 'closing'
 * @param data — Datos del ticket (varía por tipo)
 * @param options — Opciones de comportamiento
 * @returns true si la impresión fue exitosa
 */
export async function sendPrintJob(
  type: string,
  data: unknown,
  options: PrintJobOptions = {},
): Promise<boolean> {
  const { silent = false, successMsg, successDesc, endpoint = '/print', rawBody = false } = options;

  try {
    const body = rawBody ? JSON.stringify(data) : JSON.stringify({ type, data });
    const response = await fetch(`${PRINT_SERVER_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errorData.error || `Error al imprimir (${type})`);
    }

    if (successMsg && !silent) {
      toast.success(successMsg, successDesc ? { description: successDesc } : undefined);
    }

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';

    if (!silent) {
      if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
        toast.error('Print-server no disponible', {
          description: 'Verifica que el print-server esté corriendo en localhost:3001',
          duration: 8000,
        });
      } else {
        toast.error('Error al imprimir', {
          description: errorMessage,
          duration: 5000,
        });
      }
    }

    console.error(`[PrintClient] Error (${type}):`, err);
    return false;
  }
}

// ─── Convenience: fire-and-forget ────────────────────────────────────

/**
 * Envía un trabajo de impresión sin esperar resultado ni mostrar errores.
 * Ideal para impresiones secundarias que no deben bloquear el flujo.
 */
export function sendPrintJobSilent(type: string, data: unknown): void {
  sendPrintJob(type, data, { silent: true }).catch(() => {
    // Silenced intentionally
  });
}

// ─── Health Check ────────────────────────────────────────────────────

/**
 * Verifica si el print-server está disponible.
 */
export async function checkPrintServer(): Promise<boolean> {
  try {
    const res = await fetch(`${PRINT_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Test Print ──────────────────────────────────────────────────────

/**
 * Envía un ticket de prueba al print-server.
 */
export async function sendTestPrint(): Promise<boolean> {
  return sendPrintJob('test', {}, {
    endpoint: '/print/test',
    successMsg: 'Prueba de impresión completada',
    successDesc: 'La impresora está configurada correctamente',
  });
}
