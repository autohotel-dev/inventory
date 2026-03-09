"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Scan } from "lucide-react";

interface ProductFormProps {
  action: (formData: FormData) => Promise<void>;
}

export function ProductForm({ action }: ProductFormProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [sku, setSku] = useState("");

  const handleScan = (scannedCode: string) => {
    setSku(scannedCode);
    setShowScanner(false);
  };

  return (
    <>
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <div className="flex gap-2">
            <Input 
              id="sku" 
              name="sku" 
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Código de barras del producto"
              required 
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowScanner(true)}
              className="px-3"
            >
              <Scan className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Ingresa manualmente o usa el botón de escáner para leer el código de barras
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Precio</Label>
            <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_stock">Stock Mínimo</Label>
            <Input id="min_stock" name="min_stock" type="number" step="1" min="0" defaultValue={0} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input id="is_active" name="is_active" type="checkbox" defaultChecked />
          <Label htmlFor="is_active">Activo</Label>
        </div>

        <div className="flex gap-3">
          <SubmitButton pendingText="Creando...">Crear Producto</SubmitButton>
        </div>
      </form>

      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
