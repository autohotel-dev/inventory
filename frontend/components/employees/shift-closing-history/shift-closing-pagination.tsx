import { Button } from "@/components/ui/button";

interface ShiftClosingPaginationProps {
  totalCount: number;
  pageSize: number;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
}

export function ShiftClosingPagination({
  totalCount,
  pageSize,
  currentPage,
  setCurrentPage
}: ShiftClosingPaginationProps) {
  if (totalCount <= pageSize) {
    return null;
  }

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-muted-foreground">
        Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalCount)} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
        >
          Primera
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev: number) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          Anterior
        </Button>
        <span className="text-sm px-3">
          Página {currentPage} de {Math.ceil(totalCount / pageSize)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev: number) => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
          disabled={currentPage >= Math.ceil(totalCount / pageSize)}
        >
          Siguiente
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
          disabled={currentPage >= Math.ceil(totalCount / pageSize)}
        >
          Última
        </Button>
      </div>
    </div>
  );
}
