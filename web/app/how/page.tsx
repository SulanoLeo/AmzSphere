"use strict";

/* How AmzSphere works — mirrors the mock /how view. One shared product record
   drives every page: catalog → optimize → approval → publish → all pages reflect
   the update. Live keeps its Next.js/FastAPI/Celery stack and real data layer. */
export default function HowPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <section className="panel mb-5">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">How AmzSphere works</h2>
            <div className="panel-subtitle">One shared product record drives every page: catalog → optimize → approval → publish → all pages reflect the update.</div>
          </div>
          <span className="category-pill">System guide</span>
        </div>
        <div className="panel-content">
          <section className="panel mb-4">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Single source of truth: products</h2>
                <div className="panel-subtitle">Every page reads and writes one product record. The flow is the same in mock and in the later SP-API swap.</div>
              </div>
              <span className="category-pill">Shared product record</span>
            </div>
            <div className="panel-content">
              <div className="flow-steps">
                <div className="flow-step">
                  <span className="flow-number">01</span>
                  <div>
                    <div className="flow-title">Add or sync a product</div>
                    <div className="flow-copy">Import by ASIN/SKU from the catalog or create manually. Sync upserts by ASIN + marketplace (idempotent, re-runnable) and records each run in the activity log.</div>
                  </div>
                  <span className="flow-endpoint">POST /api/products · POST /api/sync</span>
                </div>
                <div className="flow-step">
                  <span className="flow-number">02</span>
                  <div>
                    <div className="flow-title">Score every listing</div>
                    <div className="flow-copy">Deterministic rules score 0–100 on title length/keywords, bullets, images, description, backend keywords, and suppression. Score below 70 flags needs_optimization with human-readable issues.</div>
                  </div>
                  <span className="flow-endpoint">scoring.compute_opt_score</span>
                </div>
                <div className="flow-step">
                  <span className="flow-number">03</span>
                  <div>
                    <div className="flow-title">Draft an optimization</div>
                    <div className="flow-copy">Side-by-side current vs suggested copy (title, bullets, keywords, description). Saving creates a product_revision with status draft_ready or pending_approval; nothing touches Amazon until approved.</div>
                  </div>
                  <span className="flow-endpoint">POST /api/products/{'{'}id{'}'}/optimize</span>
                </div>
                <div className="flow-step">
                  <span className="flow-number">04</span>
                  <div>
                    <div className="flow-title">Approve or reject</div>
                    <div className="flow-copy">Approvals shows pending revisions with a before/after diff. Approve applies the changes to the shared product, sets opt_status=published, recomputes the score, updates marketplace listings to Live & In Sync, and logs the publish. Reject returns the product to needs_optimization.</div>
                  </div>
                  <span className="flow-endpoint">POST /api/approvals/{'{'}id{'}'}/approve|reject</span>
                </div>
                <div className="flow-step">
                  <span className="flow-number">05</span>
                  <div>
                    <div className="flow-title">Every page reflects the update</div>
                    <div className="flow-copy">After any write, the product query invalidates so the catalog table, Overview cards, Inventory, Pricing, and Activity Log all refresh without a manual reload.</div>
                  </div>
                  <span className="flow-endpoint">invalidateProducts()</span>
                </div>
                <div className="flow-step">
                  <span className="flow-number">06</span>
                  <div>
                    <div className="flow-title">Execution guard</div>
                    <div className="flow-copy">Nothing is written to Amazon (or the mock "Amazon") without an approved revision. Mock mode only — no real Amazon calls, no credentials, no secrets.</div>
                  </div>
                  <span className="flow-endpoint">approval-required writes</span>
                </div>
              </div>
            </div>
          </section>

          <section className="section-grid equal">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Product model</h2>
                  <div className="panel-subtitle">One table shared by catalog, inventory, pricing, approvals, and activity log</div>
                </div>
              </div>
              <div className="panel-content">
                <div className="rule-line"><span className="status approved">Identity</span><span>id, asin, sku, marketplace_id, source (amazon_sync \| manual)</span></div>
                <div className="rule-line"><span className="status approved">Listing</span><span>title, bullets[], description, backend_keywords, images[], price</span></div>
                <div className="rule-line"><span className="status approved">Inventory</span><span>sellable_units, days_of_supply</span></div>
                <div className="rule-line"><span className="status approved">Optimization</span><span>opt_score (0–100), opt_status, opt_issues[], last_optimized_at</span></div>
                <div className="rule-line"><span className="status approved">Sync</span><span>last_synced_at, sync_status</span></div>
                <div className="rule-line"><span className="status approved">Revisions</span><span>product_id, field changes before/after, status, created_by, created_at</span></div>
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">opt_status enum</h2>
                  <div className="panel-subtitle">needs_optimization → draft_ready → pending_approval → approved → published → optimized</div>
                </div>
              </div>
              <div className="panel-content">
                <div className="rule-line"><span className="status warn">needs_optimization</span><span>Score &lt; 70 · appears in optimization priority list</span></div>
                <div className="rule-line"><span className="status pending">draft_ready</span><span>Saved draft awaiting submission</span></div>
                <div className="rule-line"><span className="status pending">pending_approval</span><span>Awaiting human approver decision</span></div>
                <div className="rule-line"><span className="status approved">approved</span><span>Revision applied · published to catalog</span></div>
                <div className="rule-line"><span className="status good">published</span><span>Score recomputed · listings Live &amp; In Sync</span></div>
                <div className="rule-line"><span className="status good">optimized</span><span>Score ≥ 70 · no open issues</span></div>
              </div>
            </section>
            <section className="panel insight-panel">
              <div className="panel-content">
                <div className="insight-tag">Mock mode · visual simulation</div>
                <blockquote className="insight-quote">Live won’t run without SP-API credentials, PostgreSQL, Redis, and Google OAuth.</blockquote>
                <p className="insight-body">The Next.js/FastAPI/Celery scaffold keeps the same product model and endpoints; only the sync source swaps from the mock catalog to real SP-API Listings/Catalog/FBA Inventory calls when credentials are added.</p>
                <div className="recommendation"><strong>Safety boundary</strong><br />All data here is mock. Approval actions are not authenticated yet; keep hosted access private.</div>
              </div>
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}
