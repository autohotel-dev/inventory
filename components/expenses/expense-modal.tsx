"use client";

import { useState } from "react";
import { useCreateExpense } from "@/hooks/use-create-expense";
import {
    ExpenseType,
    EXPENSE_TYPE_LABELS,
    EXPENSE_TYPE_ICONS,
    CreateExpenseData,
} from "@/types/expenses";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Wallet } from "lucide-react";

interface ExpenseModalProps {
    open: boolean;
    onClose: () => void;
    sessionId: string;
    employeeId: string;
    availableCash: number;
    onSuccess?: () => void;
}

export function ExpenseModal({
    open,
    onClose,
    sessionId,
    employeeId,
    availableCash,
    onSuccess
}: ExpenseModalProps) {
    const { createExpense, loading } = useCreateExpense();

    const [formData, setFormData] = useState({
        expense_type: '' as ExpenseType | '',
        description: '',
        amount: '',
        recipient: '',
        receipt_number: '',
        notes: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.expense_type) {
            newErrors.expense_type = 'Selecciona un tipo de gasto';
        }

        if (!formData.description.trim()) {
            newErrors.description = 'La descripción es obligatoria';
        }

        const amount = parseFloat(formData.amount);
        if (!formData.amount || isNaN(amount) || amount <= 0) {
            newErrors.amount = 'Ingresa un monto válido mayor a 0';
        } else if (amount > availableCash) {
            newErrors.amount = `Monto excede efectivo disponible ($${availableCash.toFixed(2)})`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        const expenseData: CreateExpenseData = {
            shift_session_id: sessionId,
            employee_id: employeeId,
            expense_type: formData.expense_type as ExpenseType,
            description: formData.description,
            amount: parseFloat(formData.amount),
            recipient: formData.recipient || undefined,
            receipt_number: formData.receipt_number || undefined,
            notes: formData.notes || undefined
        };

        const result = await createExpense(expenseData);

        if (result) {
            // Reset form
            setFormData({
                expense_type: '',
                description: '',
                amount: '',
                recipient: '',
                receipt_number: '',
                notes: ''
            });
            setErrors({});
            onSuccess?.();
            onClose();
        }
    };

    const handleClose = () => {
        if (!loading) {
            setFormData({
                expense_type: '',
                description: '',
                amount: '',
                recipient: '',
                receipt_number: '',
                notes: ''
            });
            setErrors({});
            onClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Registrar Gasto
                    </DialogTitle>
                    <DialogDescription>
                        Registra un gasto en efectivo del turno actual
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Tipo de Gasto */}
                    <div className="space-y-2">
                        <Label htmlFor="expense_type">
                            Tipo de Gasto <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={formData.expense_type}
                            onValueChange={(value) =>
                                setFormData({ ...formData, expense_type: value as ExpenseType })
                            }
                        >
                            <SelectTrigger id="expense_type">
                                <SelectValue placeholder="Selecciona el tipo de gasto" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(EXPENSE_TYPE_LABELS).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-2">
                                            <span>{EXPENSE_TYPE_ICONS[key as ExpenseType]}</span>
                                            <span>{label}</span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.expense_type && (
                            <p className="text-sm text-red-500">{errors.expense_type}</p>
                        )}
                    </div>

                    {/* Monto */}
                    <div className="space-y-2">
                        <Label htmlFor="amount">
                            Monto <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                $
                            </span>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="pl-7"
                                value={formData.amount}
                                onChange={(e) =>
                                    setFormData({ ...formData, amount: e.target.value })
                                }
                            />
                        </div>
                        {errors.amount && (
                            <p className="text-sm text-red-500">{errors.amount}</p>
                        )}
                    </div>

                    {/* Descripción */}
                    <div className="space-y-2">
                        <Label htmlFor="description">
                            Descripción <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="description"
                            placeholder="Describe el gasto..."
                            rows={3}
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                        />
                        {errors.description && (
                            <p className="text-sm text-red-500">{errors.description}</p>
                        )}
                    </div>

                    {/* Destinatario (Opcional) */}
                    <div className="space-y-2">
                        <Label htmlFor="recipient">Destinatario (opcional)</Label>
                        <Input
                            id="recipient"
                            placeholder="Ej: Juan Pérez - Chofer"
                            value={formData.recipient}
                            onChange={(e) =>
                                setFormData({ ...formData, recipient: e.target.value })
                            }
                        />
                    </div>

                    {/* No. Recibo (Opcional) */}
                    <div className="space-y-2">
                        <Label htmlFor="receipt_number">No. Recibo (opcional)</Label>
                        <Input
                            id="receipt_number"
                            placeholder="Ej: REC-001"
                            value={formData.receipt_number}
                            onChange={(e) =>
                                setFormData({ ...formData, receipt_number: e.target.value })
                            }
                        />
                    </div>

                    {/* Notas (Opcional) */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas Adicionales (opcional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Información adicional..."
                            rows={2}
                            value={formData.notes}
                            onChange={(e) =>
                                setFormData({ ...formData, notes: e.target.value })
                            }
                        />
                    </div>

                    {/* Efectivo Disponible */}
                    <div className="rounded-lg bg-muted p-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Efectivo disponible:</span>
                            <span className="text-lg font-bold text-green-600">
                                ${availableCash.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Registrando...
                                </>
                            ) : (
                                'Registrar Gasto'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
