import assert from "node:assert";

const BASE = "http://127.0.0.1:8000";

async function json(path, init = {}) {
  const headers = { Accept: "application/json", ...init.headers };
  if (init.body && !(init.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const ct = res.headers.get("content-type") || "";
  let body;
  if (ct.includes("application/json")) body = await res.json();
  else throw new Error(`non-JSON response for ${path}: ${await res.text()}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  // 1. Overview populates after sync
  const summary = await json("/api/overview/summary");
  assert.ok(summary.catalog_items >= 30, `catalog_items ${summary.catalog_items}`);
  assert.ok(summary.needs_optimization >= 1, "needs_optimization >= 1");
  assert.ok(Array.isArray(summary.top_10) && summary.top_10.length === 10, "top_10 ranked list");
  console.log("overview:", JSON.stringify({ catalog_items: summary.catalog_items, sellable_units: summary.sellable_units, reorder_flags: summary.reorder_flags, pending_approvals: summary.pending_approvals, needs_optimization: summary.needs_optimization }));

  // 2. Idempotent sync
  const s1 = await json("/api/sync", { method: "POST" });
  assert.strictEqual(s1.status, "completed");
  const s2 = await json("/api/sync", { method: "POST" });
  assert.strictEqual(s2.products_synced, 30);
  const state = await json("/api/state");
  assert.strictEqual(state.products.length, 30, "sync must be idempotent (no duplicates)");
  console.log("sync idempotent:", s2.products_synced, "products, state.products =", state.products.length);

  // 3. Pick a needs_optimization product
  const products = await json("/api/products?opt_status=needs_optimization&page_size=200");
  assert.ok(products.products.length >= 1);
  const target = products.products[0];
  const before = await json(`/api/products/${target.id}`);
  assert.strictEqual(before.product.opt_status, "needs_optimization");
  console.log("target:", target.sku, target.asin, "score", before.product.opt_score);

  // 4. Optimize → draft sent to approval
  const suggested = {
    title: `${target.name || target.title} — Premium Everyday Essential`,
    bullets: ["Premium build quality for everyday use.", "Simple to set up and care for.", "Designed for home and office routines.", "Backed by straightforward support.", "Practical choice for reliable daily use."],
    backend_keywords: [(target.sku || "").toLowerCase(), "premium", "everyday", "home office"],
    description: `A reliable ${(target.name || target.title).toLowerCase()} for everyday home and office use.`,
  };
  const result = await json(`/api/products/${target.id}/optimize`, {
    method: "POST",
    body: JSON.stringify({ suggested }),
  });
  assert.strictEqual(result.revision.status, "pending_approval");
  assert.strictEqual(result.product.opt_status, "draft_ready");
  console.log("optimize → revision", result.revision.status, "product", result.product.opt_status);

  // 5. Approve → applied, published, repopulates everywhere
  const decided = await json(`/api/approvals/${result.revision.id}/approve`, { method: "POST" });
  assert.strictEqual(decided.revision.status, "approved");
  assert.strictEqual(decided.product.opt_status, "published");
  const after = await json(`/api/products/${target.id}`);
  assert.strictEqual(after.product.title, suggested.title);
  assert.strictEqual(after.product.bullets.length, suggested.bullets.length);
  const listing = (await json("/api/state")).marketplace_listings.find((l) => l.global_product_id === target.asin && l.platform === "Amazon US");
  assert.strictEqual(listing.title, suggested.title);
  console.log("approve → product", after.product.opt_status, "score", after.product.opt_score, "listing updated:", listing.title.slice(0, 40));

  // 6. All pages reflect without reload: overview counts, activity log
  const summary2 = await json("/api/overview/summary");
  assert.strictEqual(summary2.needs_optimization, summary.needs_optimization - 1);
  assert.strictEqual(summary2.pending_approvals, 0);
  const activity = (await json("/api/state")).activity;
  const approvalEvent = activity.find((event) => event.category === "approval" && event.title.includes("approved"));
  assert.ok(approvalEvent, "activity log records the approval/publish");
  console.log("overview after:", "needs_optimization", summary2.needs_optimization, "| pending_approvals", summary2.pending_approvals, "| approval event:", approvalEvent.title);

  // 7. Manual add + reject flow coverage
  const created = await json("/api/products", {
    method: "POST",
    body: JSON.stringify({ name: "E2E Test Lamp", sku: "E2E-LAMP-01", asin: "B0E2ETEST1", price: 19.99, stock: 120, daily_velocity: 4 }),
  });
  assert.strictEqual(created.product.source, "manual");
  const listed = await json("/api/products?search=E2E&page_size=200");
  assert.ok(listed.products.find((p) => p.sku === "E2E-LAMP-01"));
  const optimize2 = await json(`/api/products/${created.product.id}/optimize`, { method: "POST", body: JSON.stringify({ suggested: { title: "t", bullets: [], backend_keywords: [], description: "" } }) });
  const rejected = await json(`/api/approvals/${optimize2.revision.id}/reject`, { method: "POST" });
  assert.strictEqual(rejected.revision.status, "rejected");
  const afterReject = await json(`/api/products/${created.product.id}`);
  assert.strictEqual(afterReject.product.opt_status, "needs_optimization");
  console.log("manual add + reject flow OK; product back to", afterReject.product.opt_status);

  // 8. Error handling: bad route returns JSON, not HTML
  try {
    await json("/api/products/does-not-exist");
    assert.fail("should have thrown");
  } catch (error) {
    assert.ok(error.message.includes("404"), error.message);
    console.log("unknown route returns JSON 404:", error.message);
  }

  console.log("\nALL E2E CHECKS PASSED");
}

main().then(() => process.exit(0)).catch((error) => { console.error("E2E FAILED:", error.message); process.exit(1); });
