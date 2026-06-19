// ─── Print Server Configuration ─────────────────────────────────────
// Constantes compartidas entre cliente y servidor.
// NO tiene "use client" para poder ser importado desde API routes.

/**
 * URL del print-server — única fuente de verdad.
 * Configurable via variable de entorno NEXT_PUBLIC_PRINT_SERVER_URL.
 */
export const PRINT_SERVER_URL =
  process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';
