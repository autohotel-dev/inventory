"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    ShoppingCart,
    Search,
    Plus,
    Minus,
    X,
    Loader2,
    Package,
    Trash2,
    Barcode,
    Check,
} from "lucide-react";
import { mockProducts } from "@/lib/training/mock-data";
import { cn } from "@/lib/utils";
import { usePOSConfigRead } from "@/hooks/use-pos-config";
import { useSoundFeedback } from "@/hooks/use-sound-feedback";

interface Product {
    id: string;
    name: string;
    sku?: string;
    price: number;
    barcode?: string;
}

interface CartItem {
    product: Product;
    qty: number;
}

interface MockAddConsumptionModalProps {
    isOpen: boolean;
    roomNumber?: string;
    onClose: () => void;
    onComplete: (products: { product: Product; qty: number }[], methods: { usedSearch: boolean; usedScan: boolean; usedEditQty: boolean; usedRemoveItem: boolean }) => void;
}

export function MockAddConsumptionModal({
    isOpen,
    roomNumber,
    onClose,
    onComplete,
}: MockAddConsumptionModalProps) {
    // Estados principales
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [cartItems, setCartItems] = useState<Map<string, CartItem>>(new Map());
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
    const [inputError, setInputError] = useState(false);
    const [selectedRow, setSelectedRow] = useState<number>(-1);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState<number>(1);

    // Tracking de métodos de entrada
    const [usedSearchMethod, setUsedSearchMethod] = useState(false);
    const [usedScanMethod, setUsedScanMethod] = useState(false);
    const [usedEditQty, setUsedEditQty] = useState(false);
    const [usedRemoveItem, setUsedRemoveItem] = useState(false);

    // Refs
    const inputRef = useRef<HTMLInputElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // Para detección de escaneo automático (sin Enter)
    const lastInputTimeRef = useRef<number>(0);
    const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const rapidInputRef = useRef<boolean>(false);

    // Configuración real desde hooks
    const posConfig = usePOSConfigRead();
    const { playSuccess, playError, playClick } = useSoundFeedback();

    const SCAN_SPEED_THRESHOLD = posConfig.scanSpeedThreshold;
    const SCAN_COMPLETE_DELAY = posConfig.scanCompleteDelay;
    const MIN_SCAN_LENGTH = posConfig.minScanLength;

    // Cargar productos mock al abrir
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setTimeout(() => {
                setProducts(mockProducts);
                setLoading(false);
            }, 300);
            setCartItems(new Map());
            setSearchValue("");
            setSelectedRow(-1);
            setEditingItemId(null);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Mantener focus en el input
    const ensureFocus = useCallback(() => {
        if (!editingItemId && isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [editingItemId, isOpen]);

    // Focus en input de edición
    useEffect(() => {
        if (editingItemId) {
            setTimeout(() => editInputRef.current?.focus(), 50);
        }
    }, [editingItemId]);

    // Limpiar animaciones
    useEffect(() => {
        if (lastAddedId) {
            const timer = setTimeout(() => setLastAddedId(null), 1000);
            return () => clearTimeout(timer);
        }
    }, [lastAddedId]);

    useEffect(() => {
        if (inputError) {
            const timer = setTimeout(() => setInputError(false), 500);
            return () => clearTimeout(timer);
        }
    }, [inputError]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'F2') {
                e.preventDefault();
                if (cartItems.size > 0 && !processing) {
                    processConsumption();
                }
            }

            if (e.key === 'Escape') {
                if (editingItemId) {
                    setEditingItemId(null);
                    ensureFocus();
                } else {
                    onClose();
                }
            }

            if (e.key === 'Delete' && selectedRow >= 0 && !editingItemId) {
                const items = Array.from(cartItems.values());
                if (items[selectedRow]) {
                    removeFromCart(items[selectedRow].product.id);
                }
            }

            if (e.key === 'ArrowDown' && !editingItemId) {
                e.preventDefault();
                setSelectedRow(prev => Math.min(prev + 1, cartItems.size - 1));
            }
            if (e.key === 'ArrowUp' && !editingItemId) {
                e.preventDefault();
                setSelectedRow(prev => Math.max(prev - 1, -1));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, cartItems, selectedRow, editingItemId, processing, ensureFocus, onClose]);

    // Buscar producto
    const findProduct = useCallback((code: string): Product | null => {
        const codeLower = code.toLowerCase().trim();

        const byBarcode = products.find(p =>
            p.barcode?.toLowerCase() === codeLower
        );
        if (byBarcode) return byBarcode;

        const bySku = products.find(p =>
            p.sku?.toLowerCase() === codeLower
        );
        if (bySku) return bySku;

        const byName = products.find(p =>
            p.name.toLowerCase().includes(codeLower)
        );
        if (byName) return byName;

        return null;
    }, [products]);

    // Procesar el código escaneado/buscado
    const processScannedCode = useCallback((code: string) => {
        const trimmedCode = code.trim();
        if (!trimmedCode || trimmedCode.length < MIN_SCAN_LENGTH) return;

        const product = findProduct(trimmedCode);

        if (product) {
            if (posConfig.soundEnabled) playSuccess();
            addToCart(product);
            setSearchValue("");
            setLastAddedId(product.id);
            setInputError(false);
            toast.success(`"${product.name}" agregado`, { duration: 1000 });

            // Marcar método usado
            if (rapidInputRef.current) {
                setUsedScanMethod(true);
            } else {
                setUsedSearchMethod(true);
            }
        } else {
            if (posConfig.soundEnabled) playError();
            setInputError(true);
            toast.error(`Producto "${trimmedCode}" no encontrado`);
        }

        rapidInputRef.current = false;
    }, [findProduct]);

    // Manejar cambio de input con detección de escaneo automático
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        const oldLength = searchValue.length;
        const now = Date.now();
        const timeSinceLastInput = now - lastInputTimeRef.current;

        setSearchValue(newValue);
        lastInputTimeRef.current = now;

        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
        }

        // Detectar entrada rápida (escritura rápida o escaneo con pistola)
        if (timeSinceLastInput < SCAN_SPEED_THRESHOLD && newValue.length > 1) {
            rapidInputRef.current = true;
        }

        // Detectar pegado: si el texto salta de 0-2 caracteres a MIN_SCAN_LENGTH o más
        const isPaste = oldLength <= 2 && newValue.length >= MIN_SCAN_LENGTH;
        if (isPaste) {
            rapidInputRef.current = true;
        }

        if (posConfig.autoScanDetection && rapidInputRef.current && newValue.length >= MIN_SCAN_LENGTH) {
            scanTimeoutRef.current = setTimeout(() => {
                if (rapidInputRef.current) {
                    processScannedCode(newValue);
                }
            }, SCAN_COMPLETE_DELAY);
        }
    };

    // Manejar búsqueda
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchValue.trim()) {
            if (posConfig.soundEnabled) playClick();
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
            processScannedCode(searchValue);
        }
    };

    // Limpiar timeouts al desmontar
    useEffect(() => {
        return () => {
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
        };
    }, []);

    const addToCart = (product: Product) => {
        setCartItems(prev => {
            const newCart = new Map(prev);
            const existing = newCart.get(product.id);
            if (existing) {
                newCart.set(product.id, { ...existing, qty: existing.qty + 1 });
            } else {
                newCart.set(product.id, { product, qty: 1 });
            }
            return newCart;
        });
    };

    const removeFromCart = (productId: string) => {
        setCartItems(prev => {
            const newCart = new Map(prev);
            newCart.delete(productId);
            return newCart;
        });
        setUsedRemoveItem(true);
        setSelectedRow(-1);
        ensureFocus();
    };

    const updateCartQty = (productId: string, qty: number) => {
        if (qty <= 0) {
            removeFromCart(productId);
        } else {
            setCartItems(prev => {
                const newCart = new Map(prev);
                const existing = newCart.get(productId);
                if (existing) {
                    newCart.set(productId, { ...existing, qty });
                }
                return newCart;
            });
            setUsedEditQty(true);
        }
    };

    const openEditQty = (item: CartItem) => {
        setEditingItemId(item.product.id);
        setEditQty(item.qty);
    };

    const confirmEditQty = () => {
        if (editingItemId) {
            updateCartQty(editingItemId, editQty);
            setEditingItemId(null);
            ensureFocus();
        }
    };

    const incrementQty = (productId: string) => {
        setCartItems(prev => {
            const newCart = new Map(prev);
            const existing = newCart.get(productId);
            if (existing) {
                newCart.set(productId, { ...existing, qty: existing.qty + 1 });
            }
            return newCart;
        });
    };

    const decrementQty = (productId: string) => {
        setCartItems(prev => {
            const newCart = new Map(prev);
            const existing = newCart.get(productId);
            if (existing && existing.qty > 1) {
                newCart.set(productId, { ...existing, qty: existing.qty - 1 });
            } else {
                newCart.delete(productId);
            }
            return newCart;
        });
    };

    const { totalAmount, totalItems } = useMemo(() => {
        let amount = 0;
        let items = 0;
        cartItems.forEach(({ product, qty }) => {
            amount += product.price * qty;
            items += qty;
        });
        return { totalAmount: amount, totalItems: items };
    }, [cartItems]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
        }).format(amount);
    };

    const processConsumption = () => {
        if (cartItems.size === 0) {
            toast.error("Agrega al menos un producto");
            return;
        }

        setProcessing(true);

        setTimeout(() => {
            const productNames = Array.from(cartItems.values())
                .map(({ product, qty }) => `${qty}x ${product.name}`)
                .join(", ");

            toast.success("✓ Consumo registrado (Simulado)", {
                description: `${productNames} - Total: ${formatCurrency(totalAmount)}`,
            });

            onComplete(Array.from(cartItems.values()), {
                usedSearch: usedSearchMethod,
                usedScan: usedScanMethod,
                usedEditQty: usedEditQty,
                usedRemoveItem: usedRemoveItem
            });
            setProcessing(false);
        }, 1000);
    };

    if (!isOpen) return null;

    const cartItemsArray = Array.from(cartItems.values());

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={ensureFocus}
        >
            <div
                className="bg-background border border-border rounded-xl shadow-2xl w-[95vw] sm:w-full sm:max-w-3xl mx-4 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <ShoppingCart className="h-6 w-6 text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">CONSUMO (Práctica)</h2>
                            {roomNumber && (
                                <p className="text-sm text-muted-foreground">Habitación {roomNumber}</p>
                            )}
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        disabled={processing}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Input de escaneo */}
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                    <div className="relative">
                        <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            value={searchValue}
                            onChange={handleInputChange}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Escanear código de barras o buscar producto..."
                            className={cn(
                                "pl-12 pr-12 h-14 text-lg font-medium transition-all",
                                "focus:ring-2 focus:ring-amber-500 focus:border-amber-500",
                                inputError && "animate-shake border-red-500"
                            )}
                            autoComplete="off"
                            autoFocus
                            disabled={loading}
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                        Modo práctica: Los productos no se guardarán realmente
                    </p>
                </div>

                {/* Tabla de carrito */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : cartItemsArray.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <Package className="h-16 w-16 mb-4 opacity-30" />
                            <p className="text-lg font-medium">Sin productos</p>
                            <p className="text-sm">Escanea o busca productos para agregar</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-muted/50 sticky top-0">
                                <tr className="text-left text-sm font-medium text-muted-foreground">
                                    <th className="px-6 py-3 w-12">#</th>
                                    <th className="px-6 py-3">Producto</th>
                                    <th className="px-6 py-3 text-right">Precio</th>
                                    <th className="px-6 py-3 text-center w-36">Cantidad</th>
                                    <th className="px-6 py-3 text-right">Subtotal</th>
                                    <th className="px-6 py-3 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {cartItemsArray.map((item, index) => (
                                    <tr
                                        key={item.product.id}
                                        className={cn(
                                            "border-b border-border/50 transition-all",
                                            selectedRow === index && "bg-amber-500/10",
                                            lastAddedId === item.product.id && "animate-pulse bg-amber-500/20"
                                        )}
                                        onClick={() => setSelectedRow(index)}
                                        onDoubleClick={() => openEditQty(item)}
                                    >
                                        <td className="px-6 py-4 text-muted-foreground">{index + 1}</td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium">{item.product.name}</p>
                                                <p className="text-xs text-muted-foreground">{item.product.sku || 'SKU-000'}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            {formatCurrency(item.product.price)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        decrementQty(item.product.id);
                                                    }}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-10 text-center font-bold text-lg">
                                                    {item.qty}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        incrementQty(item.product.id);
                                                    }}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-amber-600">
                                            {formatCurrency(item.product.price * item.qty)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:bg-destructive/20"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeFromCart(item.product.id);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border bg-muted/30 flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <Badge variant="secondary" className="text-sm px-3 py-1">
                            {totalItems} {totalItems === 1 ? 'producto' : 'productos'}
                        </Badge>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">TOTAL</p>
                            <p className="text-3xl font-bold text-amber-600">
                                {formatCurrency(totalAmount)}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={processing}
                            className="flex-1"
                        >
                            ← Cancelar
                        </Button>
                        <Button
                            onClick={processConsumption}
                            disabled={cartItems.size === 0 || processing}
                            className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white h-12 text-lg"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <Check className="h-5 w-5 mr-2" />
                                    REGISTRAR CONSUMO (F2)
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modal de edición de cantidad */}
            {editingItemId && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
                    onClick={() => {
                        setEditingItemId(null);
                        ensureFocus();
                    }}
                >
                    <div
                        className="bg-background border border-border rounded-xl shadow-2xl p-6 w-80"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold mb-4">Editar Cantidad</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {cartItems.get(editingItemId)?.product.name}
                        </p>
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-12 w-12"
                                onClick={() => setEditQty(prev => Math.max(1, prev - 1))}
                            >
                                <Minus className="h-5 w-5" />
                            </Button>
                            <Input
                                ref={editInputRef}
                                type="number"
                                value={editQty}
                                onChange={(e) => setEditQty(Math.max(0, parseInt(e.target.value) || 0))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmEditQty();
                                    if (e.key === 'Escape') {
                                        setEditingItemId(null);
                                        ensureFocus();
                                    }
                                }}
                                className="w-20 h-12 text-center text-2xl font-bold"
                                min={0}
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-12 w-12"
                                onClick={() => setEditQty(prev => prev + 1)}
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={() => {
                                    removeFromCart(editingItemId);
                                    setEditingItemId(null);
                                }}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={confirmEditQty}
                            >
                                Confirmar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
