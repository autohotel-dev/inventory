"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function DataDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkTables = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const results: any = {};

    try {
      // Verificar tabla products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*")
        .limit(5);

      results.products = {
        data: products,
        error: productsError,
        count: products?.length || 0
      };

      // Verificar tabla categories
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .limit(5);

      results.categories = {
        data: categories,
        error: categoriesError,
        count: categories?.length || 0
      };

      // Verificar tabla suppliers
      const { data: suppliers, error: suppliersError } = await supabase
        .from("suppliers")
        .select("*")
        .limit(5);

      results.suppliers = {
        data: suppliers,
        error: suppliersError,
        count: suppliers?.length || 0
      };

      setDebugInfo(results);
    } catch (error) {
      console.error("Debug error:", error);
      setDebugInfo({ error: error });
    } finally {
      setIsLoading(false);
    }
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div>
      {/* <div className="fixed bottom-20 right-4 bg-card border rounded-lg p-4 text-xs max-w-md max-h-96 overflow-auto z-50">
        <h4 className="font-semibold mb-2">Database Debug</h4>

        <Button
          onClick={checkTables}
          disabled={isLoading}
          size="sm"
          className="mb-2"
        >
          {isLoading ? "Checking..." : "Check Tables"}
        </Button>

        {debugInfo && (
          <div className="space-y-2">
            <div>
              <strong>Products:</strong> {debugInfo.products?.count || 0} items
              {debugInfo.products?.error && (
                <div className="text-red-500 text-xs">
                  Error: {debugInfo.products.error.message}
                </div>
              )}
            </div>

            <div>
              <strong>Categories:</strong> {debugInfo.categories?.count || 0} items
              {debugInfo.categories?.error && (
                <div className="text-red-500 text-xs">
                  Error: {debugInfo.categories.error.message}
                </div>
              )}
            </div>

            <div>
              <strong>Suppliers:</strong> {debugInfo.suppliers?.count || 0} items
              {debugInfo.suppliers?.error && (
                <div className="text-red-500 text-xs">
                  Error: {debugInfo.suppliers.error.message}
                </div>
              )}
            </div>

            {debugInfo.products?.data && debugInfo.products.data.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer">Sample Products</summary>
                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                  {JSON.stringify(debugInfo.products.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div> */}
    </div>
  );
}
