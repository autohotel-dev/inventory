"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProductSelectorWithScanner } from "@/components/product-selector-with-scanner";

interface ProductOption {
  value: string;
  label: string;
}

interface AddSalesItemFormProps {
  orderId: string;
  productOptions: ProductOption[];
  addItemAction: (formData: FormData) => Promise<void>;
}

export function AddSalesItemForm({ orderId, productOptions, addItemAction }: AddSalesItemFormProps) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");

  // Función para obtener el precio del producto seleccionado
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    
    // Aquí podrías hacer una llamada para obtener el precio del producto
    // Por ahora, extraemos el precio del label si está disponible
    const selectedProduct = productOptions.find(p => p.value === productId);
    if (selectedProduct) {
      // Si el label contiene información de precio, la extraemos
      // Formato esperado: "SKU - Name (Price: XX.XX)"
      const priceMatch = selectedProduct.label.match(/Price:\s*(\d+\.?\d*)/);
      if (priceMatch) {
        setUnitPrice(priceMatch[1]);
      }
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <h3 className="text-lg font-semibold">Agregar Producto</h3>
      <form action={addItemAction} className="space-y-4">
        <input type="hidden" name="orderId" value={orderId} />
        
        {/* Producto - Fila completa */}
        <div className="space-y-1">
          <Label htmlFor="product_id">Producto</Label>
          <ProductSelectorWithScanner
            id="product_id"
            name="product_id"
            options={productOptions}
            required
            className="w-full"
            placeholder="Buscar producto o escanear..."
            onProductSelect={handleProductSelect}
          />
        </div>
        
        {/* Campos numéricos en grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="qty">Cantidad</Label>
            <Input id="qty" name="qty" type="number" min="0" step="0.01" defaultValue={1} required />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="unit_price">Precio Unitario</Label>
            <Input 
              id="unit_price" 
              name="unit_price" 
              type="number" 
              min="0" 
              step="0.01" 
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              required 
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="discount">Descuento</Label>
            <Input id="discount" name="discount" type="number" min="0" step="0.01" defaultValue={0} />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="tax">Impuesto</Label>
            <Input id="tax" name="tax" type="number" min="0" step="0.01" defaultValue={0} />
          </div>
        </div>
        
        {/* Botón */}
        <div className="pt-2">
          <SubmitButton pendingText="Agregando...">Agregar Producto</SubmitButton>
        </div>
      </form>
    </div>
  );
}
