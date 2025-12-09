"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X, Zap, Wifi, Bell, Share, Plus, MoreVertical } from "lucide-react";

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
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Verificar si fue rechazado anteriormente (solo por 24 horas)
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      setIsDismissed(hoursSinceDismissed < 24);
    }
    
    // Registrar service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          registration.update();
        })
        .catch((error) => {
          console.error('SW registro falló: ', error);
        });
    }

    // Detectar si ya está instalado
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
    };

    // Escuchar cuando se instala la app
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      localStorage.removeItem('pwa-install-dismissed');
    };

    // Mostrar después de 2 segundos
    const timer = setTimeout(() => {
      if (!isInstalled && !isDismissed) {
        setShowInstallPrompt(true);
      }
    }, 2000);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, [isInstalled, isDismissed]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
      } catch (error) {
        setShowInstructions(true);
      }
    } else {
      setShowInstructions(true);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // No renderizar en servidor
  if (!isMounted || isInstalled || isDismissed || !showInstallPrompt) {
    return null;
  }

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  // Modal de instrucciones
  if (showInstructions) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setShowInstructions(false)} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div 
            className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-5 py-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Smartphone className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Instalar App</h3>
                  <p className="text-xs text-white/60">
                    {isIOS ? "iPhone / iPad" : isAndroid ? "Android" : "Desktop"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="absolute top-3 right-3 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Instrucciones */}
            <div className="p-5 space-y-4">
              {isIOS ? (
                <>
                  <Step number={1} icon={<Share className="h-4 w-4" />} color="blue">
                    Toca el botón <strong>Compartir</strong> en la barra inferior
                  </Step>
                  <Step number={2} icon={<Plus className="h-4 w-4" />} color="purple">
                    Selecciona <strong>"Agregar a inicio"</strong>
                  </Step>
                  <Step number={3} icon={<Download className="h-4 w-4" />} color="emerald">
                    Toca <strong>"Agregar"</strong> para confirmar
                  </Step>
                </>
              ) : isAndroid ? (
                <>
                  <Step number={1} icon={<MoreVertical className="h-4 w-4" />} color="blue">
                    Toca el menú <strong>⋮</strong> en Chrome
                  </Step>
                  <Step number={2} icon={<Download className="h-4 w-4" />} color="purple">
                    Selecciona <strong>"Instalar app"</strong>
                  </Step>
                  <Step number={3} icon={<Smartphone className="h-4 w-4" />} color="emerald">
                    Confirma la instalación
                  </Step>
                </>
              ) : (
                <>
                  <Step number={1} icon={<Download className="h-4 w-4" />} color="blue">
                    Busca el ícono <strong>⊕</strong> en la barra de dirección
                  </Step>
                  <Step number={2} icon={<Smartphone className="h-4 w-4" />} color="purple">
                    Haz clic en <strong>"Instalar"</strong>
                  </Step>
                  <Step number={3} icon={<Zap className="h-4 w-4" />} color="emerald">
                    ¡Listo! La app se abrirá automáticamente
                  </Step>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowInstructions(false)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-sm font-medium transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Banner principal
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-72 overflow-hidden">
        {/* Header compacto */}
        <div className="relative px-4 py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Download className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm">Instalar App</h3>
              <p className="text-[10px] text-white/50">Acceso rápido y offline</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1.5 rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Features */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <Feature icon={<Zap className="h-3.5 w-3.5" />} color="amber" label="Acceso instantáneo" />
            <Feature icon={<Wifi className="h-3.5 w-3.5" />} color="emerald" label="Modo offline" />
            <Feature icon={<Bell className="h-3.5 w-3.5" />} color="blue" label="Alertas" />
          </div>
        </div>

        {/* Botones */}
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={handleInstallClick}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-medium transition-all shadow-lg shadow-purple-500/20"
          >
            Instalar
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm transition-colors"
          >
            Luego
          </button>
        </div>
      </div>
    </div>
  );
}

// Componente de paso para instrucciones
function Step({ number, icon, color, children }: { 
  number: number; 
  icon: React.ReactNode; 
  color: "blue" | "purple" | "emerald";
  children: React.ReactNode;
}) {
  const colors = {
    blue: "from-blue-500 to-blue-600 shadow-blue-500/20",
    purple: "from-purple-500 to-purple-600 shadow-purple-500/20",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-500/20",
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center shadow-lg flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 pt-1">
        <p className="text-sm text-white/80">{children}</p>
      </div>
    </div>
  );
}

// Componente de feature
function Feature({ icon, color, label }: { 
  icon: React.ReactNode; 
  color: "amber" | "emerald" | "blue";
  label: string;
}) {
  const colors = {
    amber: "text-amber-400 bg-amber-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-400 bg-blue-500/10",
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`p-1 rounded ${colors[color]}`}>
        {icon}
      </div>
      <span className="text-[10px] text-white/50">{label}</span>
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

  if (!isPWA) return <></>;

  return (
    <div className="fixed bottom-4 right-4 z-40">
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
