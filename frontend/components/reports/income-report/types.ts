export interface PaymentDetail {
    payment_method: string;
    amount: number;
    card_type?: string;
    card_last_4?: string;
    terminal_code?: string;
}

export interface ConsumptionDetail {
    product_name: string;
    qty: number;
    unit_price: number;
    total: number;
    created_at: string;
    delivery_status: string;
    accepted_by_name?: string;
    picked_up_by_name?: string;
    delivered_at?: string;
    payment_by_name?: string;
    payment_method?: string;
    payment_at?: string;
}

export interface ExtraDetail {
    concept_type: string;
    concept_label: string;
    qty: number;
    unit_price: number;
    total: number;
    created_at: string;
    registered_by_name?: string;
}

export interface DamageItem {
    id: string;
    created_at: string;
    time: string;
    room_number: string;
    reason: string;
    amount: number;
}

export interface IncomeEntry {
    no: number;
    time: string;
    vehicle_plate: string;
    room_number: string;
    room_price: number;
    extra: number;
    consumption: number;
    damage?: number;
    total: number;
    payment_method: string;
    card_type?: string;
    card_last_4?: string;
    terminal_code?: string;
    stay_status?: string;
    checkout_valet_name?: string;
    checkin_valet_name?: string;
    receptionist_name?: string;
    shift_name?: string;
    payments?: PaymentDetail[];
    consumption_details?: ConsumptionDetail[];
    extra_details?: ExtraDetail[];
    original_checkin_employee?: string;
    is_from_previous_shift?: boolean;
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
    damages?: number;
    total: number;
}
