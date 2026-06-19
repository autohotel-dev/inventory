"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Users,
  UserPlus,
  UserMinus,
  Clock,
  AlertTriangle,
  X,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";

interface ManagePeopleModalProps {
  isOpen: boolean;
  roomNumber: string;
  currentPeople: number;
  totalPeople: number;
  maxPeople: number;
  baseCapacity: number;
  hasActiveTolerance: boolean;
  toleranceMinutesLeft?: number;
  tolerancePeopleOut: number;
  extraPersonPrice: number;
  isHotelRoom: boolean;
  actionLoading: boolean;
  onClose: () => void;
  onAddPersonNew: (count: number) => void;
  onAddPersonReturning: (count: number) => void;
  onRemovePerson: (count: number, willReturn: boolean) => void;
}

export function ManagePeopleModal({
  isOpen,
  roomNumber,
  currentPeople,
  totalPeople,
  maxPeople,
  baseCapacity,
  hasActiveTolerance,
  toleranceMinutesLeft,
  tolerancePeopleOut,
  extraPersonPrice,
  isHotelRoom,
  actionLoading,
  onClose,
  onAddPersonNew,
  onAddPersonReturning,
  onRemovePerson,
}: ManagePeopleModalProps) {
  const [action, setAction] = useState<"add" | "remove" | null>(null);
  const [count, setCount] = useState(1);
  const [addType, setAddType] = useState<"new" | "returning" | null>(null);
  const [willReturn, setWillReturn] = useState<boolean>(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAction(null);
      setCount(1);
      setAddType(null);
      setWillReturn(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- Derived calculations ---
  const isToleranceExpired =
    hasActiveTolerance && (toleranceMinutesLeft ?? 0) <= 0;

  const hasToleranceOut = tolerancePeopleOut > 0;

  // Max people that can enter
  const maxAddable = Math.max(0, maxPeople - currentPeople);

  // Max people that can leave
  const maxRemovable = Math.max(0, currentPeople);

  // Max returning count is limited by how many are actually out
  const maxReturning = Math.min(tolerancePeopleOut, maxAddable);

  // Will adding `count` new people exceed base capacity?
  const willChargeExtra =
    currentPeople + count > baseCapacity || totalPeople >= baseCapacity;

  // Calculate charges for returning with expired tolerance
  const returningPenaltyTotal = extraPersonPrice * count;

  // Calculate charges for new person additions
  const newPersonChargeTotal = (() => {
    if (extraPersonPrice <= 0) return 0;
    // How many of the new additions fall above base capacity?
    const alreadyAbove = Math.max(0, totalPeople - baseCapacity);
    if (alreadyAbove > 0) {
      // All new people are charged
      return extraPersonPrice * count;
    }
    const freeSlots = Math.max(0, baseCapacity - totalPeople);
    const chargeableCount = Math.max(0, count - freeSlots);
    return extraPersonPrice * chargeableCount;
  })();

  // Result people count
  const resultPeople =
    action === "add" ? currentPeople + count : currentPeople - count;

  // --- Handlers ---
  const handleBack = () => {
    setAction(null);
    setCount(1);
    setAddType(null);
    setWillReturn(false);
  };

  const handleConfirm = () => {
    if (action === "add") {
      if (addType === "returning") {
        onAddPersonReturning(count);
      } else {
        onAddPersonNew(count);
      }
    } else if (action === "remove") {
      onRemovePerson(count, willReturn);
    }
  };

  // Can the user confirm?
  const canConfirm = (() => {
    if (actionLoading) return false;
    if (!action) return false;
    if (count < 1) return false;
    if (action === "add" && hasToleranceOut && !addType) return false;
    return true;
  })();

  // Confirm button label
  const confirmLabel = (() => {
    if (actionLoading) return "Procesando...";
    if (action === "add") {
      return addType === "returning"
        ? `Confirmar regreso (${count})`
        : `Agregar ${count} persona${count > 1 ? "s" : ""}`;
    }
    if (action === "remove") {
      return `Retirar ${count} persona${count > 1 ? "s" : ""}`;
    }
    return "Selecciona una acción";
  })();

  // --- Quantity selector component ---
  const QuantitySelector = ({
    max,
    accentColor,
  }: {
    max: number;
    accentColor: "purple" | "orange" | "teal";
  }) => {
    const colorMap = {
      purple: {
        active: "bg-purple-600 text-white border-purple-500",
        hover: "hover:border-purple-500/60 hover:bg-purple-500/10",
      },
      orange: {
        active: "bg-orange-600 text-white border-orange-500",
        hover: "hover:border-orange-500/60 hover:bg-orange-500/10",
      },
      teal: {
        active: "bg-teal-600 text-white border-teal-500",
        hover: "hover:border-teal-500/60 hover:bg-teal-500/10",
      },
    };
    const colors = colorMap[accentColor];
    const buttons = Array.from({ length: Math.min(max, 6) }, (_, i) => i + 1);

    if (max <= 0) {
      return (
        <p className="text-sm text-muted-foreground italic">
          No es posible realizar esta acción.
        </p>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {buttons.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCount(n)}
            className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${
              count === n
                ? colors.active
                : `border-border bg-muted/40 text-foreground ${colors.hover}`
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    );
  };

  // --- Render ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        id="tour-manage-people-modal"
        className="bg-background border rounded-lg shadow-lg w-[95vw] sm:w-full sm:max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Gestión de Personas</h2>
              <p className="text-sm text-muted-foreground">
                Habitación {roomNumber}
              </p>
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

        {/* Current status */}
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Personas actuales:</span>
            <span className="text-2xl font-bold">{currentPeople}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              Total que han entrado:
            </span>
            <span className="text-sm">{totalPeople}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              Máximo permitido:
            </span>
            <span className="text-sm">{maxPeople}</span>
          </div>
          {hasToleranceOut && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3 text-teal-400" />
                Personas fuera con tolerancia:
              </span>
              <span className="text-sm text-teal-400">
                {tolerancePeopleOut}
              </span>
            </div>
          )}
        </div>

        {/* Active tolerance banner */}
        {hasActiveTolerance && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">
                {isToleranceExpired
                  ? "Tolerancia expirada"
                  : `Tolerancia activa: ${toleranceMinutesLeft} min restantes`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {tolerancePeopleOut} persona{tolerancePeopleOut !== 1 ? "s" : ""}{" "}
              fuera.{" "}
              {isToleranceExpired
                ? "El tiempo expiró, se aplicará penalización al regresar."
                : "Puede(n) regresar sin cargo adicional."}
            </p>
          </div>
        )}

        {/* ================= STEP 1: Choose Action ================= */}
        {!action && (
          <div className="space-y-3">
            <Label className="text-muted-foreground">
              ¿Qué deseas hacer?
            </Label>

            {/* Add people */}
            <button
              id="tour-add-person-radio"
              type="button"
              disabled={currentPeople >= maxPeople}
              onClick={() => setAction("add")}
              className={`w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-colors ${
                currentPeople >= maxPeople
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-purple-500/50 hover:bg-purple-500/5 cursor-pointer"
              }`}
            >
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <UserPlus className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <span className="font-medium">Entran personas</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Agregar personas a la habitación
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Remove people */}
            <button
              id="tour-remove-person-radio"
              type="button"
              disabled={currentPeople <= 0}
              onClick={() => setAction("remove")}
              className={`w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-colors ${
                currentPeople <= 0
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-orange-500/50 hover:bg-orange-500/5 cursor-pointer"
              }`}
            >
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <UserMinus className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <span className="font-medium">Salen personas</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Retirar personas de la habitación
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* ================= STEP 2a: ADD flow ================= */}
        {action === "add" && (
          <div className="space-y-4">
            {/* Back button */}
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver
            </button>

            {/* Quantity selector */}
            <div>
              <Label className="text-muted-foreground mb-2 block">
                ¿Cuántas personas entran?
              </Label>
              <QuantitySelector
                max={
                  addType === "returning"
                    ? maxReturning
                    : maxAddable
                }
                accentColor={addType === "returning" ? "teal" : "purple"}
              />
            </div>

            {/* Sub-question: returning vs new (only when there's active tolerance with people out) */}
            {hasToleranceOut && (
              <div className="p-3 bg-muted/30 rounded-lg border-l-2 border-teal-500/50">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  ¿Son personas que habían salido?
                </Label>
                <RadioGroup
                  value={addType || ""}
                  onValueChange={(v: string) => {
                    setAddType(v as "new" | "returning");
                    // Reset count to 1 when switching type to avoid invalid counts
                    setCount(1);
                  }}
                >
                  <div className="space-y-2">
                    {/* Returning */}
                    <label className="flex items-start gap-2 cursor-pointer">
                      <RadioGroupItem
                        value="returning"
                        id="returning-person"
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium">
                          Sí, regresan
                        </span>
                        {!isToleranceExpired && (
                          <p className="text-xs text-teal-400 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="h-3 w-3" />
                            Dentro de tolerancia. Sin cargo adicional
                          </p>
                        )}
                        {isToleranceExpired && (
                          <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            Tolerancia expirada. Penalización: $
                            {extraPersonPrice.toFixed(2)} × {count} persona
                            {count > 1 ? "s" : ""} = $
                            {returningPenaltyTotal.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </label>

                    {/* New person */}
                    <label className="flex items-start gap-2 cursor-pointer">
                      <RadioGroupItem
                        value="new"
                        id="new-person"
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium">
                          No, son personas nuevas
                        </span>
                        {willChargeExtra && extraPersonPrice > 0 ? (
                          <p className="text-xs text-amber-400 mt-0.5">
                            Cargo extra: +${newPersonChargeTotal.toFixed(2)} MXN
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Sin cargo adicional
                          </p>
                        )}
                      </div>
                    </label>
                  </div>
                </RadioGroup>

                {/* Warning: choosing new while tolerance is active */}
                {addType === "new" && !isToleranceExpired && (
                  <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded">
                    <p className="text-xs text-amber-400 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      Hay tolerancia activa ({tolerancePeopleOut} persona
                      {tolerancePeopleOut !== 1 ? "s" : ""} fuera). ¿Seguro que
                      son personas nuevas?
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* No tolerance: show charge info directly */}
            {!hasToleranceOut && (
              <div>
                {willChargeExtra && extraPersonPrice > 0 ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Cargo por persona extra: +$
                      {newPersonChargeTotal.toFixed(2)} MXN
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Base incluida: {baseCapacity} personas. Se cobra $
                      {extraPersonPrice.toFixed(2)} por cada persona adicional.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin cargo adicional (primeras {baseCapacity} personas
                    incluidas)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 2b: REMOVE flow ================= */}
        {action === "remove" && (
          <div className="space-y-4">
            {/* Back button */}
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver
            </button>

            {/* Quantity selector */}
            <div>
              <Label className="text-muted-foreground mb-2 block">
                ¿Cuántas personas salen?
              </Label>
              <QuantitySelector max={maxRemovable} accentColor="orange" />
            </div>

            {/* Will return toggle (only for non-hotel rooms) */}
            {!isHotelRoom && (
              <div className="p-3 bg-muted/30 rounded-lg border-l-2 border-orange-500/50">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  ¿Van a regresar?
                </Label>
                <RadioGroup
                  value={willReturn ? "yes" : "no"}
                  onValueChange={(v: string) => setWillReturn(v === "yes")}
                >
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <RadioGroupItem
                        value="yes"
                        id="yes-return"
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium">
                          Sí, van a regresar
                        </span>
                        <p className="text-xs text-teal-400 mt-0.5">
                          Tendrán 1 hora de tolerancia para volver sin cargo
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <RadioGroupItem
                        value="no"
                        id="no-return"
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium">
                          No, se van definitivamente
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Se retiran sin tolerancia
                        </p>
                      </div>
                    </label>
                  </div>
                </RadioGroup>

                {/* Warning: existing tolerance active */}
                {hasToleranceOut && (
                  <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded">
                    <p className="text-xs text-amber-400 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      Ya hay {tolerancePeopleOut} persona
                      {tolerancePeopleOut !== 1 ? "s" : ""} fuera con tolerancia
                      activa
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Warning: emptying the room */}
            {count >= currentPeople && (
              <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded">
                <p className="text-xs text-orange-400 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  La habitación quedará vacía. Considera hacer checkout en lugar
                  de retirar a todas las personas.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= Summary ================= */}
        {action && count > 0 && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <p className="text-sm">
              <span className="font-medium">Resultado: </span>
              {currentPeople} → {resultPeople} persona
              {resultPeople !== 1 ? "s" : ""}
              {action === "add" && (
                <>
                  {addType === "returning" && !isToleranceExpired && (
                    <span className="text-teal-400 ml-1">
                      (regresan {count} — Sin cargo)
                    </span>
                  )}
                  {addType === "returning" && isToleranceExpired && (
                    <span className="text-amber-400 ml-1">
                      (regresan {count} — Penalización: $
                      {returningPenaltyTotal.toFixed(2)})
                    </span>
                  )}
                  {(addType === "new" || !hasToleranceOut) &&
                    newPersonChargeTotal > 0 && (
                      <span className="text-amber-400 ml-1">
                        (+{count} persona{count > 1 ? "s" : ""} nueva
                        {count > 1 ? "s" : ""} — Cargo: $
                        {newPersonChargeTotal.toFixed(2)})
                      </span>
                    )}
                  {(addType === "new" || !hasToleranceOut) &&
                    newPersonChargeTotal === 0 && (
                      <span className="text-muted-foreground ml-1">
                        (+{count} persona{count > 1 ? "s" : ""} sin cargo)
                      </span>
                    )}
                </>
              )}
              {action === "remove" && (
                <>
                  {willReturn && !isHotelRoom ? (
                    <span className="text-teal-400 ml-1">
                      (salen {count} con tolerancia 1h)
                    </span>
                  ) : (
                    <span className="text-orange-400 ml-1">
                      (salen {count} definitivamente)
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        )}

        {/* ================= Action buttons ================= */}
        {action && (
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`flex-1 text-white ${
                action === "add"
                  ? addType === "returning"
                    ? "bg-teal-600 hover:bg-teal-700"
                    : "bg-purple-600 hover:bg-purple-700"
                  : "bg-orange-600 hover:bg-orange-700"
              }`}
            >
              {actionLoading ? (
                "Procesando..."
              ) : action === "add" ? (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  {confirmLabel}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserMinus className="h-4 w-4" />
                  {confirmLabel}
                </span>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
