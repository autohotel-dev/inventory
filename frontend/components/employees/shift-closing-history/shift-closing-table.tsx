import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Receipt } from "lucide-react";
import { ShiftClosing, SHIFT_COLORS } from "../types";
import { formatCurrency } from "@/hooks/use-shift-closing-history";

interface ShiftClosingTableProps {
  closings: ShiftClosing[];
  openDetail: (closing: ShiftClosing) => void;
  exportClosing: (closing: ShiftClosing) => void;
}

const getStatusBadge = (status: ShiftClosing["status"]) => {
  const config = {
    pending: { label: "Pendiente", variant: "secondary" as const, icon: "⏳" },
    approved: { label: "Aprobado", variant: "default" as const, icon: "✓" },
    rejected: { label: "Rechazado", variant: "destructive" as const, icon: "✕" },
    reviewed: { label: "Revisado", variant: "outline" as const, icon: "👁" },
  };
  const { label, variant, icon } = config[status] || config.pending;
  return <Badge variant={variant}>{icon} {label}</Badge>;
};

export function ShiftClosingTable({ closings, openDetail, exportClosing }: ShiftClosingTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Empleado</TableHead>
            <TableHead>Turno</TableHead>
            <TableHead className="text-right">Efectivo</TableHead>
            <TableHead className="text-right">Tarjetas</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Diferencia</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {closings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No hay cortes registrados
              </TableCell>
            </TableRow>
          ) : (
            closings.map((closing) => (
              <TableRow key={closing.id} className="hover:bg-muted/50">
                <TableCell>
                  <div>
                    <p className="font-medium">{new Date(closing.period_start).toLocaleDateString("es-MX")}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(closing.period_start).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                      {" - "}
                      {new Date(closing.period_end).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {closing.employees?.first_name} {closing.employees?.last_name}
                </TableCell>
                <TableCell>
                  <Badge
                    className={`${SHIFT_COLORS[closing.shift_definitions?.code || ""] || "bg-gray-500"} text-white`}
                  >
                    {closing.shift_definitions?.name}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(closing.total_cash || 0)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency((closing.total_card_bbva || 0) + (closing.total_card_getnet || 0))}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(closing.total_sales)}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={`font-medium ${closing.cash_difference === 0
                      ? "text-green-600"
                      : (closing.cash_difference || 0) > 0
                        ? "text-blue-600"
                        : "text-red-600"
                      }`}
                  >
                    {closing.cash_difference === 0 ? "✓" : (closing.cash_difference || 0) > 0 ? "+" : ""}
                    {formatCurrency(closing.cash_difference || 0)}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(closing.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetail(closing)}
                      title="Ver detalle"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportClosing(closing)}
                      title="Imprimir"
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
