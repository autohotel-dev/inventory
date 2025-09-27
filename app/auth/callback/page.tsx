import { Suspense } from "react";
import AuthCallbackContent from "./auth-callback-content";

export default function AuthCallback() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}

function AuthCallbackFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    </div>
  );
}
