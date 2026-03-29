import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";
// Temporarily disabled next-intl imports
// import createMiddleware from 'next-intl/middleware';
// import { locales } from './i18n-config';

// Create the internationalization middleware
// const intlMiddleware = createMiddleware({
//   locales,
//   defaultLocale: 'es',
//   localePrefix: 'never' // Never add locale prefix to URLs
// });

export async function middleware(request: NextRequest) {
  // For now, just handle Supabase session for all routes
  // TODO: Re-enable i18n when configuration is fixed
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - Next.js internals (_next)
     * - Static files (images, fonts, etc.)
     * - API routes
     */
    "/((?!_next|api|favicon.ico|sw.js|manifest.json|manifest.webmanifest|icon.svg|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json|woff|woff2|ttf|otf)$).*)",
  ],
};
