"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RoomType } from "@/components/sales/room-types";
import { Minus, Plus, Users, Car, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getBrandOptions, getModelsForBrand, searchVehicles } from "@/lib/constants/vehicle-catalog";

export interface VehicleInfo {
  plate: string;
  brand: string;
  model: string;
}

export interface RoomStartStayModalProps {
  isOpen: boolean;
  roomNumber: string;
  roomType: RoomType;
  expectedCheckout: Date;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: (initialPeople: number, payments: PaymentEntry[], vehicle: VehicleInfo) => void;
}

function formatDateTime(date: Date) {
  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RoomStartStayModal({
  isOpen,
  roomNumber,
  roomType,
  expectedCheckout,
  actionLoading,
  onClose,
  onConfirm,
}: RoomStartStayModalProps) {
  const [initialPeople, setInitialPeople] = useState(2);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [vehicle, setVehicle] = useState<VehicleInfo>({ plate: "", brand: "", model: "" });
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const maxPeople = roomType?.max_people ?? 4;
  const extraPersonPrice = roomType?.extra_person_price ?? 0;

  // Calcular costo extra por personas adicionales
  const extraPeopleCount = Math.max(0, initialPeople - 2);
  const extraPeopleCost = extraPeopleCount * extraPersonPrice;
  const totalPrice = (roomType?.base_price ?? 0) + extraPeopleCost;

  // Reset al abrir y actualizar pagos cuando cambia el total
  useEffect(() => {
    if (isOpen) {
      setInitialPeople(2);
      setPayments(createInitialPayment(roomType?.base_price ?? 0));
      setVehicle({ plate: "", brand: "", model: "" });
      setVehicleSearch("");
      setShowSearchResults(false);
    }
  }, [isOpen]);

  // Actualizar monto de pago cuando cambia el total
  useEffect(() => {
    if (isOpen && payments.length > 0) {
      const currentTotal = payments.reduce((s, p) => s + p.amount, 0);
      if (currentTotal !== totalPrice && payments.length === 1) {
        setPayments(createInitialPayment(totalPrice));
      }
    }
  }, [totalPrice]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold">Iniciar estancia</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={actionLoading}
          >
            ✕
          </Button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Habitación</p>
            <p className="text-base font-semibold">
              Hab. {roomNumber} – {roomType.name}
            </p>
          </div>

          {/* Selector de personas */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Personas que entran
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setInitialPeople(Math.max(1, initialPeople - 1))}
                disabled={actionLoading || initialPeople <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-2xl font-bold w-12 text-center">{initialPeople}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setInitialPeople(Math.min(maxPeople, initialPeople + 1))}
                disabled={actionLoading || initialPeople >= maxPeople}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                (máx. {maxPeople})
              </span>
            </div>
            {extraPeopleCount > 0 && (
              <p className="text-sm text-amber-500">
                +{extraPeopleCount} persona{extraPeopleCount > 1 ? 's' : ''} extra = +${extraPeopleCost.toFixed(2)} MXN
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Precio base</p>
            <p className="text-base font-semibold">
              $ {roomType.base_price?.toFixed(2) ?? "0.00"} MXN
            </p>
          </div>

          {extraPeopleCost > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total inicial</p>
              <p className="text-lg font-bold text-emerald-500">
                $ {totalPrice.toFixed(2)} MXN
              </p>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Salida estimada</p>
            <p className="text-base font-medium">
              {formatDateTime(expectedCheckout)}
            </p>
          </div>

          {/* Información del vehículo */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Car className="h-4 w-4" />
              Datos del vehículo (opcional)
            </p>
            <div className="grid grid-cols-1 gap-3">
              <Input
                placeholder="Placas (ej: ABC-123)"
                value={vehicle.plate}
                onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
                disabled={actionLoading}
                className="uppercase"
              />

              {/* Búsqueda rápida por modelo */}
              <div className="relative">
                <div className="flex items-center gap-2 border rounded px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    className="outline-none flex-1 bg-transparent text-sm"
                    placeholder="Buscar por modelo (ej: Corolla, Versa)..."
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
                          setVehicle({ ...vehicle, brand: result.brand.value, model: result.model });
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

              <div className="grid grid-cols-2 gap-2">
                <SearchableSelect
                  id="vehicle-brand"
                  name="vehicle-brand"
                  options={getBrandOptions()}
                  defaultValue={vehicle.brand}
                  onChange={(value) => {
                    setVehicle({ brand: value, model: "", plate: vehicle.plate });
                  }}
                  placeholder="O selecciona marca..."
                  className="w-full"
                />
                {vehicle.brand ? (
                  <SearchableSelect
                    id="vehicle-model"
                    name="vehicle-model"
                    options={getModelsForBrand(vehicle.brand).map(m => ({ value: m, label: m }))}
                    defaultValue={vehicle.model}
                    onChange={(value) => setVehicle({ ...vehicle, model: value })}
                    placeholder="Seleccionar modelo..."
                    className="w-full"
                  />
                ) : (
                  <Input
                    placeholder="Primero selecciona marca"
                    disabled
                    className="bg-muted"
                  />
                )}
              </div>
            </div>
          </div>

          <MultiPaymentInput
            totalAmount={totalPrice}
            payments={payments}
            onPaymentsChange={setPayments}
            disabled={actionLoading}
          />

          <p className="text-xs text-muted-foreground">
            Se creará una orden de venta en estado "Abierta" vinculada a esta habitación.
          </p>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={actionLoading}
          >
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(initialPeople, payments, vehicle)} disabled={actionLoading}>
            {actionLoading ? "Iniciando..." : "Iniciar estancia"}
          </Button>
        </div>
      </div>
    </div>
  );
}
