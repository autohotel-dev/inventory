"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  ShoppingCart,
  Percent,
  AlertTriangle
} from "lucide-react";
import { SalesReport } from "./sales-report";
import { ProfitabilityReport } from "./profitability-report";
import { StockAlertsReport } from "./stock-alerts-report";
import { AnalyticsDashboardOverview } from "./analytics-dashboard-overview";

export function AnalyticsDashboard() {
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4 lg:w-auto">
        <TabsTrigger value="overview" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Resumen</span>
        </TabsTrigger>
        <TabsTrigger value="sales" className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Ventas</span>
        </TabsTrigger>
        <TabsTrigger value="profitability" className="flex items-center gap-2">
          <Percent className="h-4 w-4" />
          <span className="hidden sm:inline">Rentabilidad</span>
        </TabsTrigger>
        <TabsTrigger value="stock" className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="hidden sm:inline">Stock</span>
        </TabsTrigger>
      </TabsList>

      {/* Tab: Overview (Dashboard original) */}
      <TabsContent value="overview">
        <AnalyticsDashboardOverview />
      </TabsContent>

      {/* Tab: Sales Report */}
      <TabsContent value="sales">
        <SalesReport />
      </TabsContent>

      {/* Tab: Profitability */}
      <TabsContent value="profitability">
        <ProfitabilityReport />
      </TabsContent>

      {/* Tab: Stock Alerts */}
      <TabsContent value="stock">
        <StockAlertsReport />
      </TabsContent>
    </Tabs>
  );
}
