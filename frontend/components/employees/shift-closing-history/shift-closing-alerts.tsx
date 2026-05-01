import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftClosing } from "../types";

interface ShiftClosingAlertsProps {
  rejectedClosings: ShiftClosing[];
  isAdmin: boolean;
  openDetail: (closing: ShiftClosing) => void;
}

export function ShiftClosingAlerts({ rejectedClosings, isAdmin, openDetail }: ShiftClosingAlertsProps) {
  if (rejectedClosings.length === 0 || isAdmin) {
    return null;
  }

  return (
    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-red-500 mb-1">
            Tienes {rejectedClosings.length} corte(s) rechazado(s)
          </h4>
          <p className="text-sm text-muted-foreground">
            Por favor revisa los motivos de rechazo y realiza las correcciones necesarias.
            Haz clic en &quot;Ver&quot; para ver los detalles de cada corte rechazado.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {rejectedClosings.slice(0, 3).map((closing) => (
              <Button
                key={closing.id}
                variant="outline"
                size="sm"
                className="text-xs border-red-500/30 hover:bg-red-500/10"
                onClick={() => openDetail(closing)}
              >
                {new Date(closing.created_at).toLocaleDateString("es-MX")} - Ver detalles
              </Button>
            ))}
            {rejectedClosings.length > 3 && (
              <span className="text-xs text-muted-foreground self-center">
                y {rejectedClosings.length - 3} más...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
