import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n-config";

// Create the internationalization middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "never", // Never add locale prefix to URLs
});

export async function middleware(request: NextRequest) {
  // First, handle Supabase session for all routes
  const response = await updateSession(request);

  // If the request was redirected by the Supabase middleware, return it early
  if (response.headers.get("Location")) {
    return response;
  }

  // Then run the internationalization middleware
  const intlResponse = intlMiddleware(request);

  // Merge Supabase cookies into the final internationalization response
  // This ensures both intl cookies (like NEXT_LOCALE) and Supabase auth cookies are preserved.
  const supabaseCookies = response.cookies.getAll();
  supabaseCookies.forEach(({ name, value, ...options }) => {
    intlResponse.cookies.set({ name, value, ...options });
  });

  return intlResponse;
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
