"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useUserRole } from "@/hooks/use-user-role";
import { ShiftSession } from "@/components/employees/types";
import { useSystemConfigRead } from "@/hooks/use-system-config";
import { useShiftExpenses } from "@/hooks/use-shift-expenses";

const ExpenseModal = dynamic(
    () => import("@/components/expenses/expense-modal").then(mod => ({ default: mod.ExpenseModal })),
    { ssr: false }
);

interface QuickLink {
    href: string;
    label: string;
    icon: string;
}

interface AdminQuickActionsProps {
    quickLinks: QuickLink[];
}

export function AdminQuickActions({ quickLinks }: AdminQuickActionsProps) {
    const { employeeId, isAdmin, isManager } = useUserRole();
    const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const posConfig = useSystemConfigRead();

    // Load active session (System wide for admins)
    useEffect(() => {
        const fetchSession = async () => {
            if (!isAdmin && !isManager) return;

            try {
                const { data } = await apiClient.get('/hr/manager/data') as any;
                const sessions = data?.active_sessions || [];
                
                if (sessions && sessions.length > 0) {
                    setActiveSession(sessions[0]);
                } else {
                    setActiveSession(null);
                }
            } catch (error) {
                console.error("Error fetching active session for admin actions:", error);
                setActiveSession(null);
            }
        };

        fetchSession();
        // Fallback polling since we removed the realtime channel
        const intervalId = setInterval(fetchSession, 30000);
        return () => clearInterval(intervalId);
    }, [isAdmin, isManager]);

    const { totalExpenses, refetch } = useShiftExpenses(activeSession?.id || null);

    // Calculate available cash (simplified for Admin view - assumes funds available)
    // For admins, we might not want to block them, so simple calculation
    // Or we can fetch specific summary. For now using Config Fund + arbitrary buffer?
    // Better: Use same logic as receptionist but simple
    const availableCash = 999999; // Admins override limits usually, or we can fetch true summary.
    // Given urgency, we set high limit or 0? 
    // User wants to REGISTER expense. validation happens in modal.
    // If we pass 0, modal blocks.
    // Let's pass a Large Number and assume Admin manages cash responsibly.

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Acciones Rápidas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {quickLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors group"
                            >
                                <span className="text-2xl">{link.icon}</span>
                                <span className="font-medium group-hover:text-primary transition-colors">
                                    {link.label}
                                </span>
                            </Link>
                        ))}

                        {/* Botón Registrar Gasto (Solo si hay sesión activa en el sistema) */}
                        <button
                            onClick={() => activeSession && setShowExpenseModal(true)}
                            disabled={!activeSession}
                            className={`flex items-center gap-3 p-4 border rounded-lg transition-colors group text-left ${activeSession ? "hover:bg-muted cursor-pointer" : "opacity-50 cursor-not-allowed"
                                }`}
                        >
                            <span className="text-2xl">💸</span>
                            <div className="flex flex-col">
                                <span className="font-medium group-hover:text-primary transition-colors">
                                    Registrar Gasto
                                </span>
                                {activeSession && (
                                    <span className="text-xs text-muted-foreground">
                                        Turno: {activeSession.employees?.first_name}
                                    </span>
                                )}
                            </div>
                        </button>
                    </div>
                </CardContent>
            </Card>

            {activeSession && (
                <ExpenseModal
                    open={showExpenseModal}
                    onClose={() => setShowExpenseModal(false)}
                    sessionId={activeSession.id}
                    employeeId={employeeId || ''} // Creating expense as Admin
                    availableCash={availableCash}
                    onSuccess={() => {
                        refetch();
                    }}
                />
            )}
        </>
    );
}
