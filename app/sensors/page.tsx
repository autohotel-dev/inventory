"use client";

import { SensorsTable } from "@/components/sensors/sensors-table";
import { RoleGuard } from "@/components/auth/role-guard";
import { Radio } from "lucide-react";

export default function SensorsPage() {
    return (
        <RoleGuard requireAdmin>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                            <Radio className="h-8 w-8 text-blue-600" />
                            Gestión de Sensores
                        </h1>
                        <p className="text-muted-foreground">
                            Configura los sensores Zigbee de las habitaciones (Smart Life / Tuya)
                        </p>
                    </div>
                </div>

                <SensorsTable />
            </div>
        </RoleGuard>
    );
}
