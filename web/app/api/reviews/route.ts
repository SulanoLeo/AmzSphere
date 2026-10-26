import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

const DEFAULT_SELLER_ID = "mock-seller";

function resolveSellerId(request: Request): string {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("seller_id");
    if (q) return q;
  } catch {}
  return DEFAULT_SELLER_ID;
}

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const state = readMockState();
  const { searchParams } = new URL(request.url);

  const product = searchParams.get("product") || undefined;
  const asin = searchParams.get("asin") || undefined;
  const minRating = searchParams.get("min_rating");
  const maxRating = searchParams.get("max_rating");
  const theme = searchParams.get("theme") || undefined;

  let reviews: any[] = (state.reviews || [])
    .filter((r: any) => String(r.seller_id || DEFAULT_SELLER_ID) === sellerId)
    .filter((r: any) => {
      if (product && String(r.product) !== product) return false;
      if (asin && String(r.asin) !== asin) return false;
      if (minRating !== null && minRating !== undefined && Number(r.rating) < Number(minRating)) return false;
      if (maxRating !== null && maxRating !== undefined && Number(r.rating) > Number(maxRating)) return false;
      if (theme && String(r.theme) !== theme) return false;
      return true;
    })
    .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));

  return NextResponse.json(
    reviews.map((r: any) => ({
      id: r.id,
      seller_id: r.seller_id,
      product: r.product,
      asin: r.asin,
      marketplace_id: r.marketplace_id,
      rating: Number(r.rating),
      date: r.date,
      theme: r.theme,
      text: r.text,
      customer_name: r.customer_name,
      verified_purchase: Boolean(r.verified_purchase),
      response: r.response,
      responded_at: r.responded_at,
    }))
  );
}
