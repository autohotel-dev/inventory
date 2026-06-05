"use client";

import {
    EmployeeCharge,
    CHARGE_TYPE_LABELS,
    CHARGE_TYPE_ICONS,
    PAYMENT_METHOD_LABELS,
    PAYMENT_METHOD_ICONS,
    ChargeType,
    ChargePaymentMethod,
} from "@/types/employee-charges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { UserPlus, Tag } from "lucide-react";

interface EmployeeChargesListProps {
    charges: EmployeeCharge[];
    totalCharges: number;
    totalDiscount: number;
    loading?: boolean;
}

export function EmployeeChargesList({
    charges,
    totalCharges,
    totalDiscount,
    loading,
}: EmployeeChargesListProps) {
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Cargos a Empleados
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Cargando cargos...
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (!charges || charges.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Cargos a Empleados
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No se han registrado cargos a empleados en este turno
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Cargos a Empleados
                    </span>
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                        {charges.length}{" "}
                        {charges.length === 1 ? "cargo" : "cargos"}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {charges.map((charge) => {
                    const employeeName = charge.charged_employee
                        ? `${charge.charged_employee.first_name} ${charge.charged_employee.last_name}`
                        : "Empleado";

                    return (
                        <div
                            key={charge.id}
                            className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg">
                                        {CHARGE_TYPE_ICONS[charge.charge_type as ChargeType]}
                                    </span>
                                    <p className="font-medium text-sm truncate">
                                        {charge.description}
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                        {CHARGE_TYPE_LABELS[charge.charge_type as ChargeType]}
                                        {" • "}
                                        <span className="font-medium">{employeeName}</span>
                                    </p>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px] px-1.5 py-0"
                                        >
                                            {PAYMENT_METHOD_ICONS[charge.payment_method as ChargePaymentMethod]}{" "}
                                            {PAYMENT_METHOD_LABELS[charge.payment_method as ChargePaymentMethod]}
                                        </Badge>

                                        {charge.discount_amount > 0 && (
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                            >
                                                <Tag className="h-2.5 w-2.5 mr-1" />
                                                -${Number(charge.discount_amount).toFixed(2)}
                                            </Badge>
                                        )}
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(charge.created_at), {
                                            addSuffix: true,
                                            locale: es,
                                        })}
                                    </p>
                                </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                                {charge.discount_amount > 0 && (
                                    <p className="text-xs text-muted-foreground line-through">
                                        ${Number(charge.subtotal).toFixed(2)}
                                    </p>
                                )}
                                <p
                                    className={`text-lg font-bold ${
                                        Number(charge.total) === 0
                                            ? "text-green-600"
                                            : "text-blue-600"
                                    }`}
                                >
                                    {Number(charge.total) === 0
                                        ? "Cortesía"
                                        : `$${Number(charge.total).toFixed(2)}`}
                                </p>
                                {charge.status === "pending" && (
                                    <Badge variant="secondary" className="text-xs mt-1">
                                        Pendiente
                                    </Badge>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Totals */}
                <div className="border-t pt-3 mt-3 space-y-1">
                    {totalDiscount > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                                Total Descuentos:
                            </span>
                            <span className="font-medium text-green-600">
                                -${totalDiscount.toFixed(2)}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <span className="font-semibold">Total Cargos:</span>
                        <span className="text-xl font-bold text-blue-600">
                            ${totalCharges.toFixed(2)}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
