"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProductSelectorWithScanner } from "@/components/product-selector-with-scanner";

interface ProductOption {
  value: string;
  label: string;
  price?: number | null;
  tax_rate?: number | null;
}

interface AddSalesItemFormProps {
  orderId: string;
  productOptions: ProductOption[];
  addItemAction: (formData: FormData) => Promise<void>;
}

export function AddSalesItemForm({ orderId, productOptions, addItemAction }: AddSalesItemFormProps) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");
  const [taxRate, setTaxRate] = useState("0");

  // Función para obtener el precio del producto seleccionado
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    
    // Buscar el producto seleccionado y autocompletar el precio
    const selectedProduct = productOptions.find(p => p.value === productId);
    if (selectedProduct) {
      if (selectedProduct.price !== null && selectedProduct.price !== undefined) {
        setUnitPrice(selectedProduct.price.toString());
      }
      // Por ahora no autocompletamos el impuesto hasta que tengamos la columna tax_rate
      // if (selectedProduct.tax_rate !== null && selectedProduct.tax_rate !== undefined) {
      //   setTaxRate(selectedProduct.tax_rate.toString());
      // }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
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
            <Input 
              id="tax" 
              name="tax" 
              type="number" 
              min="0" 
              step="0.01" 
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
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
