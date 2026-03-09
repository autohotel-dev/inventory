"use client";

import { useState } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Scan } from "lucide-react";

interface ProductOption {
  value: string;
  label: string;
  price?: number | null;
  tax_rate?: number | null;
}

interface ProductSelectorWithScannerProps {
  id: string;
  name: string;
  options: ProductOption[];
  required?: boolean;
  className?: string;
  placeholder?: string;
  onProductSelect?: (productId: string) => void;
}

export function ProductSelectorWithScanner({
  id,
  name,
  options,
  required = false,
  className = "",
  placeholder = "Search product...",
  onProductSelect
}: ProductSelectorWithScannerProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");

  const handleScan = (scannedCode: string) => {
    // Buscar el producto por SKU en las opciones
    const foundProduct = options.find(option => 
      option.label.toLowerCase().includes(scannedCode.toLowerCase()) ||
      option.value === scannedCode
    );

    if (foundProduct) {
      setDefaultValue(foundProduct.value);
      if (onProductSelect) {
        onProductSelect(foundProduct.value);
      }
      
      // Forzar actualización del componente SearchableSelect
      setTimeout(() => {
        const selectElement = document.querySelector(`[name="${name}"]`) as HTMLSelectElement;
        if (selectElement) {
          selectElement.value = foundProduct.value;
          selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 100);
    } else {
      alert(`No se encontró un producto con el código: ${scannedCode}`);
    }
    
    setShowScanner(false);
  };

  return (
    <>
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchableSelect
            id={id}
            name={name}
            options={options}
            required={required}
            className={className}
            placeholder={placeholder}
            defaultValue={defaultValue}
            onChange={onProductSelect}
            key={defaultValue} // Forzar re-render cuando cambie defaultValue
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowScanner(true)}
          className="px-3"
        >
          <Scan className="h-4 w-4" />
        </Button>
      </div>

      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
