"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
// import { Calendar } from "@/components/ui/calendar";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Filter, 
  Search, 
  Calendar as CalendarIcon,
  X,
  RotateCcw
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FilterState {
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  eventType: string;
  severity: string;
  employeeId: string;
  paymentMethod: string;
  roomNumber: string;
  searchQuery: string;
}

interface AuditFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  initialFilters?: Partial<FilterState>;
}

export function AuditFilters({ onFiltersChange, initialFilters }: AuditFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { from: undefined, to: undefined },
    eventType: 'all',
    severity: 'all',
    employeeId: '',
    paymentMethod: 'all',
    roomNumber: '',
    searchQuery: '',
    ...initialFilters
  });

  const updateFilter = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const resetFilters = () => {
    const defaultFilters: FilterState = {
      dateRange: { from: undefined, to: undefined },
      eventType: 'all',
      severity: 'all',
      employeeId: '',
      paymentMethod: 'all',
      roomNumber: '',
      searchQuery: ''
    };
    setFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  const hasActiveFilters = 
    filters.dateRange.from || 
    filters.dateRange.to || 
    filters.eventType !== 'all' || 
    filters.severity !== 'all' || 
    filters.employeeId || 
    filters.paymentMethod !== 'all' || 
    filters.roomNumber || 
    filters.searchQuery;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filtros de Auditoría
          </CardTitle>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Búsqueda libre */}
        <div className="space-y-2">
          <Label htmlFor="search">Búsqueda</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Buscar en logs..."
              value={filters.searchQuery}
              onChange={(e) => updateFilter('searchQuery', e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Rango de fechas - Simplificado */}
        <div className="space-y-2">
          <Label>Rango de Fechas</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={filters.dateRange.from ? format(filters.dateRange.from, "yyyy-MM-dd") : ""}
              onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, from: e.target.value ? new Date(e.target.value) : undefined })}
              placeholder="Desde"
            />
            <Input
              type="date"
              value={filters.dateRange.to ? format(filters.dateRange.to, "yyyy-MM-dd") : ""}
              onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, to: e.target.value ? new Date(e.target.value) : undefined })}
              placeholder="Hasta"
            />
          </div>
        </div>

        {/* Tipo de evento */}
        <div className="space-y-2">
          <Label htmlFor="eventType">Tipo de Evento</Label>
          <Select value={filters.eventType} onValueChange={(value) => updateFilter('eventType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los eventos</SelectItem>
              <SelectItem value="PAYMENT_CREATED">Pago Creado</SelectItem>
              <SelectItem value="PAYMENT_PROCESSED">Pago Procesado</SelectItem>
              <SelectItem value="PAYMENT_UPDATED">Pago Actualizado</SelectItem>
              <SelectItem value="SESSION_STARTED">Sesión Iniciada</SelectItem>
              <SelectItem value="SESSION_ENDED">Sesión Finalizada</SelectItem>
              <SelectItem value="ANOMALY_DETECTED">Anomalía Detectada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Severidad */}
        <div className="space-y-2">
          <Label htmlFor="severity">Severidad</Label>
          <Select value={filters.severity} onValueChange={(value) => updateFilter('severity', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar severidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las severidades</SelectItem>
              <SelectItem value="DEBUG">Debug</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="WARNING">Advertencia</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
              <SelectItem value="CRITICAL">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Método de pago */}
        <div className="space-y-2">
          <Label htmlFor="paymentMethod">Método de Pago</Label>
          <Select value={filters.paymentMethod} onValueChange={(value) => updateFilter('paymentMethod', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los métodos</SelectItem>
              <SelectItem value="EFECTIVO">Efectivo</SelectItem>
              <SelectItem value="TARJETA">Tarjeta</SelectItem>
              <SelectItem value="TARJETA_BBVA">Tarjeta BBVA</SelectItem>
              <SelectItem value="TARJETA_GETNET">Tarjeta Getnet</SelectItem>
              <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Número de habitación */}
        <div className="space-y-2">
          <Label htmlFor="roomNumber">Habitación</Label>
          <Input
            id="roomNumber"
            placeholder="Ej: 101"
            value={filters.roomNumber}
            onChange={(e) => updateFilter('roomNumber', e.target.value)}
          />
        </div>

        {/* ID de empleado */}
        <div className="space-y-2">
          <Label htmlFor="employeeId">ID de Empleado</Label>
          <Input
            id="employeeId"
            placeholder="ID del empleado"
            value={filters.employeeId}
            onChange={(e) => updateFilter('employeeId', e.target.value)}
          />
        </div>

        {/* Resumen de filtros activos */}
        {hasActiveFilters && (
          <div className="pt-2 border-t">
            <div className="text-sm font-medium mb-2">Filtros activos:</div>
            <div className="flex flex-wrap gap-1">
              {filters.dateRange.from && (
                <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  Desde: {format(filters.dateRange.from, "dd/MM/yyyy")}
                </div>
              )}
              {filters.dateRange.to && (
                <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  Hasta: {format(filters.dateRange.to, "dd/MM/yyyy")}
                </div>
              )}
              {filters.eventType !== 'all' && (
                <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                  {filters.eventType}
                </div>
              )}
              {filters.severity !== 'all' && (
                <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                  {filters.severity}
                </div>
              )}
              {filters.paymentMethod !== 'all' && (
                <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                  {filters.paymentMethod}
                </div>
              )}
              {filters.roomNumber && (
                <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                  Hab: {filters.roomNumber}
                </div>
              )}
              {filters.searchQuery && (
                <div className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                  &quot;{filters.searchQuery}&quot;
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
