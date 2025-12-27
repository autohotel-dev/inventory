"use client";

import { ShiftExpense, EXPENSE_TYPE_LABELS, EXPENSE_TYPE_ICONS } from "@/types/expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Wallet, Receipt } from "lucide-react";

interface ExpensesListProps {
    expenses: ShiftExpense[];
    totalExpenses: number;
    loading?: boolean;
}

export function ExpensesList({ expenses, totalExpenses, loading }: ExpensesListProps) {
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Gastos del Turno
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Cargando gastos...</p>
                </CardContent>
            </Card>
        );
    }

    if (!expenses || expenses.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Gastos del Turno
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No se han registrado gastos en este turno
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
                        <Wallet className="h-5 w-5" />
                        Gastos del Turno
                    </span>
                    <Badge variant="outline" className="text-red-600 border-red-600">
                        {expenses.length} {expenses.length === 1 ? 'gasto' : 'gastos'}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {expenses.map((expense) => (
                    <div
                        key={expense.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">
                                    {EXPENSE_TYPE_ICONS[expense.expense_type]}
                                </span>
                                <p className="font-medium text-sm truncate">
                                    {expense.description}
                                </p>
                            </div>

                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                    {EXPENSE_TYPE_LABELS[expense.expense_type]}
                                    {expense.recipient && ` • ${expense.recipient}`}
                                </p>

                                {expense.receipt_number && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Receipt className="h-3 w-3" />
                                        Recibo: {expense.receipt_number}
                                    </p>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(expense.created_at), {
                                        addSuffix: true,
                                        locale: es
                                    })}
                                </p>
                            </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-red-600">
                                -${expense.amount.toFixed(2)}
                            </p>
                            {expense.status === 'pending' && (
                                <Badge variant="secondary" className="text-xs mt-1">
                                    Pendiente
                                </Badge>
                            )}
                        </div>
                    </div>
                ))}

                {/* Total */}
                <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold">Total Gastos:</span>
                        <span className="text-xl font-bold text-red-600">
                            -${totalExpenses.toFixed(2)}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
