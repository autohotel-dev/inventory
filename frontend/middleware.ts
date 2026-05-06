import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Authentication is now handled by AWS Cognito (Amplify)
  // Protected routes should check session client-side or via server components.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|sw.js|manifest.json|manifest.webmanifest|icon.svg|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json|woff|woff2|ttf|otf)$).*)",
  ],
};
