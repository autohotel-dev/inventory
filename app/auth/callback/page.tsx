import { Suspense } from "react";
import { AuthCallbackHandler } from "./auth-callback-handler";

export default function AuthCallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Suspense fallback={<LoadingFallback />}>
          <AuthCallbackHandler />
        </Suspense>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <>
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-muted-foreground">Cargando...</p>
    </>
  );
}
