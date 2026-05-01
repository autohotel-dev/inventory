"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoomType } from "@/components/sales/room-types";
import { Minus, Plus, Users, Car, Search, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getBrandOptions, getModelsForBrand, searchVehicles } from "@/lib/constants/vehicle-catalog";
import { formatDateTime } from "@/lib/export-utils"; // FIX #9: Use centralized date formatter
import { ProcessingOverlay } from "@/components/ui/processing-overlay";

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
  onConfirm: (initialPeople: number, payments: PaymentEntry[], vehicle: VehicleInfo, durationNights: number) => void;
}

// FIX #9: Removed local formatDateTime - using centralized utility from export-utils

export function RoomStartStayModal({
  isOpen,
  roomNumber,
  roomType,
  expectedCheckout: initialExpectedCheckout,
  actionLoading,
  onClose,
  onConfirm,
}: RoomStartStayModalProps) {
  const [initialPeople, setInitialPeople] = useState(2);
  const [durationNights, setDurationNights] = useState(1);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [vehicle, setVehicle] = useState<VehicleInfo>({ plate: "", brand: "", model: "" });
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const maxPeople = roomType?.max_people ?? 4;
  const extraPersonPrice = roomType?.extra_person_price ?? 0;

  // Calcular costo extra por personas adicionales
  const extraPeopleCount = Math.max(0, initialPeople - 2);
  const extraPeopleCost = extraPeopleCount * extraPersonPrice;
  const basePricePerNight = (roomType?.base_price ?? 0) + extraPeopleCost;
  const totalPrice = roomType?.is_hotel ? (basePricePerNight * durationNights) : basePricePerNight;

  // Calcular nueva fecha de salida si es hotel
  const displayExpectedCheckout = (() => {
    if (!roomType?.is_hotel) return initialExpectedCheckout;
    const checkout = new Date(); // Asumimos entrada hoy para el previo visual
    checkout.setDate(checkout.getDate() + durationNights);
    checkout.setHours(12, 0, 0, 0);
    return checkout;
  })();

  // Reset al abrir y actualizar pagos cuando cambia el total
  useEffect(() => {
    if (isOpen) {
      setInitialPeople(2);
      setDurationNights(1);
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
      <div className="relative bg-background border rounded-lg shadow-lg w-[95vw] sm:w-full sm:max-w-4xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Processing overlay */}
        <ProcessingOverlay
          isVisible={actionLoading}
          title="Registrando estancia"
          steps={[
            { label: "Creando orden...", icon: "payment" },
            { label: "Procesando pago...", icon: "payment" },
            { label: "Registrando estancia...", icon: "room" },
            { label: "Imprimiendo tickets...", icon: "printer" },
          ]}
          autoCycleMs={1500}
        />
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
          <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-between border">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Habitación</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{roomNumber}</span>
                <Badge variant="secondary" className="text-sm border-border/50">{roomType.name}</Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Salida estimada</p>
              <div className="flex items-center justify-end gap-1.5 text-blue-600 dark:text-blue-400">
                <Clock className="h-4 w-4" />
                <span className="text-lg font-bold">
                  {displayExpectedCheckout.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {displayExpectedCheckout.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Duración y Ocupación */}
            <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
              {/* Selector de Noches (Solo para Hotel) */}
              {roomType.is_hotel && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">Duración de estancia</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setDurationNights(Math.max(1, durationNights - 1))}
                      disabled={actionLoading || durationNights <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="text-center">
                      <span className="text-3xl font-bold tabular-nums">{durationNights}</span>
                      <span className="text-xs text-muted-foreground block">{durationNights === 1 ? 'Noche' : 'Noches'}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setDurationNights(Math.min(30, durationNights + 1))}
                      disabled={actionLoading}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Selector de personas */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">Ocupación</span>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setInitialPeople(Math.max(1, initialPeople - 1))}
                    disabled={actionLoading || initialPeople <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <span className="text-3xl font-bold tabular-nums">{initialPeople}</span>
                    <span className="text-xs text-muted-foreground block">personas</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setInitialPeople(Math.min(maxPeople, initialPeople + 1))}
                    disabled={actionLoading || initialPeople >= maxPeople}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {extraPeopleCount > 0 && (
                  <div className="text-center p-1.5 bg-amber-500/10 rounded text-amber-600 text-xs font-medium border border-amber-200 dark:border-amber-800">
                    +{extraPeopleCount} extra (+${extraPeopleCost.toFixed(2)} / noche)
                  </div>
                )}
              </div>
            </div>

            {/* Resumen de Costos */}
            <div className="space-y-3 p-4 border rounded-lg bg-card shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Precio base x noche:</span>
                <span className="font-medium">${roomType.base_price?.toFixed(2)}</span>
              </div>

              {extraPeopleCost > 0 && (
                <div className="flex justify-between items-center text-sm text-amber-600">
                  <span>Personas extra x noche:</span>
                  <span>+${extraPeopleCost.toFixed(2)}</span>
                </div>
              )}

              {roomType.is_hotel && durationNights > 1 && (
                <div className="flex justify-between items-center text-sm text-blue-600 font-medium">
                  <span>Multiplicado por:</span>
                  <span>{durationNights} Noches</span>
                </div>
              )}

              <div className="border-t pt-2 mt-1 flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-2xl text-emerald-600">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>




          {/* Información del vehículo */}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
              <Car className="h-4 w-4" />
              Datos del vehículo <Badge variant="outline" className="text-[10px] h-5">Opcional</Badge>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-muted/10 rounded-lg border border-dashed">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Placas</Label>
                <Input
                  placeholder="ej: ABC-123"
                  value={vehicle.plate}
                  onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
                  disabled={actionLoading}
                  className="uppercase tracking-widest font-mono border-muted-foreground/30 focus:border-primary"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Buscar Modelo</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="ej: Corolla, Versa..."
                    value={vehicleSearch}
                    onChange={(e) => {
                      setVehicleSearch(e.target.value);
                      setShowSearchResults(e.target.value.length >= 2);
                    }}
                    onFocus={() => vehicleSearch.length >= 2 && setShowSearchResults(true)}
                  />

                  {showSearchResults && vehicleSearch.length >= 2 && (
                    <div className="absolute z-10 w-full mt-1 border rounded-md bg-popover text-popover-foreground shadow-md max-h-48 overflow-auto">
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
                          Sin resultados
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Marca</Label>
                <SearchableSelect
                  id="vehicle-brand"
                  name="vehicle-brand"
                  options={getBrandOptions()}
                  defaultValue={vehicle.brand}
                  onChange={(value) => {
                    setVehicle({ brand: value, model: "", plate: vehicle.plate });
                  }}
                  placeholder="Marca..."
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Modelo</Label>
                {vehicle.brand ? (
                  <SearchableSelect
                    id="vehicle-model"
                    name="vehicle-model"
                    options={getModelsForBrand(vehicle.brand).map(m => ({ value: m, label: m }))}
                    defaultValue={vehicle.model}
                    onChange={(value) => setVehicle({ ...vehicle, model: value })}
                    placeholder="Modelo..."
                    className="w-full"
                  />
                ) : (
                  <Input
                    placeholder="Selecciona marca"
                    disabled
                    className="bg-muted text-xs"
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
            Se creará una orden de venta en estado &quot;Abierta&quot; vinculada a esta habitación.
          </p>
        </div>
        <div className="px-6 py-4 border-t flex-shrink-0">
          {/* FIX #6: Payment validation warning */}
          {(() => {
            const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
            if (totalPaid < totalPrice) {
              return (
                <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    ⚠️ Pago incompleto
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Total a pagar: ${totalPrice.toFixed(2)} | Pagado: ${totalPaid.toFixed(2)} | Faltante: ${(totalPrice - totalPaid).toFixed(2)}
                  </p>
                </div>
              );
            }
            return null;
          })()}
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button onClick={() => onConfirm(initialPeople, payments, vehicle, durationNights)} disabled={actionLoading}>
              {actionLoading ? "Iniciando..." : "Iniciar estancia"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
