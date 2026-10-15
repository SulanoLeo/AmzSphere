import { auth } from "@/auth";

export default auth((request) => {
  if (!request.auth) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return Response.redirect(signInUrl);
  }
  const email = request.auth.user?.email?.trim().toLowerCase();
  const allowed = (process.env.WEB_ALLOWED_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!email || !allowed.includes(email)) return Response.redirect(new URL("/unauthorized", request.url));
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|signin|unauthorized).*)"],
};