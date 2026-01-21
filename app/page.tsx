import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, BedDouble, BarChart3, Smartphone, Zap, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Luxor Manager - Gestión Hotelera Inteligente",
  description: "Plataforma integral para la administración de Auto Hotel Luxor. Control de habitaciones, POS, inventarios y reportes en tiempo real.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12">
              <Image src="/luxor-logo.png" alt="Luxor Logo" fill sizes="48px" className="object-contain" />
            </div>
            <span className="text-xl font-bold tracking-tight">Luxor Manager</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost" className="hidden sm:inline-flex">Iniciar Sesión</Button>
            </Link>
            <Link href="/dashboard">
              <Button>Ir al Dashboard</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-24">
        {/* Hero Section */}
        <section className="container mx-auto px-6 py-20 text-center space-y-8">
          <div className="mx-auto w-56 h-56 relative mb-8 animate-in zoom-in duration-500">
            <Image src="/luxor-logo.png" alt="Luxor Logo" fill sizes="224px" className="object-contain drop-shadow-2xl" />
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent pb-2">
              El Futuro de la Gestión Hotelera
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
              Control total de habitaciones, ventas y personal en una sola plataforma.
              Rápido, seguro y diseñado para <span className="font-semibold text-foreground">Auto Hotel Luxor</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link href="/dashboard">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg hover:shadow-primary/25 transition-all hover:scale-105">
                Acceder al Sistema <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full">
                Iniciar Sesión
              </Button>
            </Link>
          </div>

          {/* Stats / Trust */}
          <div className="pt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto opacity-80">
            <div className="flex flex-col items-center gap-2">
              <Clock className="h-8 w-8 text-blue-500" />
              <span className="font-bold text-2xl">Tiempo Real</span>
              <span className="text-sm text-muted-foreground">Sincronización Inmediata</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <ShieldCheck className="h-8 w-8 text-green-500" />
              <span className="font-bold text-2xl">100% Seguro</span>
              <span className="text-sm text-muted-foreground">Auditoría Completa</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Zap className="h-8 w-8 text-yellow-500" />
              <span className="font-bold text-2xl">Ultra Rápido</span>
              <span className="text-sm text-muted-foreground">PWA Optimizada</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Smartphone className="h-8 w-8 text-purple-500" />
              <span className="font-bold text-2xl">Móvil First</span>
              <span className="text-sm text-muted-foreground">Gestión Remota</span>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="bg-muted/30 py-24">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Feature 1 */}
              <div className="group relative overflow-hidden rounded-3xl bg-background border p-8 hover:border-primary/50 transition-colors shadow-sm hover:shadow-xl">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform">
                  <BedDouble className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Control de Habitaciones</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Tablero interactivo con estados en tiempo real (Libre, Ocupada, Sucia).
                  Control de tiempos de estancia y alertas automáticas.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group relative overflow-hidden rounded-3xl bg-background border p-8 hover:border-primary/50 transition-colors shadow-sm hover:shadow-xl">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mb-6 text-green-600 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Finanzas y Reportes</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Cierres de caja detallados, reportes de ingresos diarios y control de inventario.
                  Todo lo que necesitas para tomar decisiones.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group relative overflow-hidden rounded-3xl bg-background border p-8 hover:border-primary/50 transition-colors shadow-sm hover:shadow-xl">
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-6 text-purple-600 group-hover:scale-110 transition-transform">
                  <Smartphone className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold mb-3">App Móvil Nativa</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Lleva el control en tu bolsillo. Nueva interfaz optimizada para celulares
                  con barra de navegación y chat de soporte integrado.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 bg-background">
        <div className="container mx-auto px-6 text-center text-muted-foreground">
          <p className="text-sm">
            © {new Date().getFullYear()} Auto Hotel Luxor Manager. Todos los derechos reservados.
          </p>
          <div className="mt-4 flex justify-center gap-4 text-xs">
            <Link href="#" className="hover:text-foreground">Soporte</Link>
            <Link href="#" className="hover:text-foreground">Privacidad</Link>
            <Link href="#" className="hover:text-foreground">Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
