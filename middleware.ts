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
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
