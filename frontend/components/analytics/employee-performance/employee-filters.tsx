import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmployeeFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  roleFilter: string;
  setRoleFilter: (role: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
}

export function EmployeeFilters({
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  sortBy,
  setSortBy,
}: EmployeeFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-background/50 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
          />
        </div>
      </div>
      <Select value={roleFilter} onValueChange={setRoleFilter}>
        <SelectTrigger className="w-40 bg-background/50 border border-border text-foreground hover:bg-background/70">
          <SelectValue placeholder="Rol" />
        </SelectTrigger>
        <SelectContent className="bg-background/95 border border-border">
          <SelectItem value="all">Todos los roles</SelectItem>
          <SelectItem value="receptionist">Recepcionista</SelectItem>
          <SelectItem value="valet">Cochero</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="w-40 bg-background/50 border border-border text-foreground hover:bg-background/70">
          <SelectValue placeholder="Ordenar" />
        </SelectTrigger>
        <SelectContent className="bg-background/95 border border-border">
          <SelectItem value="efficiency">Eficiencia</SelectItem>
          <SelectItem value="revenue">Ingresos</SelectItem>
          <SelectItem value="checkIns">Entradas</SelectItem>
          <SelectItem value="rating">Rating</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
