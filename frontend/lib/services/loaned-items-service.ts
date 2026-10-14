/**
 * Servicio de artículos en préstamo (loza, cristalería, hieleras...).
 *
 * Ciclo (ver supabase/migrations/20261013_loaned_items_lifecycle.sql):
 *   PRESTADO ──revisión──▶ RECUPERADO
 *            └─────────▶ PERDIDO ──recepción decide──▶ COBRADO (cargo a la cuenta) | PERDONADO (con motivo)
 *   El consumo se cancela/borra ▶ ANULADO.  Histórico nunca revisado ▶ CERRADO_SIN_REVISION.
 *
 * Toda modificación pasa por las funciones de la base (resolve_loaned_item, decide_loan_damage):
 * registran al empleado de la sesión, avisan a recepción y generan el cargo de forma atómica.
 *
 * Existencias: loan_item_catalog.stock_total, movida solo por register_loan_stock_movement y por los
 * faltantes (ver supabase/migrations/20261013_loaned_items_inventory.sql).
 *
 * Usado por: room-details-modal, connected-checkout-modal, products/loan-mapping
 */
import { createClient } from "@/lib/supabase/client";
import { Result, success, failure } from "@/lib/types/api";

// ─── Types ───────────────────────────────────────────────────────────

export type LoanStatus = "PRESTADO" | "RECUPERADO" | "PERDIDO" | "ANULADO" | "CERRADO_SIN_REVISION";
export type DamageDecision = "COBRADO" | "PERDONADO";

export interface LoanedItem {
    id: string;
    room_stay_id: string;
    loan_item_id: string;
    quantity: number;
    status: LoanStatus;
    notes: string | null;
    created_at: string;
    checked_at: string | null;
    damage_decision: DamageDecision | null;
    damage_amount: number | null;
    loan_item: { name: string; icon: string | null; damage_price: number | null } | null;
    checker?: { first_name: string | null; last_name: string | null } | null;
}

export interface PendingLoan extends LoanedItem {
    stay: { status: string; check_in_at: string; room: { number: string } | null } | null;
}

export interface LoanHistoryEntry extends LoanedItem {
    decided_at: string | null;
    stay: { check_in_at: string; room: { number: string } | null } | null;
    assignee: { first_name: string | null; last_name: string | null } | null;
    decider: { first_name: string | null; last_name: string | null } | null;
}

export interface LoanInventoryRow {
    id: string;
    name: string;
    icon: string | null;
    damage_price: number | null;
    is_active: boolean;
    /** null = nunca se ha contado */
    stock_total: number | null;
    min_available: number | null;
    /** Prestados en estancias activas */
    in_rooms: number;
    /** Prestados sin revisar de salidas ya cerradas: no se sabe dónde están */
    unchecked_closed: number;
    /** existencia − en habitaciones − sin revisar; null sin conteo */
    available: number | null;
    lost_30d: number;
    last_count_at: string | null;
}

export type StockMovementKind = "ENTRADA" | "BAJA" | "CONTEO" | "FALTANTE" | "FALTANTE_REVERTIDO";

export interface StockMovement {
    id: string;
    kind: StockMovementKind;
    delta: number;
    stock_after: number;
    reason: string | null;
    created_at: string;
    employee: { first_name: string | null; last_name: string | null } | null;
}

export interface LoanSummary {
    /** Entregados que nadie ha revisado */
    unchecked: number;
    /** Faltantes reportados en los que recepción aún no decide */
    missingUndecided: number;
    /** Monto sugerido de esos faltantes (precio de daño × cantidad) */
    missingSuggestedAmount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
    PRESTADO: "Sin revisar",
    RECUPERADO: "Recuperado",
    PERDIDO: "Faltante",
    ANULADO: "Anulado",
    CERRADO_SIN_REVISION: "Cerrado sin revisión",
};

export const isMissingUndecided = (loan: Pick<LoanedItem, "status" | "damage_decision">) =>
    loan.status === "PERDIDO" && !loan.damage_decision;

export const suggestedDamageAmount = (loan: Pick<LoanedItem, "quantity" | "loan_item">) =>
    Number(loan.loan_item?.damage_price || 0) * Number(loan.quantity || 1);

export function summarizeLoans(loans: LoanedItem[]): LoanSummary {
    const missing = loans.filter(isMissingUndecided);
    return {
        unchecked: loans.filter(l => l.status === "PRESTADO").length,
        missingUndecided: missing.length,
        missingSuggestedAmount: missing.reduce((sum, l) => sum + suggestedDamageAmount(l), 0),
    };
}

const LOAN_SELECT =
    "id, room_stay_id, loan_item_id, quantity, status, notes, created_at, checked_at, damage_decision, damage_amount, " +
    "loan_item:loan_item_catalog(name, icon, damage_price), checker:employees!stay_loaned_items_checked_by_fkey(first_name, last_name)";

type RpcResult = { success: boolean; error?: string; [key: string]: unknown };

async function callRpc(fn: string, args: Record<string, unknown>): Promise<Result<RpcResult>> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return failure(error.message);
    const result = data as RpcResult;
    if (!result?.success) return failure(result?.error || "No se pudo completar la operación");
    return success(result);
}

// ─── Queries ─────────────────────────────────────────────────────────

/** Préstamos de una estancia (sin los anulados, que ya no aplican) */
export async function fetchStayLoans(stayId: string): Promise<Result<LoanedItem[]>> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("stay_loaned_items")
        .select(LOAN_SELECT)
        .eq("room_stay_id", stayId)
        .neq("status", "ANULADO")
        .order("created_at", { ascending: true });
    if (error) return failure(error.message);
    return success((data || []) as unknown as LoanedItem[]);
}

/** Lo que recepción tiene que resolver: sin revisar o faltantes sin decisión, de cualquier estancia */
export async function fetchPendingLoans(): Promise<Result<PendingLoan[]>> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("stay_loaned_items")
        .select(`${LOAN_SELECT}, stay:room_stays(status, check_in_at, room:rooms(number))`)
        .or("status.eq.PRESTADO,and(status.eq.PERDIDO,damage_decision.is.null)")
        .order("created_at", { ascending: false })
        .limit(500);
    if (error) return failure(error.message);
    return success((data || []) as unknown as PendingLoan[]);
}

/** Préstamos revisados (recuperados o faltantes) desde una fecha, para historial y reportes */
export async function fetchLoanHistory(fromIso: string): Promise<Result<LoanHistoryEntry[]>> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("stay_loaned_items")
        .select(
            `${LOAN_SELECT}, decided_at, stay:room_stays(check_in_at, room:rooms(number)), ` +
            "assignee:employees!stay_loaned_items_assigned_by_fkey(first_name, last_name), " +
            "decider:employees!stay_loaned_items_decided_by_fkey(first_name, last_name)"
        )
        .in("status", ["RECUPERADO", "PERDIDO"])
        .gte("checked_at", fromIso)
        .order("checked_at", { ascending: false })
        .limit(2000);
    if (error) return failure(error.message);
    return success((data || []) as unknown as LoanHistoryEntry[]);
}

/** Existencia, prestados, sin revisar y disponibles por artículo */
export async function fetchLoanInventory(): Promise<Result<LoanInventoryRow[]>> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_loan_inventory");
    if (error) return failure(error.message);
    return success((data || []) as LoanInventoryRow[]);
}

export async function fetchStockMovements(loanItemId: string, limit = 30): Promise<Result<StockMovement[]>> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("loan_item_movements")
        .select("id, kind, delta, stock_after, reason, created_at, employee:employees(first_name, last_name)")
        .eq("loan_item_id", loanItemId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) return failure(error.message);
    return success((data || []) as unknown as StockMovement[]);
}

// ─── Mutations ───────────────────────────────────────────────────────

/** Cochero o recepción: el artículo regresó o falta. Registra al empleado de la sesión. */
export function resolveLoanedItem(loanId: string, status: "RECUPERADO" | "PERDIDO", note?: string) {
    return callRpc("resolve_loaned_item", { p_loan_id: loanId, p_status: status, p_note: note || null });
}

/** Recepción/admin: cobrar un faltante (monto editable) o perdonarlo (motivo obligatorio). */
export function decideLoanDamage(loanId: string, decision: DamageDecision, opts: { amount?: number; note?: string } = {}) {
    return callRpc("decide_loan_damage", {
        p_loan_id: loanId,
        p_decision: decision,
        p_amount: decision === "COBRADO" ? opts.amount ?? null : null,
        p_note: opts.note || null,
    });
}

/**
 * Admin: ENTRADA (compra), BAJA (rotura/merma, motivo obligatorio) o CONTEO (existencia total contada).
 * El primer movimiento de un artículo tiene que ser un CONTEO.
 */
export function registerStockMovement(loanItemId: string, kind: "ENTRADA" | "BAJA" | "CONTEO", quantity: number, reason?: string) {
    return callRpc("register_loan_stock_movement", {
        p_loan_item_id: loanItemId,
        p_kind: kind,
        p_quantity: quantity,
        p_reason: reason || null,
    });
}
