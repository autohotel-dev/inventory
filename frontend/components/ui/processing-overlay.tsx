"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Printer, CreditCard, Home, Zap } from "lucide-react";

export interface ProcessingStep {
  label: string;
  icon?: "loader" | "printer" | "payment" | "room" | "checkin" | "done";
}

interface ProcessingOverlayProps {
  isVisible: boolean;
  steps?: ProcessingStep[];
  currentStep?: number;
  title?: string;
  /** Auto-cycle through steps with this interval in ms */
  autoCycleMs?: number;
}

const ICONS = {
  loader: Loader2,
  printer: Printer,
  payment: CreditCard,
  room: Home,
  checkin: Zap,
  done: CheckCircle2,
};

export function ProcessingOverlay({
  isVisible,
  steps,
  currentStep = 0,
  title = "Procesando",
  autoCycleMs,
}: ProcessingOverlayProps) {
  const [internalStep, setInternalStep] = useState(0);
  const [show, setShow] = useState(false);

  // Animate in/out
  useEffect(() => {
    if (isVisible) {
      setInternalStep(currentStep);
      // Small delay for mount animation
      requestAnimationFrame(() => setShow(true));
    } else {
      setShow(false);
      // Reset step after animation
      const t = setTimeout(() => setInternalStep(0), 300);
      return () => clearTimeout(t);
    }
  }, [isVisible, currentStep]);

  // Auto-cycle through steps
  useEffect(() => {
    if (!isVisible || !autoCycleMs || !steps || steps.length <= 1) return;
    const interval = setInterval(() => {
      setInternalStep((prev) => {
        const next = prev + 1;
        return next >= steps.length ? prev : next;
      });
    }, autoCycleMs);
    return () => clearInterval(interval);
  }, [isVisible, autoCycleMs, steps]);

  // Sync external step changes
  useEffect(() => {
    if (isVisible) setInternalStep(currentStep);
  }, [currentStep, isVisible]);

  if (!isVisible) return null;

  const activeStep = steps?.[internalStep];
  const iconKey = activeStep?.icon || "loader";
  const Icon = ICONS[iconKey] || Loader2;
  const label = activeStep?.label || title;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      style={{ backdropFilter: "blur(4px)" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80" />

      {/* Content */}
      <div
        className={`relative flex flex-col items-center gap-4 transition-all duration-300 ${
          show ? "scale-100 translate-y-0" : "scale-95 translate-y-2"
        }`}
      >
        {/* Spinner ring */}
        <div className="relative">
          {/* Outer pulse ring */}
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
          {/* Inner glow */}
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
            <Icon
              className={`h-7 w-7 text-primary ${iconKey !== "done" ? "animate-spin" : "animate-none"}`}
              style={iconKey !== "done" && iconKey !== "loader" ? { animation: "spin 2s linear infinite" } : undefined}
            />
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-1.5 max-w-[200px]">
          <p className="text-sm font-semibold text-foreground tracking-tight">
            {label}
          </p>

          {/* Step indicators */}
          {steps && steps.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i < internalStep
                      ? "w-1.5 bg-primary"
                      : i === internalStep
                      ? "w-6 bg-primary animate-pulse"
                      : "w-1.5 bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Subtle helper text */}
          <p className="text-[11px] text-muted-foreground/60">
            Por favor espera...
          </p>
        </div>
      </div>
    </div>
  );
}
