"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, X, KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/use-user-role";

interface AuthorizationGateProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onAuthorized: () => void;
  onClose: () => void;
}

/**
 * Modal de autorización que solicita el código temporal de emergencia
 * generado desde el dashboard ejecutivo (EmergencyCodeViewer).
 * 
 * Admins y managers pasan automáticamente (no necesitan código).
 * Recepcionistas y otros roles deben ingresar el código de 4 dígitos.
 * 
 * El código se valida contra system_config.emergency_code y
 * system_config.emergency_code_expires_at.
 */
export function AuthorizationGate({
  isOpen,
  title = "Autorización Requerida",
  description = "Ingresa el código de autorización proporcionado por tu supervisor.",
  onAuthorized,
  onClose,
}: AuthorizationGateProps) {
  const [code, setCode] = useState(["", "", "", ""]);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { isAdmin, isManager } = useUserRole();

  // Si es admin o manager, autorizar automáticamente
  useEffect(() => {
    if (isOpen && (isAdmin || isManager)) {
      setChecking(false);
      onAuthorized();
    } else if (isOpen) {
      setChecking(false);
    }
  }, [isOpen, isAdmin, isManager, onAuthorized]);

  // Reset state cuando se abre
  useEffect(() => {
    if (isOpen) {
      setCode(["", "", "", ""]);
      setError(null);
      setValidating(false);
      // Focus the first input after a short delay
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  const handleDigitChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);

    // Auto-advance to next input
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits are entered
    if (digit && index === 3 && newCode.every(d => d !== "")) {
      validateCode(newCode.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      const newCode = pasted.split("");
      setCode(newCode);
      inputRefs.current[3]?.focus();
      validateCode(pasted);
    }
  };

  const validateCode = async (fullCode: string) => {
    setValidating(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("system_config")
        .select("emergency_code, emergency_code_expires_at")
        .limit(1)
        .single();

      if (fetchError || !data) {
        setError("Error al validar. Intenta de nuevo.");
        return;
      }

      // Check if there's an active code
      if (!data.emergency_code || !data.emergency_code_expires_at) {
        setError("No hay código activo. Solicítalo a tu supervisor.");
        return;
      }

      // Check expiration
      const expiresAt = new Date(data.emergency_code_expires_at);
      if (expiresAt <= new Date()) {
        setError("El código ha expirado. Solicita uno nuevo.");
        return;
      }

      // Validate code
      if (data.emergency_code !== fullCode) {
        setError("Código incorrecto");
        setCode(["", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
        return;
      }

      // Success! 
      toast.success("Autorización exitosa", {
        description: "Código validado correctamente.",
        duration: 2000,
      });
      onAuthorized();

    } catch (err) {
      console.error("Error validating code:", err);
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setValidating(false);
    }
  };

  if (!isOpen || checking) return null;
  // If admin/manager, this component auto-authorizes and never renders
  if (isAdmin || isManager) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-background border border-white/10 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header gradient */}
        <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
        
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/15 rounded-xl">
                <ShieldCheck className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Code input */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                disabled={validating}
                className={`
                  w-14 h-16 text-center text-2xl font-mono font-bold
                  bg-slate-800/50 border-2 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-amber-500/50
                  transition-all duration-200
                  ${error ? "border-red-500/50 text-red-400" : digit ? "border-amber-500/50 text-amber-400" : "border-white/10 text-white"}
                  ${validating ? "opacity-50" : ""}
                `}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="text-center text-sm text-red-400 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
              {error}
            </div>
          )}

          {/* Loading indicator */}
          {validating && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando...
            </div>
          )}

          {/* Help text */}
          <div className="text-center text-xs text-muted-foreground bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <KeyRound className="h-3.5 w-3.5 inline mr-1.5 text-amber-500/60" />
            Solicita el código temporal al administrador o gerente en turno.
          </div>
        </div>
      </div>
    </div>
  );
}
