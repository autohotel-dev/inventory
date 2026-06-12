"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Tv, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OrphanedTVsBannerProps {
  /** Called after a successful release so the board can refresh room data */
  onRelease?: () => void;
  className?: string;
}

export function OrphanedTVsBanner({ onRelease, className }: OrphanedTVsBannerProps) {
  const [orphanedCount, setOrphanedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [justReleased, setJustReleased] = useState<number | null>(null);

  const fetchCount = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_orphaned_tv_count");
      if (!error && data) {
        setOrphanedCount(data.orphaned_count ?? 0);
      }
    } catch {
      // non-critical, silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount + poll every 30s
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const handleRelease = async () => {
    setIsReleasing(true);
    try {
      const supabase = createClient();

      // Get current employee for audit trail
      let employeeId: string | null = null;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: emp } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", session.user.id)
          .single();
        if (emp) employeeId = emp.id;
      }

      const { data, error } = await supabase.rpc("release_orphaned_tv_tasks", {
        p_action_by_employee_id: employeeId,
      });

      if (error) throw error;

      const released = data?.released_count ?? 0;
      setJustReleased(released);
      setOrphanedCount(0);

      toast.success(
        released > 0
          ? `✅ ${released} TV${released !== 1 ? "s" : ""} liberada${released !== 1 ? "s" : ""} para reasignación`
          : "No había TVs bloqueadas",
        {
          description:
            released > 0
              ? "Las habitaciones ya pueden recibir un nuevo cochero."
              : undefined,
        }
      );

      onRelease?.();

      // Hide the "just released" success state after 6s
      setTimeout(() => setJustReleased(null), 6_000);
    } catch (err) {
      console.error("[OrphanedTVsBanner] release error:", err);
      toast.error("Error al liberar TVs", {
        description: "Intenta de nuevo o recarga la página.",
      });
    } finally {
      setIsReleasing(false);
    }
  };

  // ── Success state (after release) ──────────────────────────────────────────
  if (justReleased !== null) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl border",
          "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
          "animate-in fade-in slide-in-from-top-1 duration-300",
          className
        )}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="text-xs font-semibold">
          {justReleased > 0
            ? `${justReleased} TV${justReleased !== 1 ? "s" : ""} liberada${justReleased !== 1 ? "s" : ""} — listas para reasignar`
            : "No había TVs bloqueadas"}
        </span>
      </div>
    );
  }

  // ── Nothing to show ────────────────────────────────────────────────────────
  if (!isLoading && orphanedCount === 0) return null;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading && orphanedCount === 0) {
    return (
      <div
        className={cn(
          "h-10 rounded-xl bg-muted/30 border border-border animate-pulse",
          className
        )}
      />
    );
  }

  // ── Alert banner ───────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-xl border",
        "bg-amber-500/10 border-amber-500/30",
        "animate-in fade-in slide-in-from-top-1 duration-400",
        className
      )}
    >
      {/* Icon + badge */}
      <div className="relative shrink-0">
        <Tv className="h-4 w-4 text-amber-400" />
        <span
          className={cn(
            "absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full",
            "bg-amber-500 text-[8px] font-black text-black",
            "flex items-center justify-center",
            "animate-bounce"
          )}
        >
          {orphanedCount > 9 ? "9+" : orphanedCount}
        </span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
          <p className="text-xs font-bold text-amber-300 truncate">
            {orphanedCount === 1
              ? "1 habitación con cochero fuera de turno"
              : `${orphanedCount} habitaciones con cochero fuera de turno`}
          </p>
        </div>
        <p className="text-[10px] text-amber-500/70 mt-0.5 hidden sm:block">
          Tareas de TV asignadas a cocheros que ya salieron — requieren reasignación
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchCount}
          disabled={isLoading || isReleasing}
          className="h-7 w-7 p-0 text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10"
          title="Refrescar conteo"
        >
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
        </Button>

        <Button
          size="sm"
          onClick={handleRelease}
          disabled={isReleasing}
          className={cn(
            "h-7 px-3 text-[10px] font-black uppercase tracking-widest",
            "bg-amber-500 hover:bg-amber-400 text-black border-0",
            "shadow-[0_0_12px_rgba(245,158,11,0.3)]",
            "transition-all duration-200",
            isReleasing && "opacity-60 cursor-not-allowed"
          )}
        >
          {isReleasing ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            "Liberar TVs"
          )}
        </Button>
      </div>
    </div>
  );
}
