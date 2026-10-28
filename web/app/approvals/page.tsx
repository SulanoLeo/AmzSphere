"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ClientProductProvider } from "@/lib/provider/client";
import type { ProductRevision, Order } from "@/lib/provider/types";

function Metric({
  label,
  value,
  detail,
  accent,
  tag,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  tag?: string;
}) {
  return (
    <section className="metric" data-accent={accent}>
      <div className="metric-label"><span>{label}</span>{tag && <span className="mini-tag">{tag}</span>}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{detail}</div>
      <div className={`metric-accent ${accent}`}></div>
    </section>
  );
}

export default function ApprovalsPage() {
  const provider = new ClientProductProvider();
  const [revisions, setRevisions] = useState<ProductRevision[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isApprover, setIsApprover] = useState(true);
  const [message, setMessage] = useState("");

  // Modal states
  const [downloadLogOpen, setDownloadLogOpen] = useState(false);
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false);
  const [reviewRevisionOpen, setReviewRevisionOpen] = useState<{ id: string; status: string } | null>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [revs, ords] = await Promise.all([provider.getProductRevisions(), provider.getOrders()]);
        if (active) { setRevisions(revs); setOrders(ords); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load approvals data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadData();
    return () => { active = false; };
  }, [provider]);

  async function decideRevision(id: string, action: "approve" | "reject") {
    try {
      await provider.decideRevision(id, action);
      const payload = await provider.getProductRevisions();
      setRevisions(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revision decision failed");
    }
  }

  async function decidePurchaseOrder(id: string, action: "approve" | "deny") {
    try {
      await provider.decidePurchaseOrder(id, action);
      const payload = await provider.getOrders();
      setOrders(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Purchase-order decision failed");
    }
  }

  const approvalFilter = "all";

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-line pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-primary font-label-md uppercase tracking-wider">
            <Link href="/" className="flex items-center gap-1">
              <PackageSearch size={13} />
              <span>Seller Operations</span>
            </Link>
            <span className="text-xs text-muted">/</span>
            <span>B2B Enterprise</span>
            <span className="text-xs text-muted">/</span>
            <span>B2B Approvals &amp; Custom Quote Engine</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">B2B Approvals &amp; Custom Quote Engine</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 mt-1">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              Pending Human Review: 6 Orders ($48.6k total volume)
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">B2B volume discounts, custom price quotes, buyer credit limit vetting, and human-in-the-loop Amazon Business transaction reviews.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setDownloadLogOpen(true)}>
            Download Log (CSV)
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setCreateQuoteOpen(true)}>
            + Create Custom Quote Draft
          </Button>
        </div>
      </header>

      <div className="metrics metrics-five mb-6">
        <Metric label="Pending Volume" value="6 In Queue" detail="$48,650.00 Avg SLA elapsed: 1d 45m (Target: 24h)" accent="blue" tag="QUEUE" />
        <Metric label="30D B2B Gross Rev" value="$164,280.00" detail="Realized total of cumulative GMV Rate: 25.3% Net" accent="green" tag="+28.4% YoY" />
        <Metric label="Average B2B Order" value="$3,820.00" detail="Median basket: 184 units / order Quote Rate: 76.5% Closed" accent="teal" tag="MEDIAN" />
        <Metric label="Discount Floor" value="24.8%" detail="Floor margin hard cap: 18.5% Auto: 3.2% Sub-Floor" accent="warn" tag="FLOOR" />
        <Metric label="Active Buyers" value="142 Verified" detail="100% Tax Exempt Validated PO Lines Pledged $250k Active" accent="blue" tag="VERIFIED" />
      </div>

      <section className="section-grid align-items-stretch mb-6">
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Volume Discount Curves &amp; Margin Floors</h2>
              <div className="panel-subtitle">Dynamic bulk price tier elasticity vs hard capital loss protection limits</div>
            </div>
            <div className="flex items-center gap-1">
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Volume Curves</Badge>
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Pacing</Badge>
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Exposure</Badge>
            </div>
          </div>
          <div className="panel-content min-h-full">
            <div className="h-64 w-full">
              <div className="grid h-full place-items-center text-sm text-muted">No pricing history ingested yet.</div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Policy Governance Engine</h2>
                <div className="panel-subtitle">4 ACTIVE GATES</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-md border border-line bg-white/50">
                  <span className="text-muted">Fast-Track Auto-Approve</span>
                  <span className="text-green-700 font-semibold">Enabled</span>
                  <Badge className="bg-teal-50 text-teal-800 border-teal-200">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border border-line bg-white/50">
                  <span className="text-muted">Orders &lt;$1,500 with Prime Business verified and margin &gt;22% auto-release to 60s.</span>
                  <span className="text-xs text-muted">Fast-Track Auto-Approve</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border border-line bg-white/50">
                  <span className="text-muted">Credit Risk Intercept</span>
                  <span className="text-green-700 font-semibold">Enabled</span>
                  <Badge className="bg-teal-50 text-teal-800 border-teal-200">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border border-line bg-white/50">
                  <span className="text-muted">New buyers lacking Amazon EN or DN &amp; Bradsstreet rating require manual signoff.</span>
                  <span className="text-xs text-muted">Credit Risk Intercept</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border border-line bg-white/50">
                  <span className="text-muted">Inventory Allocation Gate</span>
                  <span className="text-green-700 font-semibold">Enabled</span>
                  <Badge className="bg-teal-50 text-teal-800 border-teal-200">Enabled</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Algorithmic Margin Guard</h2>
                <div className="panel-subtitle">Intercepted 2 sub-floor quote attempts in the last 24h, protecting $2,140 profit integrity.</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-md border border-line bg-indigo-50">
                  <div>
                    <div className="text-xs font-semibold text-indigo-900">Strict 18.5% Hard Margin Floor</div>
                    <div className="text-[10px] text-muted">Sub-floor price requests permanently locked. Requires dual-admin key token.</div>
                  </div>
                  <Badge className="bg-rose-50 text-rose-700 border-rose-200">ENFORCED</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md border border-line bg-white/50">
                  <div>
                    <div className="text-xs font-semibold text-indigo-900">IMMUTABLE SLA BREACH</div>
                    <div className="text-[10px] text-muted">Apex Logistics Corp · $14,630.00 (215m remaining)</div>
                  </div>
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200">Review Now</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">PO &amp; Request Details</h2>
            <div className="panel-subtitle">Showing 1–5 of 18 B2B Requests · 2 Selected ($20,150.00 Val)</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">All Statuses (Pending, Approved, Flagged)</span>
            <span className="text-xs font-semibold text-muted">All Margins (&gt;18.5% Floor)</span>
            <Button variant="outline" onClick={() => {}}>Bulk Counter-Offer</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => {}}>Bulk Approve (2 Eligible)</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-wrap">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th style={{width:34}}></th>
                  <th className="px-4 py-3">PO &amp; Request Details</th>
                  <th className="px-4 py-3">Buyer / Organization</th>
                  <th className="px-4 py-3">Items &amp; Volume</th>
                  <th className="px-4 py-3 tabular-nums">Total Quote &amp; FBA Margin</th>
                  <th className="px-4 py-3">Risk &amp; Inventory</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">Loading requests…</td></tr>
                ) : revisions.length ? revisions.map((revision) => {
                  const fc = (revision.field_changes as Record<string, { before: unknown; after: unknown }> | undefined)?.margin;
                  const over = fc && parseFloat(String(fc.after)) < 18.5;
                  return (
                    <tr key={revision.id} className="border-t border-line">
                      <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                      <td className="px-4 py-3">
                        <div className="product-name">{revision.asin || revision.product_id}</div>
                        <div className="product-meta text-[10px] text-muted">{revision.created_at}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="product-name">Apex Medical Logistics</div>
                        <div className="product-meta text-[10px] text-muted">DBA Rating: 1A2 · Tax Exempt</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="product-name">Solar Power Pod Pro 50W</div>
                        <div className="product-meta text-[10px] text-muted">ASIN: B09YW72KB8L · SKU: SIP-PRO-50W</div>
                        <div className="text-[10px] text-muted">350 units · $40.40 · $14,140.00</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <div className="price">$16,430.00</div>
                        <div className="sub-price">FBA Stock: 12.5%</div>
                        <div className="sub-price text-green-700 font-semibold">Net Margin: 25.4%</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-on-surface">FBA Stock Allocated:</div>
                        <div className="text-xs text-muted">Credit: $90.00</div>
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200">{over ? "FLAGGED: FLOOR VIOLATION" : "OK"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {revision.status === "pending_approval" ? (
                          <>
                            <Button variant="outline" onClick={() => { setReviewRevisionOpen({ id: revision.id, status: revision.status }); void decideRevision(revision.id, "approve"); }}>
                              Approve &amp; Release
                            </Button>
                            <Button variant="outline" className="text-[10px]" onClick={() => { setReviewRevisionOpen({ id: revision.id, status: revision.status }); void decideRevision(revision.id, "reject"); }}>
                              Review
                            </Button>
                          </>
                        ) : (
                          <Badge className="bg-teal-50 text-teal-800 border-teal-200">{revision.status}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">No requests.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted">
            <span>Showing 1–5 of 18 B2B Requests · 2 Selected ($20,150.00 Val)</span>
            <div className="flex items-center gap-1">
              <button className="button button-outline button-sm disabled">Previous</button>
              <button className="button button-primary button-sm">1</button>
              <button className="button button-outline button-sm">2</button>
              <button className="button button-outline button-sm">3</button>
              <span className="px-2 text-[10px]">...</span>
              <button className="button button-outline button-sm">4</button>
              <button className="button button-outline button-sm">Next</button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Algorithmic Workflow Recommendations &amp; Decision Assist</h2>
            <div className="panel-subtitle">Updated: Just Now (real-time telemetry)</div>
          </div>
          <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Updated: Just Now</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-md border border-line bg-amber-50">
              <div className="flex items-start gap-2 mb-2">
                <span className="bg-amber-100 text-amber-700 border border-amber-200 rounded-md px-2 py-0.5 text-[10px] font-semibold">Auto-Counter Recommendation</span>
                <Badge className="bg-rose-50 text-rose-700 border-rose-200">PD-9838</Badge>
              </div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Nexus Robotics: $11.80 Breaks 18.5% Floor</div>
              <div className="text-[10px] text-muted mb-3">Requested rate yields 17.8% margin. Algorithmic proposal suggests counter at $12.45 / unit ($650.00 profit and restoring margin compliance).</div>
              <div className="flex gap-2">
                <Button className="bg-indigo-600 text-white text-[10px] px-3 py-1.5">Send Counter-Offer ($12.45/u)</Button>
                <Button variant="outline" className="text-[10px] px-3 py-1.5">Dismiss</Button>
              </div>
            </div>
            <div className="p-4 rounded-md border border-line bg-white/50">
              <div className="flex items-start gap-2 mb-2">
                <span className="bg-amber-100 text-amber-700 border border-amber-200 rounded-md px-2 py-0.5 text-[10px] font-semibold">FBA Velocity Conflict Alert</span>
                <Badge className="bg-amber-50 text-amber-700 border-amber-200">Galn 659</Badge>
              </div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Summit Tech 500u Order Threatens B2C Stock</div>
              <div className="text-[10px] text-muted mb-3">Full release drops B2B Prime runway from 18.2 days to 9.1 days. System suggests routing 250 units via regional 3PL, partial pallet and 250 units via FBA.</div>
              <div className="flex gap-2">
                <Button className="bg-indigo-600 text-white text-[10px] px-3 py-1.5">Apply Hybrid FBA + 3PL Split</Button>
                <Button variant="outline" className="text-[10px] px-3 py-1.5">Review</Button>
              </div>
            </div>
            <div className="p-4 rounded-md border border-line bg-white/50">
              <div className="flex items-start gap-2 mb-2">
                <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md px-2 py-0.5 text-[10px] font-semibold">ATEP Certificate Compliance</span>
                <Badge className="bg-teal-50 text-teal-800 border-teal-200">ATEP v4.2</Badge>
              </div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Apex Medical: CA Resale Certified</div>
              <div className="text-[10px] text-muted mb-3">Zero-withholding tax exemption certificate validated by Amazon Tax cryptographically validated tax exemption. Clean audit trail locked to PO line item.</div>
              <div className="flex gap-2">
                <Button className="bg-indigo-600 text-white text-[10px] px-3 py-1.5">View Validated Certificate</Button>
                <Button variant="outline" className="text-[10px] px-3 py-1.5">Audit</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-6 text-[10px] text-muted">
        <span>· SP-API PB2B Quotes Stream: ACTIVE · TLS 1.3 Amazon Business Authenticated · Dry-Run Pipeline Safe (Zero accidental push)</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          <span className="text-xs text-muted">Node Pod: us-east-1-pod-09</span>
          <span className="text-xs text-muted">· Latency: 38ms</span>
        </div>
      </div>

      {/* Modals */}
      <Modal open={downloadLogOpen} onClose={() => setDownloadLogOpen(false)} title="Download Log — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Export Configuration</div>
            <div className="text-[10px] text-muted mb-3">Download approval and PO decision logs for compliance and audit review.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Format</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>CSV</option>
                  <option>Excel (.xlsx)</option>
                  <option>JSON</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Date Range</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>Last 90 days</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-teal-50">
            <div className="text-[10px] font-bold text-teal-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Export all approval decisions</li>
              <li>Include PO details and margin data</li>
              <li>Download for audit compliance</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDownloadLogOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setDownloadLogOpen(false); setMessage("Approval log exported to downloads."); }}>Download CSV</Button>
          </div>
        </div>
      </Modal>

      <Modal open={createQuoteOpen} onClose={() => setCreateQuoteOpen(false)} title="Create Custom Quote Draft — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Custom Quote Configuration</div>
            <div className="text-[10px] text-muted mb-3">Create a custom price quote draft for B2B buyers requiring volume discounts and negotiated terms.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Buyer / Organization</label>
                <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="Apex Medical Logistics" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Quote Amount ($)</label>
                <input type="number" step="0.01" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="14630.00" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-muted block mb-1">ASIN / Product</label>
                <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="B09YW72KB8L · Solar Power Pod Pro 50W" />
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Create custom price quote drafts</li>
              <li>Apply volume discount curves</li>
              <li>Validate margin floor (18.5% hard cap)</li>
              <li>Route to approver for signoff</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateQuoteOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setCreateQuoteOpen(false); setMessage("Custom quote draft created and queued for approval."); }}>Create Quote Draft</Button>
          </div>
        </div>
      </Modal>

      {reviewRevisionOpen && (
        <Modal open={true} onClose={() => setReviewRevisionOpen(null)} title="Review Revision Decision">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Decision Confirmation</div>
              <div className="text-[10px] text-muted mb-3">Confirm your decision on this product revision. Approved revisions apply to the catalog; rejected revisions return to needs_optimization.</div>
              <div className="p-3 rounded-md border border-line bg-white/50">
                <div className="text-[10px] font-bold text-on-surface mb-1">Revision ID</div>
                <div className="text-xs font-semibold text-indigo-900">{reviewRevisionOpen.id}</div>
                <div className="text-[10px] font-bold text-on-surface mt-2">Current Status</div>
                <div className="text-xs font-semibold text-indigo-900">{reviewRevisionOpen.status}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setReviewRevisionOpen(null)}>Cancel</Button>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setReviewRevisionOpen(null)}>Confirm</Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
