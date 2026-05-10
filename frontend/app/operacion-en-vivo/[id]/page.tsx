"use client";

import { useEffect, useState, use } from "react";
import { fetchSingleOperation, LiveOperationFlow } from "@/hooks/use-live-operations";
import { ForensicDashboard } from "@/components/live-operations/forensic-dashboard";
import { ChevronLeft, FileSearch, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DetailedStayPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [flow, setFlow] = useState<LiveOperationFlow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await fetchSingleOperation(params.id);
      setFlow(data);
      setLoading(false);
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <Activity className="h-10 w-10 text-primary animate-pulse relative z-10" />
        </div>
        <p className="text-muted-foreground font-medium animate-pulse">Recuperando expediente forense...</p>
      </div>
    );
  }

  if (!flow && !loading) {
    return (
      <div className="container mx-auto p-4 max-w-5xl mt-12">
        <div className="text-center py-24 bg-card/30 border border-border/50 rounded-2xl border-dashed">
          <FileSearch className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">Expediente No Encontrado</h3>
          <p className="text-muted-foreground mt-1 mb-6">El folio que intentas buscar no existe o fue eliminado.</p>
          <Link href="/operacion-en-vivo">
            <Button>Regresar al Tablero</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/operacion-en-vivo">
            <Button variant="outline" size="icon" className="rounded-full hover:bg-muted/50 transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 tracking-tight">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <FileSearch className="h-6 w-6" />
              </div>
              Expediente de Auditoría
            </h1>
            <p className="text-muted-foreground text-sm mt-1 ml-14">Vista de Inteligencia Forense</p>
          </div>
        </div>
      </div>

      <div className="shadow-2xl shadow-primary/5 rounded-2xl overflow-hidden ring-1 ring-border/50 bg-card/50 backdrop-blur-sm">
        {flow && <ForensicDashboard flow={flow} />}
      </div>
    </div>
  );
}
