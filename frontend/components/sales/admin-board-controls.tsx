"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { resetAllRooms } from "@/app/actions/reset-board";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/use-user-role";

export function AdminBoardControls() {
    const [isLoading, setIsLoading] = useState(false);
    const { isAdmin } = useUserRole();

    if (!isAdmin) return null;

    const handleReset = async () => {
        try {
            setIsLoading(true);
            const result = await resetAllRooms();

            if (result.success) {
                toast.success("Tablero reiniciado", {
                    description: "Todas las habitaciones se han liberado."
                });
            } else {
                toast.error("Error", {
                    description: result.error
                });
            }
        } catch (error) {
            toast.error("Error inesperado");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    disabled={isLoading}
                >
                    <RotateCcw className="h-4 w-4" />
                    <span className="hidden sm:inline">Reiniciar Tablero</span>
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <ShieldAlert className="h-5 w-5" />
                        ¿Estás completamente seguro?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <p>
                                Esta acción <strong>liberará todas las habitaciones</strong> inmediatamente.
                            </p>
                            <ul className="list-disc list-inside">
                                <li>Se finalizarán todas las estancias activas.</li>
                                <li>Las habitaciones pasarán a estado LIBRE.</li>
                                <li>No se procesarán cobros pendientes (deberán gestionarse manualmente si aplica).</li>
                            </ul>
                            <p className="font-medium text-foreground">
                                Úsalo solo para corregir errores graves en el estado del tablero.
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleReset();
                        }}
                        disabled={isLoading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isLoading ? "Reiniciando..." : "Sí, reiniciar todo"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
