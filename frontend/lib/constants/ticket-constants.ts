/**
 * Constantes de tipos de ticket para el sistema de impresión y reimpresión
 * Centralizado: usado por PrintHistoryTable, useReprintCenter, TicketPreviewModal
 */

// ─── Ticket Types ────────────────────────────────────────────────────

export const TICKET_TYPES = {
    ENTRY: "entry",
    CHECKOUT: "checkout",
    CONSUMPTION: "consumption",
    PAYMENT: "payment",
    CLOSING: "closing",
    TOLERANCE: "tolerance",
} as const;

export type TicketType = typeof TICKET_TYPES[keyof typeof TICKET_TYPES];

// ─── Labels with metadata (colors for UI badges, emojis for tickets) ─

export interface TicketTypeMeta {
    label: string;
    emoji: string;
    /** Tailwind classes for Badge variant */
    color: string;
}

export const TICKET_TYPE_LABELS: Record<TicketType, TicketTypeMeta> = {
    entry: {
        label: "Entrada",
        emoji: "🚪",
        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    checkout: {
        label: "Salida",
        emoji: "🚶",
        color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    consumption: {
        label: "Consumo",
        emoji: "🛒",
        color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
    payment: {
        label: "Pago",
        emoji: "💰",
        color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
    closing: {
        label: "Corte",
        emoji: "📋",
        color: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    },
    tolerance: {
        label: "Tolerancia",
        emoji: "⏳",
        color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    },
};

// ─── Labels for TicketPreviewModal (longer form) ─────────────────────

export const TICKET_TYPE_PREVIEW_LABELS: Record<TicketType, { label: string; emoji: string }> = {
    entry: { label: "Ticket de Entrada", emoji: "🚪" },
    checkout: { label: "Ticket de Salida", emoji: "🚶" },
    consumption: { label: "Ticket de Consumo", emoji: "🛒" },
    payment: { label: "Comprobante de Pago", emoji: "💰" },
    closing: { label: "Corte de Caja", emoji: "📋" },
    tolerance: { label: "Ticket de Tolerancia", emoji: "⏳" },
};

/**
 * Helper: get ticket type label
 */
export function getTicketTypeLabel(type: string): string {
    return TICKET_TYPE_LABELS[type as TicketType]?.label || type;
}
