"use client";

import { useState } from "react";
import {
    ExpenseType,
    EXPENSE_TYPE_LABELS,
    EXPENSE_TYPE_ICONS,
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
import { toast } from "sonner";

interface MockExpenseModalProps {
    open: boolean;
    onClose: () => void;
    availableCash: number; // Mocked usually
    onConfirm: (data: { amount: number; description: string; type: string }) => void;
}

export function MockExpenseModal({
    open,
    onClose,
    availableCash,
    onConfirm
}: MockExpenseModalProps) {
    const [loading, setLoading] = useState(false);

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
        }
        // En mock mode podemos relajar el cash check o simularlo

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);
        // Simular network
        await new Promise(r => setTimeout(r, 1000));

        const amount = parseFloat(formData.amount);

        onConfirm({
            amount,
            description: formData.description,
            type: formData.expense_type
        });

        toast.success(`Gasto registrado: $${amount.toFixed(2)}`);

        // Reset form
        setFormData({
            expense_type: '',
            description: '',
            amount: '',
            recipient: '',
            receipt_number: '',
            notes: ''
        });
        setLoading(false);
        onClose();
    };

    const handleClose = () => {
        if (!loading) {
            setLoading(false);
            onClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Registrar Gasto (Simulado)
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

                    {/* Efectivo Disponible Simulado */}
                    <div className="rounded-lg bg-muted p-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Efectivo disponible (Simulado):</span>
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
                                'Registrar'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
