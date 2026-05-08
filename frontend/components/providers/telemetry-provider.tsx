"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { telemetry } from '@/lib/telemetry';

function getModuleNameFromPath(pathname: string): string {
  if (pathname.startsWith('/operacion-en-vivo')) return 'Operación en Vivo';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/sales')) return 'Recepción / Ventas';
  if (pathname.startsWith('/movements')) return 'Inventario / Movimientos';
  if (pathname.startsWith('/settings')) return 'Configuración';
  // Add more mappings as needed
  return pathname.split('/')[1] || 'General';
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Track page views
  useEffect(() => {
    if (pathname) {
      telemetry.track({
        page: pathname,
        module: getModuleNameFromPath(pathname),
        action_type: 'PAGE_VIEW',
        action_name: 'Viewed Page',
      });
    }
  }, [pathname]);

  // Track global UI clicks
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Find the closest element with an explicit tracking id or submit action
      let target = e.target as HTMLElement | null;
      let interactiveElement = null;

      while (target && target !== document.body) {
        const tagName = target.tagName.toLowerCase();
        const type = target.getAttribute('type');
        
        // ONLY track elements explicitly marked for tracking, or form submit actions
        if (
          target.hasAttribute('data-track-id') ||
          (tagName === 'input' && type === 'submit') ||
          (tagName === 'button' && type === 'submit')
        ) {
          interactiveElement = target;
          break;
        }
        target = target.parentElement;
      }

      if (interactiveElement) {
        const dataTrackId = interactiveElement.getAttribute('data-track-id');
        const textContent = interactiveElement.innerText?.trim().substring(0, 50) 
                          || interactiveElement.getAttribute('aria-label') 
                          || 'Action';
        
        const actionName = dataTrackId || textContent;
        
        telemetry.track({
          page: window.location.pathname,
          module: getModuleNameFromPath(window.location.pathname),
          action_type: 'UI_CLICK',
          action_name: actionName,
        });
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });

    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, []);

  return <>{children}</>;
}
