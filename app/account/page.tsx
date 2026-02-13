import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountForm } from "@/components/account/account-form";
import { SecurityForm } from "@/components/account/security-form";

export default function AccountPage() {
    return (
        <div className="container mx-auto py-10 space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Mi Cuenta</h2>
                <p className="text-muted-foreground">
                    Administra la configuración de tu cuenta y preferencias.
                </p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="profile">Perfil</TabsTrigger>
                    <TabsTrigger value="security">Seguridad</TabsTrigger>
                </TabsList>
                <TabsContent value="profile" className="space-y-6">
                    <AccountForm />
                </TabsContent>
                <TabsContent value="security" className="space-y-6">
                    <SecurityForm />
                </TabsContent>
            </Tabs>
        </div>
    );
}
