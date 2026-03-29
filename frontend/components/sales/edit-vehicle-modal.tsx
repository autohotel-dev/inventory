"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getBrandOptions, getModelsForBrand, searchVehicles } from "@/lib/constants/vehicle-catalog";
import { Car, X, Save, Search } from "lucide-react";

interface EditVehicleModalProps {
  isOpen: boolean;
  roomNumber: string;
  currentVehicle: {
    plate: string | null;
    brand: string | null;
    model: string | null;
  };
  actionLoading: boolean;
  onClose: () => void;
  onSave: (vehicle: { plate: string; brand: string; model: string }) => void;
}

export function EditVehicleModal({
  isOpen,
  roomNumber,
  currentVehicle,
  actionLoading,
  onClose,
  onSave,
}: EditVehicleModalProps) {
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Sincronizar con datos actuales cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setPlate(currentVehicle.plate || "");
      setBrand(currentVehicle.brand || "");
      setModel(currentVehicle.model || "");
      setVehicleSearch("");
      setShowSearchResults(false);
    }
  }, [isOpen, currentVehicle]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ plate, brand, model });
  };

  const hasChanges =
    plate !== (currentVehicle.plate || "") ||
    brand !== (currentVehicle.brand || "") ||
    model !== (currentVehicle.model || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Car className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Datos del Vehículo
              </h2>
              <p className="text-sm text-muted-foreground">Habitación {roomNumber}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="plate" className="text-muted-foreground">
              Placas
            </Label>
            <Input
              id="plate"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC-123"
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Búsqueda rápida por modelo */}
          <div>
            <Label className="text-muted-foreground">
              Buscar por modelo
            </Label>
            <div className="relative">
              <div className="flex items-center gap-2 border rounded px-3 py-2 mt-1">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  className="outline-none flex-1 bg-transparent text-sm"
                  placeholder="Ej: Corolla, Versa, Civic..."
                  value={vehicleSearch}
                  onChange={(e) => {
                    setVehicleSearch(e.target.value);
                    setShowSearchResults(e.target.value.length >= 2);
                  }}
                  onFocus={() => vehicleSearch.length >= 2 && setShowSearchResults(true)}
                />
              </div>

              {showSearchResults && vehicleSearch.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 border rounded bg-background max-h-48 overflow-auto shadow-lg">
                  {searchVehicles(vehicleSearch).map((result, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                      onClick={() => {
                        setBrand(result.brand.value);
                        setModel(result.model);
                        setVehicleSearch(`${result.brand.label} ${result.model}`);
                        setShowSearchResults(false);
                      }}
                    >
                      <span className="font-medium text-blue-500">{result.brand.label}</span>
                      <span className="text-muted-foreground">{result.model}</span>
                    </button>
                  ))}
                  {searchVehicles(vehicleSearch).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                      No se encontraron resultados
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="brand" className="text-muted-foreground">
              Marca
            </Label>
            <SearchableSelect
              id="brand"
              name="brand"
              options={getBrandOptions()}
              defaultValue={brand}
              onChange={(value) => {
                setBrand(value);
                setModel(""); // Limpiar modelo al cambiar marca
              }}
              placeholder="O selecciona marca..."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="model" className="text-muted-foreground">
              Modelo / Color
            </Label>
            {brand ? (
              <SearchableSelect
                id="model"
                name="model"
                options={getModelsForBrand(brand).map(m => ({ value: m, label: m }))}
                defaultValue={model}
                onChange={(value) => setModel(value)}
                placeholder="Seleccionar modelo..."
                className="mt-1"
              />
            ) : (
              <Input
                id="model"
                value=""
                placeholder="Primero selecciona una marca"
                disabled
                className="mt-1 bg-muted"
              />
            )}
          </div>
        </div>

        {/* Info */}
        {!currentVehicle.plate && !currentVehicle.brand && !currentVehicle.model && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-sm text-amber-400">
              ⚡ Esta habitación fue registrada con entrada rápida.
              Agrega los datos del vehículo cuando el cochero llegue.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={actionLoading || !hasChanges}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {actionLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span> Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="h-4 w-4" /> Guardar
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
