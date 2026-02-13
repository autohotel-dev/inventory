import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountForm } from "@/components/account/account-form";
import { SecurityForm } from "@/components/account/security-form";
import { User, Shield, Bell, CreditCard } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function AccountPage() {
    return (
        <div className="container max-w-6xl mx-auto py-10 space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Configuración de Cuenta</h2>
                <p className="text-muted-foreground mt-2 text-lg">
                    Gestiona tu información personal, seguridad y preferencias del sistema.
                </p>
                <Separator className="my-6" />
            </div>

            <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-8">
                <aside className="md:w-1/4">
                    <TabsList className="flex flex-col h-auto w-full items-stretch bg-transparent p-0 space-y-1">
                        <TabsTrigger
                            value="profile"
                            className="justify-start px-4 py-3 h-auto text-sm font-medium transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-md hover:bg-muted"
                        >
                            <User className="mr-2 h-4 w-4" />
                            Perfil General
                        </TabsTrigger>
                        <TabsTrigger
                            value="security"
                            className="justify-start px-4 py-3 h-auto text-sm font-medium transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-md hover:bg-muted"
                        >
                            <Shield className="mr-2 h-4 w-4" />
                            Seguridad
                        </TabsTrigger>
                        {/* Future tabs placeholders */}
                        <TabsTrigger
                            value="notifications"
                            disabled
                            className="justify-start px-4 py-3 h-auto text-sm font-medium opacity-50 cursor-not-allowed"
                        >
                            <Bell className="mr-2 h-4 w-4" />
                            Notificaciones
                        </TabsTrigger>
                        <TabsTrigger
                            value="billing"
                            disabled
                            className="justify-start px-4 py-3 h-auto text-sm font-medium opacity-50 cursor-not-allowed"
                        >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Facturación
                        </TabsTrigger>
                    </TabsList>
                </aside>

                <div className="flex-1 md:max-w-2xl">
                    <TabsContent value="profile" className="m-0 space-y-6 animate-in fade-in-50 slide-in-from-left-5 duration-300 ease-in-out">
                        <div className="mb-6">
                            <h3 className="text-lg font-medium">Perfil de Usuario</h3>
                            <p className="text-sm text-muted-foreground">
                                Tu información visible y datos básicos.
                            </p>
                        </div>
                        <AccountForm />
                    </TabsContent>

                    <TabsContent value="security" className="m-0 space-y-6 animate-in fade-in-50 slide-in-from-left-5 duration-300 ease-in-out">
                        <div className="mb-6">
                            <h3 className="text-lg font-medium">Seguridad</h3>
                            <p className="text-sm text-muted-foreground">
                                Actualiza tu contraseña y protege tu cuenta.
                            </p>
                        </div>
                        <SecurityForm />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
