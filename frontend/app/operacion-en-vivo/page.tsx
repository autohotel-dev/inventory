import { Metadata } from "next";
import { LiveOperationsBoard } from "@/components/live-operations/live-operations-board";

export const metadata: Metadata = {
  title: "Operación en Vivo | Luxor Manager",
  description: "Monitoreo granular de flujos y procesos operativos en tiempo real",
};

export default function LiveOperationsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl animate-in fade-in duration-500">
      <LiveOperationsBoard />
    </div>
  );
}
