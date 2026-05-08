import { Metadata } from "next";
import { HandoffBoard } from "./handoff-board";

export const metadata: Metadata = {
  title: "Bitácora de Pendientes | Luxor Manager",
  description: "Gestión de pendientes y handoff entre turnos de recepción",
};

export default function PendientesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] animate-in fade-in duration-500">
      <HandoffBoard />
    </div>
  );
}
