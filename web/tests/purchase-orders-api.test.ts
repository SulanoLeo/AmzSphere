import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/require-user", () => ({
  requireAllowedUser: vi.fn(async () => ({ email: "mock@amzsphere.local", isApprover: true })),
}));

import { POST as createPurchaseOrder } from "@/app/api/purchase-orders/route";
import { readMockState, resetMockState } from "@/lib/mock-state";
import { requireAllowedUser } from "@/lib/require-user";

const request = (body: unknown) =>
  ({
    json: async () => body,
  }) as Request;

async function responseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

beforeEach(() => {
  resetMockState();
  vi.mocked(requireAllowedUser).mockResolvedValue({
    email: "mock@amzsphere.local",
    isApprover: true,
  });
});

describe("POST /api/purchase-orders", () => {
  it("creates a mock purchase-order draft for a known product", async () => {
    const product = readMockState().products[0];
    const response = await createPurchaseOrder(
      request({ product_asin: product.asin, units: 24 }),
    );
    if (!response) throw new Error("Purchase-order route did not return a response");

    expect(response.status).toBe(201);
    const body = await responseJson<{ id: string; product_asin: string; units: number; status: string }>(response);
    expect(body).toMatchObject({
      product_asin: product.asin,
      units: 24,
      status: "draft",
    });
    expect(body.id).toMatch(/^po-/);
    expect(readMockState().purchase_orders.some((order) => order.id === body.id)).toBe(true);
  });

  it("rejects invalid quantities", async () => {
    const product = readMockState().products[0];
    const response = await createPurchaseOrder(
      request({ product_asin: product.asin, units: 0 }),
    );
    if (!response) throw new Error("Purchase-order route did not return a response");

    expect(response.status).toBe(422);
  });

  it("returns not found for an unknown product", async () => {
    const response = await createPurchaseOrder(
      request({ product_asin: "B000000000", units: 24 }),
    );
    if (!response) throw new Error("Purchase-order route did not return a response");

    expect(response.status).toBe(404);
  });
});
