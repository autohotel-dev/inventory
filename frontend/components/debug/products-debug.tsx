"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function ProductsDebug() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkProducts = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    
    try {
      // Verificar todos los productos
      const { data: allProducts, error: allError } = await supabase
        .from("products")
        .select("*")
        .limit(10);
      
      if (allError) throw allError;
      
      console.log('All products:', allProducts);
      setProducts(allProducts || []);
      
      // Verificar productos activos
      const { data: activeProducts, error: activeError } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .limit(10);
      
      if (activeError) throw activeError;
      
      console.log('Active products:', activeProducts);
      
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="fixed bottom-4 left-4 w-96 max-h-96 overflow-auto z-50">
      <CardHeader>
        <CardTitle>Products Debug</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={checkProducts} disabled={loading} className="mb-4">
          {loading ? "Checking..." : "Check Products"}
        </Button>
        
        {error && (
          <div className="text-red-500 text-sm mb-2">
            Error: {error}
          </div>
        )}
        
        <div className="text-sm">
          <strong>Total products found:</strong> {products.length}
        </div>
        
        {products.length > 0 && (
          <div className="mt-2 space-y-1">
            {products.slice(0, 5).map((product, index) => (
              <div key={index} className="text-xs border-b pb-1">
                <div><strong>Name:</strong> {product.name}</div>
                <div><strong>SKU:</strong> {product.sku}</div>
                <div><strong>Active:</strong> {product.is_active ? 'Yes' : 'No'}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
