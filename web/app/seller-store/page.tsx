"use strict";

import { useState } from "react";

/* Seller Store — mirrors the mock /seller-store view. */
export default function SellerStorePage() {
  const sellerStore: Array<{ id: string; name: string; sku: string; asin: string; price: number; stock: number; category: string; visible: boolean }> = [];
  const catalogNotAdded: Array<{ asin: string; name: string; sku: string }> = [];
  const [sellerStoreAddAsin, setSellerStoreAddAsin] = useState("");

  const products = sellerStore;
  const visible = products.filter((p) => p.visible);
  const hidden = products.filter((p) => !p.visible);
  const addOptions = catalogNotAdded.map((p) => `<option value="${escapeHtml(p.asin)}">${escapeHtml(p.name)} (${escapeHtml(p.sku)})</option>`).join("");

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <section className="panel mb-5">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Seller Store</h2>
            <div className="panel-subtitle">Products listed and visible on your seller storefront.</div>
          </div>
          <span className="category-pill">Marketplace</span>
        </div>
        <div className="panel-content">
          <div className="metrics metrics-five">
            <Metric label="Listed products" value={String(products.length)} detail={`${visible.length} visible · ${hidden.length} hidden`} accent="blue" tag="SELLER STORE" />
            <Metric label="Visible products" value={String(visible.length)} detail="Live on storefront" accent="green" tag="VISIBLE" />
            <Metric label="Hidden products" value={String(hidden.length)} detail={hidden.length ? "Not shown to shoppers" : "All products visible"} accent="orange" tag="HIDDEN" />
          </div>

          <section className="panel mb-5">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Add product to seller store</h2>
                <div className="panel-subtitle">Select from your catalog to list on the storefront</div>
              </div>
            </div>
            <div className="panel-content">
              <div className="catalog-controls">
                <label className="form-label">Catalog product</label>
                <div style={{position:"relative",width:"100%",maxWidth:420}}>
                  <select id="seller-store-add-select" className="w-full h-32 rounded-md border border-line px-3 font-normal outline-none focus:border-teal-700 bg-white" value={sellerStoreAddAsin} onChange={(e)=>setSellerStoreAddAsin(e.target.value)}>
                    {catalogNotAdded.map((p) => (<option key={p.asin} value={p.asin}>{p.name} ({p.sku})</option>))}
                  </select>
                </div>
                <div style={{marginTop:10}}><button className="button button-primary" type="button" disabled={!sellerStoreAddAsin}>{sellerStoreAddAsin ? `Selected: ${sellerStoreAddAsin}` : "Add to seller store"}</button></div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Products on seller store</h2>
                <div className="panel-subtitle">Toggle visibility to show/hide items from shoppers</div>
              </div>
            </div>
            <div className="panel-content">
              <div className="table-wrap">
                <table className="mock-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="tabular-nums">Price</th>
                      <th className="tabular-nums">Stock</th>
                      <th>Category</th>
                      <th>Visibility</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length ? products.map((product) => (
                      <tr key={product.id} className="border-t border-line">
                        <td>
                          <div className="product-name">{product.name}</div>
                          <div className="product-meta">{product.sku} · <span className="asin">{product.asin}</span></div>
                        </td>
                        <td className="tabular-nums">${product.price.toFixed(2)}</td>
                        <td className="tabular-nums">{product.stock.toFixed(1)} units</td>
                        <td className="product-meta">{product.category}</td>
                        <td>{product.visible ? <span className="status good">Visible</span> : <span className="status warn">Hidden</span>}</td>
                        <td className="action-row"><button className={`button ${product.visible ? "button-deny" : "button-approve"}`} type="button" data-seller-toggle={product.id}>{product.visible ? "Hide" : "Show"}</button></td>
                      </tr>
                    )) : <tr><td colSpan={6} className="empty-cell" style={{padding:18}}>No products listed yet. Add products from your catalog.</td></tr>}
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

function escapeHtml(text: string) { return text.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c] || c); }
