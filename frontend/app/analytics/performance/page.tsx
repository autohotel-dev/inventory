import { DetailedPerformanceDashboard } from "@/components/analytics/detailed-performance-dashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tiempos y Rendimiento - Nexos POS",
  description: "Análisis detallado de tiempos de respuesta de Cocheros, Recepción y Camaristas.",
};

export default function DetailedPerformancePage() {
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6 min-h-screen pb-24">
      <DetailedPerformanceDashboard />
    </div>
  );
}
