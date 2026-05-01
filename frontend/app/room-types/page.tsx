"use client";

import { RoomTypesTable } from "@/components/room-types/room-types-table";
import { RoleGuard } from "@/components/auth/role-guard";


export default function RoomTypesPage() {
    return (
        <RoleGuard requireAdmin>
            <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                            Tipos de Habitación
                        </h1>
                        <p className="text-muted-foreground">
                            Gestiona los tipos de habitación, precios y duraciones.
                        </p>
                    </div>
                </div>

                <RoomTypesTable />
            </div>
        </RoleGuard>
    );
}
