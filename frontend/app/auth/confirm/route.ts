import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const username = searchParams.get("username");
  let next = searchParams.get("next") ?? "/";

  // Prevent open redirect vulnerabilities
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/";
  }

  if (code && username) {
    try {
      // Cognito confirmation is handled client-side via Amplify
      // This route now simply redirects after email verification link click
      redirect(next);
    } catch {
      redirect(`/auth/error?error=Verification failed`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=No confirmation code or username`);
}
