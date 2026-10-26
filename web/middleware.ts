import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, getRateLimitKey, cleanupRateLimitStore } from "@/lib/rate-limit";

// Cleanup expired entries periodically (best effort in serverless).
let lastCleanup = 0;

export function middleware(request: NextRequest) {
  const now = Date.now();
  if (now - lastCleanup > 60 * 1000) {
    cleanupRateLimitStore();
    lastCleanup = now;
  }

  const { pathname } = request.nextUrl;

  // Apply rate limiting only to API routes.
  if (pathname.startsWith("/api/")) {
    const key = getRateLimitKey(request.headers);
    const result = rateLimit(key);
    if (!result.allowed) {
      return NextResponse.json(
        { detail: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((result.reset - now) / 1000)) } },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
