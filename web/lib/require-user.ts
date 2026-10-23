import { NextResponse } from "next/server";

import { auth } from "@/auth";

export function requireSameOrigin(request: Request) {
  if (process.env.AMZ_DATA_MODE === "mock") return null;
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.json({ detail: "Origin header is required." }, { status: 403 });
  try {
    if (new URL(origin).origin !== new URL(process.env.AUTH_URL || "http://localhost:3000").origin) {
      return NextResponse.json({ detail: "Cross-origin request rejected." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ detail: "Invalid request origin." }, { status: 403 });
  }
  return null;
}

export async function requireAllowedUser(requiredRole?: "approver") {
  if (process.env.AMZ_DATA_MODE === "mock") {
    return { email: "mock@amzsphere.local", isApprover: true };
  }

  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return { response: NextResponse.json({ detail: "Authentication required" }, { status: 401 }) };

  const allowedEmails = (process.env.WEB_ALLOWED_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowedEmails.length) {
    return { response: NextResponse.json({ detail: "WEB_ALLOWED_EMAILS must be configured" }, { status: 503 }) };
  }
  if (!allowedEmails.includes(email)) {
    return { response: NextResponse.json({ detail: "User is not authorized for this workspace" }, { status: 403 }) };
  }
  const approverEmails = (process.env.WEB_APPROVER_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const isApprover = approverEmails.includes(email);
  if (requiredRole === "approver" && !isApprover) {
    return { response: NextResponse.json({ detail: "Approver permission is required" }, { status: 403 }) };
  }
  return { email, isApprover };
}
