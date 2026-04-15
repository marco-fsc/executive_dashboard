import { NextResponse } from "next/server";

// Note: Next.js Middleware runs in the Edge Runtime. Auth.js/NextAuth session
// validation is done in the Server Component for /dashboard.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
