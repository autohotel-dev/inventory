// ─── Print Service ───────────────────────────────────────────────────
// Módulo centralizado de impresión.
// Importar desde '@/lib/print' para acceder a todo el sistema.
//
// Para server-side (API routes), importar URL desde '@/lib/print/constants'.

// Constants (safe for server-side import via '@/lib/print/constants')
export { PRINT_SERVER_URL } from './constants';

// Client (requires "use client" context)
export {
  sendPrintJob,
  sendPrintJobSilent,
  checkPrintServer,
  sendTestPrint,
} from './print-client';
export type { PrintJobOptions } from './print-client';

// Data Builders
export {
  buildClosingBreakdowns,
  buildClosingTransactions,
  buildClosingTransactionsWithItems,
  buildCheckoutTicketItems,
  CONCEPT_LABELS,
  CONCEPT_DISPLAY,
  CONCEPT_LABELS_DETAILED,
  CONCEPT_LABELS_VERBOSE,
} from './ticket-data-builders';
export type {
  AccrualItem,
  BreakdownEntry,
  ClosingBreakdowns,
  ClosingTransaction,
  ClosingTransactionWithItems,
  TicketItem,
} from './ticket-data-builders';
