"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCreateEmployeeCharge } from "@/hooks/use-create-employee-charge";
import {
    ChargeType,
    ChargePaymentMethod,
    DiscountType,
    CHARGE_TYPE_LABELS,
    CHARGE_TYPE_ICONS,
    PAYMENT_METHOD_LABELS,
    PAYMENT_METHOD_ICONS,
    DISCOUNT_TYPE_LABELS,
    CreateEmployeeChargeData,
    calculateChargeTotal,
} from "@/types/employee-charges";
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
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus, Percent, Tag } from "lucide-react";

interface EmployeeOption {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
}

interface EmployeeChargeModalProps {
    open: boolean;
    onClose: () => void;
    sessionId: string;
    registeredByEmployeeId: string;
    onSuccess?: () => void;
}

export function EmployeeChargeModal({
    open,
    onClose,
    sessionId,
    registeredByEmployeeId,
    onSuccess,
}: EmployeeChargeModalProps) {
    const { createCharge, loading } = useCreateEmployeeCharge();

    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    const [formData, setFormData] = useState({
        charged_to: "",
        charge_type: "" as ChargeType | "",
        description: "",
        unit_price: "",
        quantity: "1",
        payment_method: "CASH" as ChargePaymentMethod,
        notes: "",
    });

    const [hasDiscount, setHasDiscount] = useState(false);
    const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
    const [discountValue, setDiscountValue] = useState("");

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Fetch active employees when modal opens
    useEffect(() => {
        if (!open) return;
        const fetchEmployees = async () => {
            setLoadingEmployees(true);
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from("employees")
                    .select("id, first_name, last_name, role")
                    .eq("is_active", true)
                    .order("first_name");

                if (!error && data) {
                    setEmployees(data);
                }
            } catch (e) {
                console.error("Error fetching employees:", e);
            } finally {
                setLoadingEmployees(false);
            }
        };
        fetchEmployees();
    }, [open]);

    // Calculate preview
    const unitPrice = parseFloat(formData.unit_price) || 0;
    const quantity = parseInt(formData.quantity) || 1;
    const discVal = parseFloat(discountValue) || 0;
    const effectiveDiscountType = hasDiscount ? discountType : null;

    const { subtotal, discountAmount, total } = calculateChargeTotal(
        unitPrice,
        quantity,
        effectiveDiscountType,
        effectiveDiscountType === "FULL" ? 100 : discVal
    );

    // When discount type is FULL (courtesy), auto-set payment method
    useEffect(() => {
        if (hasDiscount && discountType === "FULL") {
            setFormData((prev) => ({ ...prev, payment_method: "COURTESY" }));
        }
    }, [hasDiscount, discountType]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.charged_to) {
            newErrors.charged_to = "Selecciona un empleado";
        }
        if (!formData.charge_type) {
            newErrors.charge_type = "Selecciona el tipo de cargo";
        }
        if (!formData.description.trim()) {
            newErrors.description = "La descripción es obligatoria";
        }
        if (!formData.unit_price || unitPrice <= 0) {
            newErrors.unit_price = "Ingresa un precio válido mayor a 0";
        }
        if (quantity <= 0) {
            newErrors.quantity = "La cantidad debe ser mayor a 0";
        }
        if (hasDiscount && discountType !== "FULL") {
            if (!discountValue || discVal <= 0) {
                newErrors.discount_value = "Ingresa un valor de descuento válido";
            }
            if (discountType === "PERCENTAGE" && discVal > 100) {
                newErrors.discount_value = "El porcentaje no puede ser mayor a 100%";
            }
            if (discountType === "FIXED_AMOUNT" && discVal > subtotal) {
                newErrors.discount_value = `El descuento no puede ser mayor al subtotal ($${subtotal.toFixed(2)})`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        if (!validate()) return;

        const chargeData: CreateEmployeeChargeData = {
            shift_session_id: sessionId,
            registered_by: registeredByEmployeeId,
            charged_to: formData.charged_to,
            charge_type: formData.charge_type as ChargeType,
            description: formData.description,
            unit_price: unitPrice,
            quantity,
            discount_type: hasDiscount ? discountType : undefined,
            discount_value: hasDiscount
                ? discountType === "FULL"
                    ? 100
                    : discVal
                : undefined,
            payment_method: formData.payment_method,
            notes: formData.notes || undefined,
        };

        const result = await createCharge(chargeData);

        if (result) {
            resetForm();
            onSuccess?.();
            onClose();
        }
    };

    const resetForm = () => {
        setFormData({
            charged_to: "",
            charge_type: "",
            description: "",
            unit_price: "",
            quantity: "1",
            payment_method: "CASH",
            notes: "",
        });
        setHasDiscount(false);
        setDiscountType("PERCENTAGE");
        setDiscountValue("");
        setErrors({});
    };

    const handleClose = () => {
        if (!loading) {
            resetForm();
            onClose();
        }
    };

    const getRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
            admin: "Admin",
            manager: "Gerente",
            receptionist: "Recepcionista",
            cochero: "Cochero",
            camarista: "Camarista",
            mantenimiento: "Mantenimiento",
            gerente: "Gerente",
        };
        return labels[role] || role;
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="w-[95vw] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Cargo a Empleado
                    </DialogTitle>
                    <DialogDescription>
                        Registra un consumo o cargo interno a un empleado
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Empleado */}
                    <div className="space-y-2">
                        <Label htmlFor="charged_to">
                            Empleado <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={formData.charged_to}
                            onValueChange={(value) =>
                                setFormData({ ...formData, charged_to: value })
                            }
                            disabled={loadingEmployees}
                        >
                            <SelectTrigger id="charged_to">
                                <SelectValue
                                    placeholder={
                                        loadingEmployees
                                            ? "Cargando empleados..."
                                            : "Selecciona el empleado"
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map((emp) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                        <span className="flex items-center gap-2">
                                            <span>
                                                {emp.first_name} {emp.last_name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                ({getRoleLabel(emp.role)})
                                            </span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.charged_to && (
                            <p className="text-sm text-red-500">{errors.charged_to}</p>
                        )}
                    </div>

                    {/* Tipo de Cargo */}
                    <div className="space-y-2">
                        <Label htmlFor="charge_type">
                            Tipo de Cargo <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={formData.charge_type}
                            onValueChange={(value) =>
                                setFormData({ ...formData, charge_type: value as ChargeType })
                            }
                        >
                            <SelectTrigger id="charge_type">
                                <SelectValue placeholder="Selecciona el tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(CHARGE_TYPE_LABELS).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-2">
                                            <span>{CHARGE_TYPE_ICONS[key as ChargeType]}</span>
                                            <span>{label}</span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.charge_type && (
                            <p className="text-sm text-red-500">{errors.charge_type}</p>
                        )}
                    </div>

                    {/* Descripción */}
                    <div className="space-y-2">
                        <Label htmlFor="charge_description">
                            Descripción <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="charge_description"
                            placeholder="Ej: 2 huevos rancheros + café"
                            rows={2}
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                        />
                        {errors.description && (
                            <p className="text-sm text-red-500">{errors.description}</p>
                        )}
                    </div>

                    {/* Precio y Cantidad */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="unit_price">
                                Precio Unitario <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    $
                                </span>
                                <Input
                                    id="unit_price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="pl-7"
                                    value={formData.unit_price}
                                    onChange={(e) =>
                                        setFormData({ ...formData, unit_price: e.target.value })
                                    }
                                />
                            </div>
                            {errors.unit_price && (
                                <p className="text-sm text-red-500">{errors.unit_price}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quantity">Cantidad</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="1"
                                value={formData.quantity}
                                onChange={(e) =>
                                    setFormData({ ...formData, quantity: e.target.value })
                                }
                            />
                            {errors.quantity && (
                                <p className="text-sm text-red-500">{errors.quantity}</p>
                            )}
                        </div>
                    </div>

                    {/* Subtotal preview */}
                    {subtotal > 0 && (
                        <div className="rounded-lg bg-muted/50 px-3 py-2 flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Subtotal:</span>
                            <span className="font-medium">${subtotal.toFixed(2)}</span>
                        </div>
                    )}

                    {/* Descuento */}
                    <div className="space-y-3 rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                            <Label
                                htmlFor="discount-toggle"
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <Tag className="h-4 w-4" />
                                <span>Aplicar Descuento</span>
                            </Label>
                            <Switch
                                id="discount-toggle"
                                checked={hasDiscount}
                                onCheckedChange={(checked) => {
                                    setHasDiscount(checked);
                                    if (!checked) {
                                        setDiscountValue("");
                                        setDiscountType("PERCENTAGE");
                                    }
                                }}
                            />
                        </div>

                        {hasDiscount && (
                            <div className="space-y-3 pt-2 border-t">
                                {/* Tipo de descuento */}
                                <div className="space-y-2">
                                    <Label>Tipo de descuento</Label>
                                    <Select
                                        value={discountType}
                                        onValueChange={(value) => {
                                            setDiscountType(value as DiscountType);
                                            if (value === "FULL") {
                                                setDiscountValue("100");
                                            } else {
                                                setDiscountValue("");
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(DISCOUNT_TYPE_LABELS).map(
                                                ([key, label]) => (
                                                    <SelectItem key={key} value={key}>
                                                        {label}
                                                    </SelectItem>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Valor del descuento (no se muestra para FULL) */}
                                {discountType !== "FULL" && (
                                    <div className="space-y-2">
                                        <Label htmlFor="discount_value">
                                            {discountType === "PERCENTAGE"
                                                ? "Porcentaje (%)"
                                                : "Monto ($)"}
                                        </Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                {discountType === "PERCENTAGE" ? (
                                                    <Percent className="h-4 w-4" />
                                                ) : (
                                                    "$"
                                                )}
                                            </span>
                                            <Input
                                                id="discount_value"
                                                type="number"
                                                step={discountType === "PERCENTAGE" ? "1" : "0.01"}
                                                min="0"
                                                max={discountType === "PERCENTAGE" ? "100" : undefined}
                                                placeholder="0"
                                                className="pl-9"
                                                value={discountValue}
                                                onChange={(e) => setDiscountValue(e.target.value)}
                                            />
                                        </div>
                                        {errors.discount_value && (
                                            <p className="text-sm text-red-500">
                                                {errors.discount_value}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Discount preview */}
                                {discountAmount > 0 && (
                                    <div className="rounded-lg bg-green-500/10 px-3 py-2 flex justify-between items-center">
                                        <span className="text-sm text-green-600">Descuento:</span>
                                        <span className="font-medium text-green-600">
                                            -${discountAmount.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Forma de Pago */}
                    <div className="space-y-2">
                        <Label htmlFor="payment_method">Forma de Pago</Label>
                        <Select
                            value={formData.payment_method}
                            onValueChange={(value) =>
                                setFormData({
                                    ...formData,
                                    payment_method: value as ChargePaymentMethod,
                                })
                            }
                            disabled={hasDiscount && discountType === "FULL"}
                        >
                            <SelectTrigger id="payment_method">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-2">
                                            <span>
                                                {PAYMENT_METHOD_ICONS[key as ChargePaymentMethod]}
                                            </span>
                                            <span>{label}</span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Notas */}
                    <div className="space-y-2">
                        <Label htmlFor="charge_notes">Notas (opcional)</Label>
                        <Textarea
                            id="charge_notes"
                            placeholder="Información adicional..."
                            rows={2}
                            value={formData.notes}
                            onChange={(e) =>
                                setFormData({ ...formData, notes: e.target.value })
                            }
                        />
                    </div>

                    {/* Total Preview */}
                    <div className="rounded-lg bg-muted p-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Total a cobrar:</span>
                            <span
                                className={`text-xl font-bold ${
                                    total === 0
                                        ? "text-green-600"
                                        : "text-blue-600"
                                }`}
                            >
                                {total === 0 ? "CORTESÍA" : `$${total.toFixed(2)}`}
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
                                "Registrar Cargo"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
