import { Filter, Receipt, ArrowDownCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ShiftClosingFiltersProps {
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  setCurrentPage: (page: number) => void;
  totalCount: number;
  currentPage: number;
}

export function ShiftClosingFilters({
  statusFilter,
  setStatusFilter,
  pageSize,
  setPageSize,
  setCurrentPage,
  totalCount,
  currentPage
}: ShiftClosingFiltersProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap justify-between">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Estado */}
        <div className={`relative p-3 rounded-xl border transition-all duration-300 ${statusFilter !== 'all' ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-muted/30 border-border/50 hover:border-blue-500/30 hover:bg-blue-500/5'}`}>
          <label className="flex items-center gap-2 text-xs font-medium mb-2">
            <div className={`p-1 rounded-md ${statusFilter !== 'all' ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
              <Filter className="h-3 w-3" />
            </div>
            <span className={statusFilter !== 'all' ? 'text-blue-400' : 'text-muted-foreground'}>Estado</span>
          </label>
          <div className="relative group">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-3 pr-8 py-2 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none hover:bg-background shadow-sm min-w-[130px]"
            >
              <option value="all">✨ Todos</option>
              <option value="pending">⏳ Pendientes</option>
              <option value="approved">✅ Aprobados</option>
              <option value="rejected">❌ Rechazados</option>
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
              <ArrowDownCircle className={`h-3.5 w-3.5 ${statusFilter !== 'all' ? 'text-blue-500' : 'text-muted-foreground'}`} />
            </div>
          </div>
        </div>

        {/* Mostrar */}
        <div className={`relative p-3 rounded-xl border transition-all duration-300 bg-muted/30 border-border/50 hover:border-purple-500/30 hover:bg-purple-500/5`}>
          <label className="flex items-center gap-2 text-xs font-medium mb-2">
            <div className={`p-1 rounded-md bg-purple-500/10 text-purple-500`}>
              <Receipt className="h-3 w-3" />
            </div>
            <span className="text-muted-foreground">Mostrar</span>
          </label>
          <div className="relative group">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="pl-3 pr-8 py-2 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-purple-500/30 focus:outline-none hover:bg-background shadow-sm min-w-[80px]"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
              <ArrowDownCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs">
          {totalCount} corte(s) total
        </Badge>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            Página {currentPage} de {Math.ceil(totalCount / pageSize)}
          </span>
        )}
      </div>
    </div>
  );
}
