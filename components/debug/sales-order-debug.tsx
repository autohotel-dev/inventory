"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function SalesOrderDebug() {
  const [orderId, setOrderId] = useState("568bd994-94fb-4bd0-a589-a7b0ee0d96e7");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testOrder = async () => {
    setLoading(true);
    const supabase = createClient();
    
    try {
      console.log('🔍 Testing order ID:', orderId);
      
      // Test basic query
      const { data: basicData, error: basicError } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("id", orderId)
        .single();
      
      console.log('Basic query result:', { basicData, basicError });
      
      // Test with relations
      const { data: relatedData, error: relatedError } = await supabase
        .from("sales_orders")
        .select(`
          id,
          created_at,
          status,
          currency,
          subtotal,
          tax,
          total,
          notes,
          customer_id,
          warehouse_id,
          customers:customer_id(name, email, phone),
          warehouses:warehouse_id(code, name)
        `)
        .eq("id", orderId)
        .single();
      
      console.log('Related query result:', { relatedData, relatedError });
      
      // Test items
      const { data: itemsData, error: itemsError } = await supabase
        .from("sales_order_items")
        .select("*")
        .eq("sales_order_id", orderId);
      
      console.log('Items query result:', { itemsData, itemsError });
      
      setResult({
        basic: { data: basicData, error: basicError },
        related: { data: relatedData, error: relatedError },
        items: { data: itemsData, error: itemsError }
      });
      
    } catch (error) {
      console.error('Test error:', error);
      setResult({ error: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 overflow-auto z-50">
      <CardHeader>
        <CardTitle>Sales Order Debug</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Order ID"
          />
          <Button onClick={testOrder} disabled={loading} className="w-full">
            {loading ? "Testing..." : "Test Order"}
          </Button>
        </div>
        
        {result && (
          <div className="mt-4 text-xs">
            <div className="font-semibold">Results:</div>
            <pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded mt-2">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
