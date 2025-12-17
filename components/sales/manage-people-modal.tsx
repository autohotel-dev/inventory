"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Users, UserPlus, UserMinus, Clock, AlertTriangle, X } from "lucide-react";

interface ManagePeopleModalProps {
  isOpen: boolean;
  roomNumber: string;
  currentPeople: number;
  totalPeople: number;
  maxPeople: number;
  hasActiveTolerance: boolean;
  toleranceMinutesLeft?: number;
  extraPersonPrice: number;
  isHotelRoom: boolean;
  actionLoading: boolean;
  onClose: () => void;
  onAddPersonNew: () => void;
  onAddPersonReturning: () => void;
  onRemovePerson: (willReturn: boolean) => void;
}

export function ManagePeopleModal({
  isOpen,
  roomNumber,
  currentPeople,
  totalPeople,
  maxPeople,
  hasActiveTolerance,
  toleranceMinutesLeft,
  extraPersonPrice,
  isHotelRoom,
  actionLoading,
  onClose,
  onAddPersonNew,
  onAddPersonReturning,
  onRemovePerson,
}: ManagePeopleModalProps) {
  const [action, setAction] = useState<"add" | "remove" | null>(null);
  const [addType, setAddType] = useState<"new" | "returning" | null>(null);
  const [willReturn, setWillReturn] = useState<boolean>(false);

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setAction(null);
      setAddType(null);
      setWillReturn(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calcular si se cobrará extra al agregar persona
  const willChargeExtra = currentPeople >= 2 || totalPeople >= 2;

  // Calcular si la tolerancia expiró
  const isToleranceExpired = hasActiveTolerance && (toleranceMinutesLeft ?? 0) <= 0;

  const handleConfirm = () => {
    if (action === "add") {
      if (addType === "new") {
        onAddPersonNew();
      } else if (addType === "returning") {
        onAddPersonReturning();
      }
    } else if (action === "remove") {
      onRemovePerson(willReturn);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Gestión de Personas
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

        {/* Estado actual */}
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Personas actuales:</span>
            <span className="text-2xl font-bold">{currentPeople}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">Total que han entrado:</span>
            <span className="text-sm">{totalPeople}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">Máximo permitido:</span>
            <span className="text-sm">{maxPeople}</span>
          </div>
        </div>

        {/* Tolerancia activa */}
        {hasActiveTolerance && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">
                Tolerancia activa: {toleranceMinutesLeft} min restantes
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Una persona salió y tiene tiempo para regresar sin cargo extra.
            </p>
          </div>
        )}

        {/* Selección de acción */}
        <div className="space-y-4">
          <Label className="text-muted-foreground">¿Qué deseas hacer?</Label>

          <RadioGroup value={action || ""} onValueChange={(v: string) => setAction(v as "add" | "remove")}>
            <div className="space-y-3">
              {/* Opción: Agregar persona */}
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${action === "add" ? "border-purple-500 bg-purple-500/10" : "hover:border-purple-500/50"
                } ${currentPeople >= maxPeople ? "opacity-50 cursor-not-allowed" : ""}`}>
                <RadioGroupItem value="add" id="add" disabled={currentPeople >= maxPeople} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-purple-400" />
                    <span className="font-medium">Entra una persona</span>
                  </div>
                  {willChargeExtra && extraPersonPrice > 0 ? (
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Se cobrará extra: +${extraPersonPrice.toFixed(2)} MXN
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Sin cargo adicional (primeras 2 personas incluidas)
                    </p>
                  )}
                </div>
              </label>

              {/* Opción: Quitar persona */}
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${action === "remove" ? "border-orange-500 bg-orange-500/10" : "hover:border-orange-500/50"
                } ${currentPeople <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}>
                <RadioGroupItem value="remove" id="remove" disabled={currentPeople <= 0} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <UserMinus className="h-4 w-4 text-orange-400" />
                    <span className="font-medium">Sale una persona</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentPeople === 1
                      ? "La habitación quedará vacía"
                      : `Quedarán ${currentPeople - 1} persona(s)`}
                  </p>
                </div>
              </label>
            </div>
          </RadioGroup>

          {/* Sub-opción: Tipo de entrada (solo para "add") */}
          {action === "add" && (
            <div className="ml-6 p-3 bg-muted/30 rounded-lg border-l-2 border-purple-500/50">
              <Label className="text-sm text-muted-foreground mb-2 block">
                ¿Qué tipo de persona entra?
              </Label>
              <RadioGroup value={addType || ""} onValueChange={(v: string) => setAddType(v as "new" | "returning")}>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="new" id="new-person" />
                    <div>
                      <span className="text-sm font-medium">Persona Nueva</span>
                      {willChargeExtra && extraPersonPrice > 0 && (
                        <p className="text-xs text-amber-400">
                          Se cobrará extra: +${extraPersonPrice.toFixed(2)} MXN
                        </p>
                      )}
                      {(!willChargeExtra || extraPersonPrice === 0) && (
                        <p className="text-xs text-muted-foreground">
                          Sin cargo adicional
                        </p>
                      )}
                    </div>
                  </label>
                  <label className={`flex items-center gap-2 ${!hasActiveTolerance ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <RadioGroupItem
                      value="returning"
                      id="returning-person"
                      disabled={!hasActiveTolerance || isToleranceExpired}
                    />
                    <div>
                      <span className="text-sm font-medium">Regresa Persona que Salió</span>
                      {hasActiveTolerance && !isToleranceExpired && (
                        <p className="text-xs text-teal-400">
                          Cancela la tolerancia activa ({toleranceMinutesLeft} min restantes)
                        </p>
                      )}
                      {isToleranceExpired && (
                        <p className="text-xs text-red-400">
                          Tolerancia expirada. Se cobrará como persona nueva.
                        </p>
                      )}
                      {!hasActiveTolerance && !isToleranceExpired && (
                        <p className="text-xs text-muted-foreground">
                          No hay tolerancia activa (nadie ha salido)
                        </p>
                      )}
                    </div>
                  </label>
                </div>
              </RadioGroup>

              {/* Advertencia: Persona nueva con tolerancia activa */}
              {addType === "new" && hasActiveTolerance && !isToleranceExpired && (
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded">
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Hay tolerancia activa ({toleranceMinutesLeft} min). ¿Seguro que es una persona nueva y no la que salió?
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sub-opción: ¿Va a regresar? (solo para "remove" y si no es hotel) */}
          {action === "remove" && !isHotelRoom && (
            <div className="ml-6 p-3 bg-muted/30 rounded-lg border-l-2 border-orange-500/50">
              <Label className="text-sm text-muted-foreground mb-2 block">
                ¿La persona va a regresar?
              </Label>
              <RadioGroup value={willReturn ? "yes" : "no"} onValueChange={(v: string) => setWillReturn(v === "yes")}>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="no" id="no-return" />
                    <span className="text-sm">No, se fue definitivamente</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="yes" id="yes-return" />
                    <div>
                      <span className="text-sm">Sí, va a regresar</span>
                      <p className="text-xs text-teal-400">
                        Tiene 1 hora de tolerancia para volver sin cargo
                      </p>
                    </div>
                  </label>
                </div>
              </RadioGroup>

              {/* Advertencia: Quitar última persona */}
              {currentPeople === 1 && (
                <div className="mt-2 p-2 bg-orange-500/10 border border-orange-500/30 rounded">
                  <p className="text-xs text-orange-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Es la última persona. Considera hacer checkout en lugar de quitarla.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resumen de acción */}
        {action && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <p className="text-sm">
              {action === "add" ? (
                <>
                  <span className="font-medium">Resultado:</span> {currentPeople} → {currentPeople + 1} personas
                  {addType === "new" && willChargeExtra && extraPersonPrice > 0 && (
                    <span className="text-amber-400 ml-2">(+${extraPersonPrice.toFixed(2)})</span>
                  )}
                  {addType === "returning" && hasActiveTolerance && (
                    <span className="text-teal-400 ml-2">(cancela tolerancia)</span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-medium">Resultado:</span> {currentPeople} → {currentPeople - 1} personas
                  {willReturn && !isHotelRoom && (
                    <span className="text-teal-400 ml-2">(tolerancia 1h activa)</span>
                  )}
                </>
              )}
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
            onClick={handleConfirm}
            disabled={actionLoading || !action || (action === "add" && !addType)}
            className={`flex-1 ${action === "add"
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-orange-600 hover:bg-orange-700"
              } text-white`}
          >
            {actionLoading ? (
              "Procesando..."
            ) : action === "add" ? (
              <span className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Agregar Persona
              </span>
            ) : action === "remove" ? (
              <span className="flex items-center gap-2">
                <UserMinus className="h-4 w-4" /> Quitar Persona
              </span>
            ) : (
              "Selecciona una acción"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
