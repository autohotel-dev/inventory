import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sistema de Inventario - Gestión Eficiente",
  description: "Sistema completo de gestión de inventario con control de stock, ventas, compras y escáner de códigos de barras.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="container mx-auto px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">📦</span>
            <span className="text-xl font-bold text-foreground">Inventory System</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/auth/login" 
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Iniciar Sesión
            </Link>
            <Link 
              href="/dashboard" 
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            Sistema de Inventario
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Gestiona tu inventario de manera eficiente con nuestro sistema completo. 
            Control de stock, ventas, compras y más.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/dashboard" 
              className="px-8 py-4 bg-primary text-primary-foreground text-lg font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Comenzar Ahora
            </Link>
            <Link 
              href="/auth/login" 
              className="px-8 py-4 border-2 border-primary text-primary text-lg font-semibold rounded-lg hover:bg-accent transition-colors"
            >
              Iniciar Sesión
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-card p-6 rounded-xl border shadow-sm">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                Control de Stock
              </h3>
              <p className="text-muted-foreground">
                Monitorea tu inventario en tiempo real con alertas de stock mínimo
              </p>
            </div>
            
            <div className="bg-card p-6 rounded-xl border shadow-sm">
              <div className="text-3xl mb-4">🛒</div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                Ventas y Compras
              </h3>
              <p className="text-muted-foreground">
                Gestiona órdenes de venta y compra con seguimiento completo
              </p>
            </div>
            
            <div className="bg-card p-6 rounded-xl border shadow-sm">
              <div className="text-3xl mb-4">📱</div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                Escáner de Códigos
              </h3>
              <p className="text-muted-foreground">
                Escanea códigos de barras para agilizar tus operaciones
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 mt-16 border-t border-border">
        <div className="text-center text-muted-foreground">
          <p>&copy; 2024 Sistema de Inventario. Desarrollado por Ricardo Minor.</p>
        </div>
      </footer>
    </div>
  );
}
