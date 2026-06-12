// Shared printer types — no native dependencies
// Used by frontend API routes and the USB print server

export interface ConsumptionTicketData {
    roomNumber: string;
    folio: string;
    date: Date;
    items: Array<{
        name: string;
        qty: number;
        price: number;
        total: number;
    }>;
    subtotal: number;
    total: number;
    hotelName?: string;
}

export interface ClosingTicketData {
    employeeName: string;
    shiftName: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    totalCash: number;
    totalCardBBVA: number;
    totalCardGetnet: number;
    totalSales: number;
    totalTransactions: number;
    countedCash: number;
    cashDifference: number;
    notes?: string;
    transactions: Array<{
        time: string;
        amount: number;
        paymentMethod: string;
        terminalCode?: string;
        reference?: string;
        concept?: string;
        items?: Array<{
            name: string;
            qty: number;
            unitPrice: number;
            total: number;
        }>;
    }>;
    roomBreakdown?: Record<string, { count: number; total: number }>;
    extraBreakdown?: Record<string, { count: number; total: number }>;
    consumptionBreakdown?: Record<string, { count: number; total: number }>;
    damageBreakdown?: Record<string, { count: number; total: number }>;
    expenses?: Array<{
        time: string;
        type: string;
        description: string;
        amount: number;
        recipient?: string;
    }>;
    totalExpenses?: number;
    employeeCharges?: Array<{
        time: string;
        employeeName: string;
        chargeType: string;
        description: string;
        total: number;
        discountAmount: number;
        paymentMethod: string;
    }>;
    totalEmployeeCharges?: number;
}
