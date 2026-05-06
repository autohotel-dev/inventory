import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  // Allow guest portal access ONLY with valid token in query params
  const pathname = request.nextUrl.pathname;
  const isGuestPortal = pathname.startsWith("/guest-portal");
  if (isGuestPortal) {
    const token = request.nextUrl.searchParams.get('token');
    if (token) {
      // Token validation happens in the page component
      return response;
    }
    // No token provided, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Bypass server-side Supabase auth check.
  // AWS Cognito session is maintained client-side via Amplify.
  return response;
}
