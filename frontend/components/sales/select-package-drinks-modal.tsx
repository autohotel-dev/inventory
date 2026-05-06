"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
    Wine,
    GlassWater,
    Search,
    Check,
    Plus,
    Minus,
    Loader2,
    Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
    id: string;
    name: string;
    sku: string;
    price: number;
    barcode?: string | null;
}

interface SelectedDrink {
    product: Product;
    qty: number;
}

interface SelectPackageDrinksModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (drinks: SelectedDrink[]) => void;
    bottleProduct: Product;
    includedCategoryId: string;
    requiredQuantity: number;
    categoryName: string; // "Refrescos" or "Jugos"
}

export function SelectPackageDrinksModal({
    isOpen,
    onClose,
    onConfirm,
    bottleProduct,
    includedCategoryId,
    requiredQuantity,
    categoryName,
}: SelectPackageDrinksModalProps) {
    const toast = useToast();
    const [drinks, setDrinks] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDrinks, setSelectedDrinks] = useState<Map<string, SelectedDrink>>(new Map());

    const totalSelected = useMemo(() => {
        let total = 0;
        selectedDrinks.forEach((drink) => {
            total += drink.qty;
        });
        return total;
    }, [selectedDrinks]);

    const remaining = requiredQuantity - totalSelected;
    const canConfirm = totalSelected === requiredQuantity;

    // Fetch available drinks from included category
    useEffect(() => {
        if (!isOpen) return;

        const fetchDrinks = async () => {
            setLoading(true);
            const supabase = createClient();

            const { data, error } = await supabase
                .from("products")
                .select("id, name, sku, price, barcode")
                
                
                ;

            if (error) {
                console.error("Error fetching drinks:", error);
                toast.error("Error", "No se pudieron cargar las bebidas disponibles");
            } else {
                setDrinks(data || []);
            }
            setLoading(false);
        };

        fetchDrinks();
        // Reset selection when modal opens
        setSelectedDrinks(new Map());
        setSearchTerm("");
    }, [isOpen, includedCategoryId]);

    const filteredDrinks = useMemo(() => {
        if (!searchTerm) return drinks;
        const term = searchTerm.toLowerCase();
        return drinks.filter(
            (d) =>
                d.name.toLowerCase().includes(term) ||
                d.sku.toLowerCase().includes(term) ||
                d.barcode?.toLowerCase().includes(term)
        );
    }, [drinks, searchTerm]);

    const addDrink = (product: Product) => {
        if (totalSelected >= requiredQuantity) return;

        setSelectedDrinks((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(product.id);
            if (existing) {
                newMap.set(product.id, { ...existing, qty: existing.qty + 1 });
            } else {
                newMap.set(product.id, { product, qty: 1 });
            }
            return newMap;
        });
    };

    const removeDrink = (productId: string) => {
        setSelectedDrinks((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(productId);
            if (existing && existing.qty > 1) {
                newMap.set(productId, { ...existing, qty: existing.qty - 1 });
            } else {
                newMap.delete(productId);
            }
            return newMap;
        });
    };

    const handleConfirm = () => {
        if (!canConfirm) {
            toast.error(
                "Selección incompleta",
                `Debes seleccionar exactamente ${requiredQuantity} ${categoryName.toLowerCase()}`
            );
            return;
        }

        const drinksArray = Array.from(selectedDrinks.values());
        onConfirm(drinksArray);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                            <Wine className="h-5 w-5" />
                        </div>
                        Seleccionar {categoryName} Incluidos
                    </DialogTitle>
                    <DialogDescription>
                        <span className="font-medium text-foreground">{bottleProduct.name}</span> incluye{" "}
                        <span className="font-bold text-cyan-500">{requiredQuantity} {categoryName.toLowerCase()}</span> sin costo adicional
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Progress indicator */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                                Seleccionados: {totalSelected} / {requiredQuantity}
                            </span>
                            {remaining > 0 && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    Faltan {remaining}
                                </Badge>
                            )}
                            {remaining === 0 && (
                                <Badge className="bg-green-500">
                                    <Check className="h-3 w-3 mr-1" /> Completo
                                </Badge>
                            )}
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                            <div
                                className={cn(
                                    "h-2 rounded-full transition-all duration-300",
                                    canConfirm ? "bg-green-500" : "bg-cyan-500"
                                )}
                                style={{ width: `${Math.min((totalSelected / requiredQuantity) * 100, 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={`Buscar ${categoryName.toLowerCase()}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Selected drinks summary */}
                    {selectedDrinks.size > 0 && (
                        <div className="mb-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                            <p className="text-sm font-medium mb-2 text-cyan-600 dark:text-cyan-400 flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Tu selección:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(selectedDrinks.values()).map(({ product, qty }) => (
                                    <Badge
                                        key={product.id}
                                        variant="secondary"
                                        className="gap-1 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30"
                                        onClick={() => removeDrink(product.id)}
                                    >
                                        {product.name} x{qty}
                                        <Minus className="h-3 w-3 ml-1" />
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Drinks grid */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredDrinks.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <GlassWater className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No se encontraron {categoryName.toLowerCase()}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {filteredDrinks.map((drink) => {
                                    const selected = selectedDrinks.get(drink.id);
                                    const qty = selected?.qty || 0;
                                    const isDisabled = totalSelected >= requiredQuantity && qty === 0;

                                    return (
                                        <div
                                            key={drink.id}
                                            role="button"
                                            tabIndex={isDisabled ? -1 : 0}
                                            onClick={() => !isDisabled && addDrink(drink)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    if (!isDisabled) addDrink(drink);
                                                }
                                            }}
                                            className={cn(
                                                "relative p-3 rounded-lg border text-left transition-all select-none",
                                                qty > 0
                                                    ? "border-cyan-500 bg-cyan-500/10"
                                                    : "border-border hover:border-cyan-500/50 hover:bg-muted/50 cursor-pointer",
                                                isDisabled && "opacity-50 cursor-not-allowed pointer-events-none"
                                            )}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">{drink.name}</p>
                                                    <p className="text-xs text-muted-foreground">{drink.sku}</p>
                                                </div>
                                                {qty > 0 && (
                                                    <Badge className="bg-cyan-500 ml-2 shrink-0">x{qty}</Badge>
                                                )}
                                            </div>
                                            {qty > 0 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeDrink(drink.id);
                                                    }}
                                                    className="absolute -top-1 -right-1 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-sm z-10"
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        className="gap-2"
                    >
                        <Check className="h-4 w-4" />
                        Confirmar Selección
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
