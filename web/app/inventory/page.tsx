"use strict";

/* Inventory hub — mirrors the mock /inventory view.
   Stock cover, sales velocity, and purchase-order drafts. */
export default function InventoryPage() {
  const products: Array<{ asin: string; sku: string; name: string; stock: number; daily_velocity: number; opt_score?: number; opt_status?: string; po_draft_id?: string }> = [];
  const purchaseOrders: Array<{ id: string; product_asin: string; product_name: string; supplier: string; units: number; status: string }> = [];
  const lowStock = products.filter((p) => (p.stock / Math.max(p.daily_velocity || 1, 1)) < 15);
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalVelocity = products.reduce((sum, p) => sum + p.daily_velocity, 0);
  const mockUnitCost: Record<string, number> = {};

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <section className="panel mb-5">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Inventory hub</h2>
            <div className="panel-subtitle">Stock cover, sales velocity, and purchase-order drafts in one place.</div>
          </div>
        </div>
        <div className="panel-content">
          {lowStock.length && (
            <div className="critical-strip">
              <span className="critical-mark">!</span>
              <div>
                <div className="critical-title">{lowStock.length} critical replenishment {lowStock.length === 1 ? "alert" : "alerts"}</div>
                <div className="critical-detail">
                  {lowStock.map((product) => `${product.name} · ${((product.stock / Math.max(product.daily_velocity || 1, 1)) || 0).toFixed(1)} days of supply`).join("   /   ")}<br />A purchase order draft is generated automatically when coverage falls below 15 days.
                </div>
              </div>
            </div>
          )}
          <div className="metrics metrics-five">
            <Metric label="Units on hand" value={String(totalStock)} detail={`${products.length} active catalog products`} accent="blue" tag="SELLABLE STOCK" />
            <Metric label="Daily sales velocity" value={String(totalVelocity)} detail="Units sold per day across the portfolio" accent="teal" tag="30-DAY AVERAGE" />
            <Metric label="Critical products" value={String(lowStock.length)} detail={lowStock.length ? "Below 15 days of supply" : "No immediate replenishment risk"} accent="orange" tag="AUTO-ALERT" />
            <Metric label="PO drafts" value={String(purchaseOrders.length)} detail="Generated from inventory coverage rules" accent="green" tag="PROCUREMENT" />
          </div>

          <section className="section-grid mb-5">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Stock coverage outlook</h2>
                  <div className="panel-subtitle">Projected inventory depletion · next 30 days</div>
                </div>
                <span className="category-pill">Units on hand</span>
              </div>
              <div className="panel-content"><div className="h-64 w-full">
                <div className="grid h-full place-items-center text-sm text-muted">No inventory history ingested yet.</div>
              </div></div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Purchase order drafts</h2>
                  <div className="panel-subtitle">Created automatically below 15 days of supply</div>
                </div>
                <span className="category-pill">{purchaseOrders.length} drafts</span>
              </div>
              <div className="panel-content"><div className="po-list">
                {purchaseOrders.length ? purchaseOrders.map((po) => {
                  const unitCost = mockUnitCost[po.product_asin];
                  const capital = unitCost === undefined ? "Unit cost not set" : `$${(po.units * unitCost).toFixed(2)}`;
                  const product = products.find((item) => item.asin === po.product_asin);
                  const sku = product ? product.sku : "";
                  const queued = false;
                  return (
                    <div key={po.id} className="po-row po-card">
                      <div>
                        <div className="po-name">{po.product_name}</div>
                        <div className="po-meta">{po.supplier} · {po.units} units · {po.status}</div>
                        <div className="po-total">Total Capital Required: <strong>{capital}</strong></div>
                      </div>
                      <div className="po-actions">
                        <span className="po-id">{po.id}</span>
                        <button className={`button ${queued ? "" : "button-primary"}`} type="button" data-send-po disabled={queued || !sku}>
                          {queued ? "In Procurement Queue" : "Send to Procurement Queue"}
                        </button>
                      </div>
                    </div>
                  );
                }) : <div className="empty-state">No replenishment drafts yet.</div>}
              </div></div>
            </div>
          </section>

          <section className="panel mb-5">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Inventory by product</h2>
                <div className="panel-subtitle">Days of supply = on-hand stock ÷ daily sales velocity</div>
              </div>
            </div>
            <div className="panel-content">
              <div className="table-wrap">
                <table className="mock-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Stock cover</th>
                      <th>Velocity</th>
                      <th style={{width:140}}>Optimization</th>
                      <th>Risk status</th>
                      <th>PO draft</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length ? products.map((product) => {
                      const days = product.stock / Math.max(product.daily_velocity || 1, 1);
                      const fill = Math.min(100, (days / 45) * 100);
                      const tone = days < 15 ? "warn" : days < 30 ? "pending" : "good";
                      return (
                        <tr key={product.asin} className="border-t border-line">
                          <td>
                            <div className="product-name">{product.name}</div>
                            <div className="product-meta">{product.sku} · <span className="asin">{product.asin}</span></div>
                          </td>
                          <td>
                            <div className="stock-cell">
                              <div className="stock-number"><span>{product.stock} units</span><span>{days.toFixed(1)}d</span></div>
                              <div className="stock-track"><div className={`stock-fill ${tone}`} style={{width:`${fill}%`}}></div></div>
                            </div>
                          </td>
                          <td className="number-cell">{product.daily_velocity} / day</td>
                          <td className="tabular-nums score-cell">{product.opt_score ?? 0} <span className={`status-mini ${product.opt_status ? "status warn" : "status"}`}>{product.opt_status || "—"}</span></td>
                          <td>{days < 15 ? <span className="status warn">Critical</span> : days < 30 ? <span className="status pending">Watch</span> : <span className="status good">Healthy</span>}</td>
                          <td>{product.po_draft_id ? <span className="order-id">{product.po_draft_id}</span> : <span className="product-meta">No draft</span>}</td>
                        </tr>
                      );
                    }) : <tr><td colSpan={6} className="empty-cell" style={{padding: 18}}>No products in catalog.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

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
