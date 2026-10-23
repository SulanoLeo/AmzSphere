"use client";

import { useEffect, useState } from "react";
import { ClientProductProvider } from "@/lib/provider/client";
import type { Product } from "@/lib/provider/types";

function Metric({ label, value, detail, accent, tag }: { label: string; value: string; detail: string; accent: string; tag?: string }) {
  return (
    <section className={`metric ${accent === "green" || accent === "teal" || accent === "blue" || accent === "warn" ? "" : ""}`}>
      <div className="metric-label"><span>{label}</span>{tag && <span className="mini-tag">{tag}</span>}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{detail}</div>
      <div className={`metric-accent ${accent}`}></div>
    </section>
  );
}

export default function RepricerPage() {
  const provider = new ClientProductProvider();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setLoading(true);
      try {
        const payload = await provider.getProducts();
        if (active) setProducts(payload.products);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load repricer data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProducts();
    return () => { active = false; };
  }, [provider]);

  const last_updated = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <section className="panel mb-5">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Repricer monitor</h2>
            <div className="panel-subtitle">Competitive offers refresh every 10 seconds with a protected minimum margin floor.</div>
          </div>
          <span className="category-pill">Pricing intelligence</span>
        </div>
        <div className="panel-content">
          {error && <div role="alert" className="mb-4 flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950">{error}</div>}
          <div className="metrics metrics-five">
            <Metric label="Offers monitored" value={String(products.length)} detail="Competitor prices fluctuate each cycle" accent="teal" tag="ACTIVE RULES" />
            <Metric label="Floor protection" value="100%" detail="No price can be set below your configured floor" accent="green" tag="GUARDRAIL" />
            <Metric label="Matched offers" value={String(products.filter((p) => p.price <= p.competitor_price).length)} detail="Priced at or below current competition" accent="orange" tag="BUY BOX POSITION" />
            <Metric label="Last market update" value={last_updated} detail="Competitor movement · $0.10–$1.50" accent="blue" tag="10-SECOND LOOP" />
          </div>

          <section className="panel mb-5">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Live offer monitor</h2>
                <div className="panel-subtitle">Price moves only when a competitor is below your offer and above your floor</div>
              </div>
              <span className="category-pill">Floor protected</span>
            </div>
            <div className="panel-content">
              <div className="table-wrap">
                <table className="mock-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="tabular-nums">Your price</th>
                      <th className="tabular-nums">Live payout margin %</th>
                      <th className="tabular-nums">Competitor</th>
                      <th className="tabular-nums">Min floor</th>
                      <th>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={6} className="empty-cell" style={{padding:18}}>Loading offers…</td></tr> : products.length ? products.map((product) => {
                      const gap = product.price - product.competitor_price;
                      const position = gap <= 0 ? <span className="status good">At or below market</span> : <span className="status warn">Price opportunity</span>;
                      const headroom = product.price - product.min_floor;
                      return (
                        <tr key={product.asin} className="border-t border-line">
                          <td><div className="product-name">{product.name}</div><div className="product-meta"><span className="asin">{product.asin}</span> · {product.sku}</div></td>
                          <td><div className="price">${product.price.toFixed(2)}</div><div className="sub-price">Your offer</div></td>
                          <td><span className="status pending">—</span></td>
                          <td><div className="price">${product.competitor_price.toFixed(2)}</div><div className="sub-price">Lowest competitor</div></td>
                          <td><div className="price">${product.min_floor.toFixed(2)}</div><div className="sub-price">${headroom.toFixed(2)} headroom</div></td>
                          <td>{position}</td>
                        </tr>
                      );
                    }) : <tr><td colSpan={6} className="empty-cell" style={{padding:18}}>No offers monitored yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Repricing guardrail</h2>
                <div className="panel-subtitle">One-cent Buy Box strategy with minimum price protection</div>
              </div>
            </div>
            <div className="panel-content"><div className="note">
              When the lowest competitor falls below your offer but remains above your configured minimum floor, the simulator reprices to one cent below that offer. If the competitor breaches the floor, your offer is held. All changes are recorded in the activity log.
            </div></div>
          </section>
        </div>
      </section>
    </main>
  );
}
