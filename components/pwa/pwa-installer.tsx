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
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Verificar si fue rechazado anteriormente (solo por 24 horas)
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      setIsDismissed(hoursSinceDismissed < 24); // Solo considerar rechazado si hace menos de 24 horas
    }
    
    // Registrar service worker inmediatamente
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('SW registrado: ', registration);
          }
          // Forzar update check
          registration.update();
        })
        .catch((registrationError) => {
          console.error('SW registro falló: ', registrationError);
        });
    }

    // Detectar si ya está instalado (múltiples métodos)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isStandaloneIOS = (window.navigator as any).standalone === true;
    const isStandaloneChrome = window.matchMedia('(display-mode: minimal-ui)').matches;
    
    if (isStandalone || isStandaloneIOS || isStandaloneChrome) {
      setIsInstalled(true);
    }

    // Escuchar evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
      if (process.env.NODE_ENV === 'development') {
        console.log('Evento beforeinstallprompt detectado');
      }
    };

    // Escuchar cuando se instala la app
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      localStorage.removeItem('pwa-install-dismissed');
      if (process.env.NODE_ENV === 'development') {
        console.log('PWA instalada exitosamente');
      }
    };

    // Forzar detección después de 2 segundos
    const timer = setTimeout(() => {
      if (!deferredPrompt && !isInstalled && !isDismissed) {
        setShowInstallPrompt(true);
        if (process.env.NODE_ENV === 'development') {
          console.log('Mostrando prompt manual después de timeout');
        }
      }
    }, 2000);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, [deferredPrompt, isInstalled, isDismissed]);

  const handleInstallClick = async () => {
    // Detectar si es iOS
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    if (!deferredPrompt) {
      // Si no hay prompt automático, mostrar instrucciones manuales
      if (isIOS) {
        alert(`Para instalar en iPhone/iPad:\n\n1. Toca el botón Compartir ⬆️ en la parte inferior de Safari\n2. Desliza hacia abajo y toca "Agregar a pantalla de inicio" ➕\n3. Toca "Agregar" en la esquina superior derecha\n\nLa app aparecerá en tu pantalla de inicio.`);
      } else if (isAndroid) {
        alert(`Para instalar en Android:\n\n1. Toca el menú ⋮ en la parte superior derecha de Chrome\n2. Selecciona "Instalar aplicación" o "Agregar a pantalla de inicio"\n3. Confirma la instalación\n\nLa app se instalará automáticamente.`);
      } else {
        // Para desktop
        alert(`Para instalar en Desktop:\n\n1. En Chrome/Edge, busca el ícono de instalación ⬇️ en la barra de dirección\n2. Toca "Instalar"\n3. Confirma la instalación\n\nO usa Ctrl+Shift+I → Application → Manifest → Install.`);
      }
      return;
    }

    try {
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
    } catch (error) {
      console.error('Error durante la instalación:', error);
      // Fallback a instrucciones manuales
      alert('Error al instalar. Por favor, usa las instrucciones manuales para tu dispositivo.');
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // No renderizar en servidor
  if (!isMounted) {
    return null;
  }

  // Detectar si es móvil
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  // No mostrar si ya está instalado
  if (isInstalled) {
    return null;
  }

  // Si es iOS, siempre mostrar instrucciones manuales (no soporta beforeinstallprompt)
  if (isIOS && !isDismissed) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <Card className="shadow-lg border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Instalar en iPhone/iPad
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
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong>Paso 1:</strong> Toca el botón <strong>Compartir</strong> <span className="text-primary">⬆️</span> en la parte inferior del navegador
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Paso 2:</strong> Desliza hacia abajo y toca <strong>"Agregar a pantalla de inicio"</strong> <span className="text-primary">➕</span>
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Paso 3:</strong> Toca <strong>"Agregar"</strong> en la esquina superior derecha
              </p>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              ✓ Acceso offline • ✓ Notificaciones • ✓ Acceso rápido
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si es Android y no hay prompt automático, mostrar instrucciones
  if (isAndroid && !showInstallPrompt && !isDismissed) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <Card className="shadow-lg border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Instalar App Android
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
              Para instalar: Toca el menú <strong>⋮</strong> → "Agregar a pantalla de inicio" o "Instalar aplicación"
            </p>
            <div className="text-xs text-muted-foreground">
              ✓ Acceso offline • ✓ Notificaciones • ✓ Acceso rápido
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Para desktop o si hay prompt disponible, siempre mostrar botón de instalación
  if (!isDismissed) {
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

  // No mostrar si fue descartado
  return null;
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

  if (!isPWA) return <></>;

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
