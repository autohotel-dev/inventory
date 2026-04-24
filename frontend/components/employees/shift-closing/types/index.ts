import { ShiftSession } from "../../types";
import { ShiftExpense } from "@/types/expenses";

export interface ShiftClosingProps {
  session: ShiftSession;
  onClose: () => void;
  onComplete: () => void;
}

export interface EnrichedPayment {
  id: string;
  created_at: string;
  amount: number;
  payment_method: string;
  terminal_code?: string;
  payment_terminals?: { code: string; name: string } | null;
  sales_order_id?: string;
  sales_orders?: { id: string; total: number; status: string } | null;
  reference?: string | null;
  concept?: string | null;
  itemsDescription: string | null;
  itemsCount: number;
  itemsRaw: Array<{ name: string; qty: number; unitPrice: number; total: number }> | null;
}

export interface PaymentSummary {
  total_cash: number;
  total_card_bbva: number;
  total_card_getnet: number;
  total_sales: number;
  total_transactions: number;
  payments: EnrichedPayment[];
  salesOrders: any[];
  expenses?: ShiftExpense[];
  total_expenses?: number;
  total_accrual_sales: number;
  accrual_items: any[];
  unassigned_card_payments: EnrichedPayment[];
  unhandled_payment_methods: Array<{payment: EnrichedPayment, method: string}>;
}
