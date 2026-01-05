"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  ShoppingCart,
  Percent,
  AlertTriangle,
  Hotel
} from "lucide-react";
import { SalesReport } from "./sales-report";
import { ProfitabilityReport } from "./profitability-report";
import { StockAlertsReport } from "./stock-alerts-report";
import { AnalyticsDashboardOverview } from "./analytics-dashboard-overview";
import { RoomStaysReport } from "./room-stays-report";

export function AnalyticsDashboard() {
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-5 lg:w-auto">
        <TabsTrigger value="overview" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Resumen</span>
        </TabsTrigger>
        <TabsTrigger value="stays" className="flex items-center gap-2">
          <Hotel className="h-4 w-4" />
          <span className="hidden sm:inline">Estancias</span>
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

      {/* Tab: Room Stays Report */}
      <TabsContent value="stays">
        <RoomStaysReport />
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
