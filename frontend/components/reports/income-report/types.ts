export interface PaymentDetail {
    payment_method: string;
    amount: number;
    card_type?: string;
    card_last_4?: string;
    terminal_code?: string;
}

export interface IncomeEntry {
    no: number;
    time: string;
    vehicle_plate: string;
    room_number: string;
    room_price: number;
    extra: number;
    consumption: number;
    total: number;
    payment_method: string;
    card_type?: string;
    card_last_4?: string;
    terminal_code?: string;
    stay_status?: string;
    checkout_valet_name?: string;
    payments?: PaymentDetail[];
}

export interface IncomeReportProps {
    reportType: "shift" | "dateRange";
    shiftId?: string;
    startDate?: Date;
    endDate?: Date;
    paymentMethodFilter?: string;
    roomFilter?: string;
    statusFilter?: string;
    page?: number;
    pageSize?: number;
}

export interface IncomeTotals {
    roomPrice: number;
    extra: number;
    consumption: number;
    total: number;
}
