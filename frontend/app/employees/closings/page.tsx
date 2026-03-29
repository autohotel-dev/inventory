import { ShiftClosingHistory } from "@/components/employees/shift-closing";
import { PendingClosingsIndicator } from "@/components/employees/pending-closings-indicator";

export default function ClosingsPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Historial de Cortes</h1>
        <p className="text-muted-foreground">
          Consulta el historial de cortes de caja por turno
        </p>
      </div>

      {/* Indicador de cortes pendientes */}
      <div className="mb-6">
        <PendingClosingsIndicator />
      </div>

      {/* Historial de cortes completados */}
      <ShiftClosingHistory />
    </div>
  );
}
