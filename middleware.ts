import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n-config';

// Create the internationalization middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never' // Never add locale prefix to URLs
});

export async function middleware(request: NextRequest) {
  // First update session to handle auth
  const response = await updateSession(request);

  // Then handle i18n
  return intlMiddleware(request);
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
