"use strict";

/* Listing approvals — mirrors the mock /approvals view.
   Pending revisions (before/after diff + approve/reject) and purchase workflows. */
export default function ApprovalsPage() {
  const revisions: Array<{ id: string; product_id: string; field_changes: Record<string, { before: unknown; after: unknown }>; created_at: string }> = [];
  const orders: Array<{ id: string; product_name: string; supplier: string; category: string; units: number; amount: number; status: string; reason: string; reviewed_by?: string }> = [];
  const approvalFilter = "all";

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <section className="panel mb-5">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Listing approvals</h2>
            <div className="panel-subtitle">Review optimization drafts before they are applied to the shared product record and republished to the mock Amazon catalog.</div>
          </div>
          <span className="category-pill">Administration</span>
        </div>
        <div className="panel-content">
          <div className="metrics metrics-five">
            <Metric label="Awaiting decision" value={String(revisions.length)} detail="Revisions require an approver before publishing" accent="orange" tag="PENDING" />
            <Metric label="Approved drafts" value={String(revisions.filter((r) => false).length)} detail="Approved revisions are published to mock Amazon" accent="teal" tag="PUBLISHED" />
            <Metric label="Rejected drafts" value={String(revisions.filter((r) => false).length)} detail="Rejected drafts return the product to needs optimization" accent="orange" tag="REJECTED" />
            <Metric label="Reviewed by" value="Manager" detail="Active approver" accent="blue" tag="MANAGER PROFILE" />
          </div>

          <section className="panel mb-5">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Pending revisions</h2>
                <div className="panel-subtitle">Before/after diff per listing field · approving writes to the product and its marketplace listings</div>
              </div>
            </div>
            <div className="panel-content">
              <div className="table-wrap">
                <table className="mock-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Field changes (before → after)</th>
                      <th>Submitted</th>
                      <th>Manager action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revisions.length ? revisions.map((revision) => {
                      const changeRows = Object.entries(revision.field_changes || {}).map(([field, change]) => (
                        <tr key={field} className="border-t border-line">
                          <td className="diff-label">{field}</td>
                          <td className="diff-before">{Array.isArray(change.before) ? change.before.join(" | ") : change.before === "" ? "—" : String(change.before)}</td>
                          <td className="diff-arrow">→</td>
                          <td className="diff-after">{Array.isArray(change.after) ? change.after.join(" | ") : change.after === "" ? "—" : String(change.after)}</td>
                        </tr>
                      ));
                      return (
                        <tr key={revision.id} className="border-t border-line">
                          <td>{revision.id}</td>
                          <td>{changeRows || <span className="product-meta">No field changes</span>}</td>
                          <td className="tabular-nums">{revision.created_at}</td>
                          <td className="action-row">
                            <button className="button button-approve button-sm" type="button" onClick={() => {}} data-approve-rev={revision.id}>Approve</button>
                            <button className="button button-deny button-sm" type="button" onClick={() => {}} data-reject-rev={revision.id}>Reject</button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={4} className="empty-cell" style={{padding: 18}}>No listing revisions are awaiting approval.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Purchase workflows</h2>
                <div className="panel-subtitle">{orders.length} purchase workflows shown · Manager is the active approver</div>
              </div>
              <div className="filter-group" role="group" aria-label="Filter purchase workflows">
                {["pending", "approved", "denied", "all"].map((filter) => (
                  <button
                    key={filter}
                    className={`filter-button ${approvalFilter === filter ? "active" : ""}`}
                    type="button"
                    data-approval-filter={filter}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-content">
              <div className="table-wrap">
                <table className="mock-table">
                  <thead>
                    <tr>
                      <th>Workflow</th>
                      <th>Supplier</th>
                      <th className="tabular-nums">Quantity</th>
                      <th className="tabular-nums">Amount</th>
                      <th>Status / reason</th>
                      <th>Manager action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length ? orders.map((order) => (
                      <tr key={order.id} className="border-t border-line">
                        <td><span className="order-id">{order.id}</span><div className="product-meta">{order.product_name}</div></td>
                        <td><div className="product-name">{order.supplier}</div><div className="product-meta">{order.category}</div></td>
                        <td className="tabular-nums">{order.units} units</td>
                        <td className="price tabular-nums">${order.amount.toFixed(2)}</td>
                        <td>
                          <div className="status-pill">{order.status}</div>
                          <div className="product-meta">{order.reason}</div>
                        </td>
                        <td className="action-row">
                          {order.status === "pending" ? (
                            <>
                              <button className="button button-approve button-sm" type="button" onClick={() => {}} data-decision="approve" data-order-id={order.id}>Approve</button>
                              <button className="button button-deny button-sm" type="button" onClick={() => {}} data-decision="deny" data-order-id={order.id}>Deny</button>
                            </>
                          ) : (
                            <span className="product-meta">{order.reviewed_by || "Reviewed"}</span>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="empty-cell" style={{padding: 18}}>No workflows in this view.</td></tr>
                    )}
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
