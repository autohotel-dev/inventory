"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface TableCheckResult {
  data?: unknown[] | null;
  error?: { message: string } | null;
  count?: number | null;
  sample?: unknown;
}

type DatabaseResults = Record<string, TableCheckResult | unknown>;

export function DatabaseDebug() {
  const [results, setResults] = useState<DatabaseResults>({});
  const [loading, setLoading] = useState(false);

  const checkDatabase = async () => {
    setLoading(true);
    const supabase = createClient();
    const results: DatabaseResults = {};
    
    try {
      // Check products table
      const { data: products, error: productsError, count: productsCount } = await supabase
        .from("products")
        .select("*", { count: 'exact' })
        .limit(1);
      
      results.products = {
        data: products,
        error: productsError,
        count: productsCount,
        sample: products?.[0]
      };

      // Check purchase_orders table
      const { data: purchases, error: purchasesError, count: purchasesCount } = await supabase
        .from("purchase_orders")
        .select("*", { count: 'exact' })
        .limit(1);
      
      results.purchase_orders = {
        data: purchases,
        error: purchasesError,
        count: purchasesCount,
        sample: purchases?.[0]
      };

      // Check sales_orders table
      const { data: sales, error: salesError, count: salesCount } = await supabase
        .from("sales_orders")
        .select("*", { count: 'exact' })
        .limit(1);
      
      results.sales_orders = {
        data: sales,
        error: salesError,
        count: salesCount,
        sample: sales?.[0]
      };

      // Check suppliers table
      const { data: suppliers, error: suppliersError, count: suppliersCount } = await supabase
        .from("suppliers")
        .select("*", { count: 'exact' })
        .limit(1);
      
      results.suppliers = {
        data: suppliers,
        error: suppliersError,
        count: suppliersCount,
        sample: suppliers?.[0]
      };

      // Check warehouses table
      const { data: warehouses, error: warehousesError, count: warehousesCount } = await supabase
        .from("warehouses")
        .select("*", { count: 'exact' })
        .limit(1);
      
      results.warehouses = {
        data: warehouses,
        error: warehousesError,
        count: warehousesCount,
        sample: warehouses?.[0]
      };

      console.log('Database check results:', results);
      setResults(results);
      
    } catch (error) {
      console.error('Database check error:', error);
      results.error = error as unknown;
      setResults(results);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="fixed top-4 right-4 w-96 max-h-96 overflow-auto z-50">
      <CardHeader>
        <CardTitle>Database Debug</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={checkDatabase} disabled={loading} className="mb-4">
          {loading ? "Checking..." : "Check Database"}
        </Button>
        
        {Object.keys(results).length > 0 && (
          <div className="space-y-2 text-xs">
            {Object.entries(results).map(([table, info]) => {
              const tableInfo = info as TableCheckResult;
              return (
              <div key={table} className="border-b pb-2">
                <div className="font-semibold">{table}:</div>
                {tableInfo && 'error' in tableInfo && tableInfo.error ? (
                  <div className="text-red-500">Error: {(tableInfo.error as { message: string }).message}</div>
                ) : (
                  <div>
                    <div>Count: {tableInfo?.count !== undefined && tableInfo?.count !== null ? Number(tableInfo.count) : "N/A"}</div>
                    {!!(tableInfo as TableCheckResult)?.sample && (
                      <div className="text-gray-600">
                        Sample: {JSON.stringify(tableInfo.sample, null, 2).substring(0, 100)}...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
