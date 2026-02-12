"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function ToastProvider() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme as "light" | "dark" | "system"}
      position="top-right"
      richColors
      closeButton
      visibleToasts={5}
      gap={12}
      toastOptions={{
        style: {
          background: "hsl(var(--background))",
          border: "2px solid hsl(var(--border))",
          color: "hsl(var(--foreground))",
          fontSize: "1.15rem",
          lineHeight: "1.5",
          padding: "20px 24px",
          maxWidth: "520px",
          minHeight: "72px",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)",
          borderLeft: "5px solid hsl(var(--primary))",
        },
        className: "!text-lg",
      }}
      style={{
        // @ts-ignore
        '--toast-close-button-start': '0',
        '--toast-close-button-end': '0',
      }}
    />
  );
}

