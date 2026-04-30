import { Button } from "@/components/ui/button";
import { Download, Printer, ChevronDown, FileText, Receipt } from "lucide-react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface IncomeReportHeaderProps {
    reportType: "shift" | "dateRange";
    shiftInfo: any;
    onExport: () => void;
    onPrintHp: () => void;
    onPrintBrowser: () => void;
}

export function IncomeReportHeader({
    reportType,
    shiftInfo,
    onExport,
    onPrintHp,
    onPrintBrowser
}: IncomeReportHeaderProps) {
    return (
        <div className="flex justify-between items-center no-print">
            <div>
                <h2 className="text-2xl font-bold">Corte de Caja</h2>
                <p className="text-sm text-muted-foreground">
                    {reportType === "shift" && shiftInfo ? (
                        <>Turno de {shiftInfo.employee_name || "N/A"} - {new Date(shiftInfo.shift_start).toLocaleDateString()}</>
                    ) : (
                        <>Hospedaje y Consumo Público</>
                    )}
                </p>
            </div>
            <div className="flex gap-2">
                <Button onClick={onExport} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="sm">
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir
                            <ChevronDown className="h-3 w-3 ml-1.5 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={onPrintHp} className="cursor-pointer">
                            <FileText className="h-4 w-4 mr-2 text-blue-500" />
                            Hoja HP (directo)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onPrintBrowser} className="cursor-pointer">
                            <Receipt className="h-4 w-4 mr-2 text-orange-500" />
                            Vista previa (navegador)
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
