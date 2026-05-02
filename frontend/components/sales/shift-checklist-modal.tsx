"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  AlertTriangle,
  Pen,
  Eraser,
  Loader2,
} from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
  checked: boolean;
}

interface ShiftChecklistModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: { items: ChecklistItem[]; notes: string; signature: string }) => void;
  shiftType: string;
}

const DEFAULT_CHECKLIST: Omit<ChecklistItem, "checked">[] = [
  {
    id: "cash_count",
    label: "Caja contada y cuadrada",
    description: "Verificar que el efectivo en caja coincide con el sistema",
    required: true,
  },
  {
    id: "rooms_verified",
    label: "Habitaciones revisadas",
    description: "Todas las habitaciones activas fueron verificadas físicamente",
    required: true,
  },
  {
    id: "minibar_checked",
    label: "Inventario de minibar verificado",
    description: "Stock de minibar corresponde con el sistema",
    required: true,
  },
  {
    id: "common_areas",
    label: "Áreas comunes limpias",
    description: "Lobby, baños y estacionamiento están en orden",
    required: true,
  },
  {
    id: "incidents_reported",
    label: "Incidencias reportadas",
    description: "Cualquier incidente durante el turno fue documentado",
    required: true,
  },
  {
    id: "keys_returned",
    label: "Llaves y accesos entregados",
    description: "Todas las llaves maestras y dispositivos están en su lugar",
    required: false,
  },
  {
    id: "equipment_ok",
    label: "Equipo en buen estado",
    description: "Computadora, impresora, cámaras funcionan correctamente",
    required: false,
  },
];

export function ShiftChecklistModal({ open, onClose, onComplete, shiftType }: ShiftChecklistModalProps) {
  const [items, setItems] = useState<ChecklistItem[]>(
    DEFAULT_CHECKLIST.map((i) => ({ ...i, checked: false }))
  );
  const [notes, setNotes] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const requiredChecked = items.filter((i) => i.required && i.checked).length;
  const requiredTotal = items.filter((i) => i.required).length;
  const allRequiredDone = requiredChecked === requiredTotal;
  const progress = Math.round((requiredChecked / requiredTotal) * 100);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    );
  };

  // Canvas drawing
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    lastPos.current = getCanvasPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current || !lastPos.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const hasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((channel, i) => i % 4 === 3 && channel > 0);
  };

  const handleSubmit = async () => {
    if (!allRequiredDone || !hasSignature()) return;
    setSubmitting(true);

    const signature = canvasRef.current?.toDataURL("image/png") || "";

    // Small delay for UX
    await new Promise((r) => setTimeout(r, 500));

    onComplete({ items, notes, signature });
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Checklist de Cierre — {shiftType}
          </DialogTitle>
          <DialogDescription>
            Completa todos los puntos obligatorios antes de cerrar el turno.
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progreso</span>
            <span className="font-medium">{requiredChecked}/{requiredTotal} obligatorios</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-primary to-emerald-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all active:scale-[0.98] ${
                item.checked
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border/50 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {item.checked ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                      {item.label}
                    </span>
                    {item.required && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        Obligatorio
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Observaciones (opcional)</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas adicionales del turno..."
            rows={2}
            className="resize-none rounded-xl"
          />
        </div>

        {/* Signature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Pen className="h-3.5 w-3.5" />
              Firma del Responsable
            </label>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSignature}>
              <Eraser className="h-3 w-3 mr-1" />
              Limpiar
            </Button>
          </div>
          <div className="border rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={400}
              height={120}
              className="w-full h-[100px] cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Dibuja tu firma con el mouse o dedo
          </p>
        </div>

        {/* Warning if incomplete */}
        {!allRequiredDone && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Completa todos los puntos obligatorios para continuar
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!allRequiredDone || submitting}
            className="rounded-xl"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ClipboardCheck className="h-4 w-4 mr-2" />
            )}
            Confirmar Cierre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
