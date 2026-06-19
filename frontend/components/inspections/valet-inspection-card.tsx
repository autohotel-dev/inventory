'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useRoomInspections, RoomInspection } from '@/hooks/use-room-inspections';
import { Tv, CheckCircle, XCircle, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ValetInspectionCardProps {
  valetId: string;
  onRefresh?: () => void;
}

export function ValetInspectionCard({ valetId, onRefresh }: ValetInspectionCardProps) {
  const [inspections, setInspections] = useState<RoomInspection[]>([]);
  const [issueText, setIssueText] = useState<Record<string, string>>({});
  const { loading, acceptInspection, completeInspection, fetchMyInspections } = useRoomInspections();

  const loadInspections = useCallback(async () => {
    const data = await fetchMyInspections(valetId);
    setInspections(data);
  }, [valetId, fetchMyInspections]);

  useEffect(() => {
    loadInspections();
    // Poll every 30 seconds
    const interval = setInterval(loadInspections, 30000);
    return () => clearInterval(interval);
  }, [loadInspections]);

  const handleAccept = async (id: string) => {
    const ok = await acceptInspection(id);
    if (ok) {
      loadInspections();
      onRefresh?.();
    }
  };

  const handleComplete = async (id: string, result: 'OK' | 'ISSUE_FOUND') => {
    const ok = await completeInspection(id, result, issueText[id]);
    if (ok) {
      loadInspections();
      onRefresh?.();
    }
  };

  if (inspections.length === 0) return null;

  const typeLabels: Record<string, string> = {
    TV_CHECK: '📺 Revisión TV',
    DAMAGE_CHECK: '⚠️ Revisión Daños',
    GENERAL: '🔍 Inspección General',
  };

  return (
    <Card className="border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50/50 to-transparent dark:from-cyan-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Tv className="h-5 w-5 text-cyan-600" />
          Inspecciones Pendientes
          <Badge variant="secondary" className="ml-auto">{inspections.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {inspections.map((insp) => (
          <div key={insp.id} className="p-3 rounded-lg bg-background border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={insp.status === 'PENDING' ? 'default' : 'secondary'}>
                  {typeLabels[insp.inspection_type] || insp.inspection_type}
                </Badge>
                <span className="text-sm font-semibold">
                  Hab. {(insp.rooms as any)?.number || '?'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(insp.assigned_at), { locale: es, addSuffix: true })}
              </span>
            </div>

            {insp.notes && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{insp.notes}</p>
            )}

            {insp.status === 'PENDING' && (
              <Button
                size="sm"
                onClick={() => handleAccept(insp.id)}
                disabled={loading}
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aceptar Inspección'}
              </Button>
            )}

            {insp.status === 'ACCEPTED' && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Describe el problema encontrado (si hay)..."
                  value={issueText[insp.id] || ''}
                  onChange={(e) => setIssueText(prev => ({ ...prev, [insp.id]: e.target.value }))}
                  rows={2}
                  className="text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleComplete(insp.id, 'OK')}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Todo OK
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleComplete(insp.id, 'ISSUE_FOUND')}
                    disabled={loading || !(issueText[insp.id]?.trim())}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reportar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
