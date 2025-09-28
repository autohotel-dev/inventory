"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Registrar service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('SW registrado: ', registration);
            }
          })
          .catch((registrationError) => {
            console.error('SW registro falló: ', registrationError);
          });
      });
    }

    // Detectar si ya está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Escuchar evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Escuchar cuando se instala la app
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      if (process.env.NODE_ENV === 'development') {
        console.log('PWA instalada');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (process.env.NODE_ENV === 'development') {
      if (outcome === 'accepted') {
        console.log('Usuario aceptó instalar la PWA');
      } else {
        console.log('Usuario rechazó instalar la PWA');
      }
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Guardar en localStorage que el usuario rechazó
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // No mostrar si ya está instalado o si el usuario ya rechazó
  if (isInstalled || !showInstallPrompt || localStorage.getItem('pwa-install-dismissed')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="shadow-lg border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Instalar App
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-4">
            Instala nuestra app para acceso rápido y funcionalidad offline
          </p>
          
          <div className="flex gap-2">
            <Button
              onClick={handleInstallClick}
              className="flex-1"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Instalar
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              size="sm"
            >
              Después
            </Button>
          </div>
          
          <div className="mt-3 text-xs text-muted-foreground">
            ✓ Acceso offline • ✓ Notificaciones • ✓ Acceso rápido
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook para detectar si es PWA
export function useIsPWA() {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    setIsPWA(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }, []);

  return isPWA;
}

// Componente para mostrar estado PWA en el dashboard
export function PWAStatus() {
  const isPWA = useIsPWA();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isPWA) return null;

  return (
    <div className="fixed top-4 right-4 z-40">
      <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-sm">
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs font-medium">
          {isOnline ? 'En línea' : 'Offline'}
        </span>
        <Smartphone className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  );
}
