import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellers = [
    { id: "mock-seller", merchant_id: "Mock Seller", marketplace_id: "ATVPDKIKX0DER", region: "us-east-1" },
  ];
  return NextResponse.json(sellers);
}
