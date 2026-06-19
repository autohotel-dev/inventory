'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useRoomInspections } from '@/hooks/use-room-inspections';
import { Tv, MonitorCheck, AlertTriangle, Loader2 } from 'lucide-react';

interface AssignInspectionDialogProps {
  roomStayId: string;
  roomId: string;
  roomNumber: string;
  assignedBy: string; // receptionist employee ID
  onAssigned?: () => void;
  trigger?: React.ReactNode;
  isOpen?: boolean; // controlled mode
  onClose?: () => void; // controlled mode
}

export function AssignInspectionDialog({
  roomStayId,
  roomId,
  roomNumber,
  assignedBy,
  onAssigned,
  trigger,
  isOpen: controlledOpen,
  onClose,
}: AssignInspectionDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) {
      if (!v && onClose) onClose();
    } else {
      setInternalOpen(v);
    }
  };
  const [inspectionType, setInspectionType] = useState<'TV_CHECK' | 'DAMAGE_CHECK' | 'GENERAL'>('TV_CHECK');
  const [selectedCochero, setSelectedCochero] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [cocheros, setCocheros] = useState<any[]>([]);
  const { loading, assignInspection, fetchAvailableCocheros } = useRoomInspections();

  useEffect(() => {
    if (open) {
      fetchAvailableCocheros().then(setCocheros);
    }
  }, [open, fetchAvailableCocheros]);

  const handleAssign = async () => {
    if (!selectedCochero) {
      return;
    }
    const result = await assignInspection({
      roomStayId,
      roomId,
      inspectionType,
      assignedTo: selectedCochero,
      assignedBy,
      notes: notes || undefined,
    });
    if (result) {
      setOpen(false);
      setSelectedCochero('');
      setNotes('');
      onAssigned?.();
    }
  };

  const typeConfig = {
    TV_CHECK: { icon: Tv, label: 'Revisión de TV', color: 'bg-cyan-500' },
    DAMAGE_CHECK: { icon: AlertTriangle, label: 'Revisión de Daños', color: 'bg-red-500' },
    GENERAL: { icon: MonitorCheck, label: 'Inspección General', color: 'bg-blue-500' },
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-1.5">
              <Tv className="h-3.5 w-3.5" />
              Asignar Inspección
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorCheck className="h-5 w-5" />
            Asignar Inspección — Hab. {roomNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Type selection */}
          <div className="space-y-2">
            <Label>Tipo de Inspección</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(typeConfig) as [string, any][]).map(([key, config]) => {
                const Icon = config.icon;
                const isSelected = inspectionType === key;
                return (
                  <button
                    key={key}
                    onClick={() => setInspectionType(key as any)}
                    className={`p-3 rounded-lg border-2 transition-all text-center space-y-1 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mx-auto ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className={`text-[10px] font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                      {config.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cochero selection */}
          <div className="space-y-2">
            <Label>Asignar a Cochero</Label>
            <Select value={selectedCochero} onValueChange={setSelectedCochero}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cochero..." />
              </SelectTrigger>
              <SelectContent>
                {cocheros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones adicionales..."
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleAssign}
            disabled={loading || !selectedCochero}
            className="w-full"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Asignando...</>
            ) : (
              <><Tv className="h-4 w-4 mr-2" /> Asignar Inspección</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
