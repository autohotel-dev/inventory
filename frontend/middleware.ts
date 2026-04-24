import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";
import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n-config';

// Create the internationalization middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'es',
  localePrefix: 'never' // Never add locale prefix to URLs
});

export async function middleware(request: NextRequest) {
  // First run intl middleware to handle locales and get the initial response
  const intlResponse = intlMiddleware(request);

  // Then handle Supabase session for all routes, passing the intl response
  return await updateSession(request, intlResponse);
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
