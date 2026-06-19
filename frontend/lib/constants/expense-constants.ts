/**
 * Constantes relacionadas con gastos de turno
 * Centralizado para uso en hooks, componentes, y tickets
 */

// ─── Expense Types ───────────────────────────────────────────────────

export const EXPENSE_TYPES = {
    UBER: "UBER",
    MAINTENANCE: "MAINTENANCE",
    REPAIR: "REPAIR",
    SUPPLIES: "SUPPLIES",
    PETTY_CASH: "PETTY_CASH",
    OTHER: "OTHER",
} as const;

export type ExpenseType = typeof EXPENSE_TYPES[keyof typeof EXPENSE_TYPES];

// ─── Labels with emojis (for tickets, modals, print) ─────────────────

export const EXPENSE_LABELS: Record<string, string> = {
    UBER: "🚗 Uber / Transporte",
    MAINTENANCE: "🔧 Mantenimiento",
    REPAIR: "🛠️ Reparación",
    SUPPLIES: "📦 Insumos",
    PETTY_CASH: "💵 Caja Chica",
    OTHER: "📝 Otro Gasto",
};

// ─── Labels without emojis (for formal reports, audit logs) ──────────

export const EXPENSE_LABELS_PLAIN: Record<string, string> = {
    UBER: "Uber / Transporte",
    MAINTENANCE: "Mantenimiento",
    REPAIR: "Reparación",
    SUPPLIES: "Insumos",
    PETTY_CASH: "Caja Chica",
    OTHER: "Otro Gasto",
};

// ─── Emojis only (for compact displays) ──────────────────────────────

export const EXPENSE_EMOJIS: Record<string, string> = {
    UBER: "🚗",
    MAINTENANCE: "🔧",
    REPAIR: "🛠️",
    SUPPLIES: "📦",
    PETTY_CASH: "💵",
    OTHER: "📝",
};

/**
 * Helper: get label for an expense type, with fallback
 */
export function getExpenseLabel(type: string, plain = false): string {
    return plain
        ? EXPENSE_LABELS_PLAIN[type] || type
        : EXPENSE_LABELS[type] || type;
}
