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
      <TabsList className="inline-flex h-auto p-1.5 bg-muted/50 backdrop-blur-sm border border-border/50 rounded-xl gap-1">
        <TabsTrigger
          value="overview"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
        >
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline font-medium">Resumen</span>
        </TabsTrigger>
        <TabsTrigger
          value="stays"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
        >
          <Hotel className="h-4 w-4" />
          <span className="hidden sm:inline font-medium">Estancias</span>
        </TabsTrigger>
        <TabsTrigger
          value="sales"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline font-medium">Ventas</span>
        </TabsTrigger>
        <TabsTrigger
          value="profitability"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
        >
          <Percent className="h-4 w-4" />
          <span className="hidden sm:inline font-medium">Rentabilidad</span>
        </TabsTrigger>
        <TabsTrigger
          value="stock"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="hidden sm:inline font-medium">Stock</span>
        </TabsTrigger>
      </TabsList>

      {/* Tab: Overview (Dashboard original) */}
      <TabsContent value="overview" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
        <AnalyticsDashboardOverview />
      </TabsContent>

      {/* Tab: Room Stays Report */}
      <TabsContent value="stays" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
        <RoomStaysReport />
      </TabsContent>

      {/* Tab: Sales Report */}
      <TabsContent value="sales" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
        <SalesReport />
      </TabsContent>

      {/* Tab: Profitability */}
      <TabsContent value="profitability" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
        <ProfitabilityReport />
      </TabsContent>

      {/* Tab: Stock Alerts */}
      <TabsContent value="stock" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
        <StockAlertsReport />
      </TabsContent>
    </Tabs>
  );
}

