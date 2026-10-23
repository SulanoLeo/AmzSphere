"use client";

import { useEffect, useState } from "react";
import { ClientProductProvider } from "@/lib/provider/client";

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

export default function PpcPage() {
  const provider = new ClientProductProvider();
  const [data, setData] = useState<{ campaigns: any[]; search_terms: any[]; targeted_exact_keywords: any[]; negative_keywords: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadPpc = async () => {
      setLoading(true);
      try {
        const payload = await provider.getPpcData();
        if (active) setData(payload);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load PPC data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPpc();
    return () => { active = false; };
  }, [provider]);

  const autonomousBids = true;
  const search_terms = data?.search_terms || [];
  const targeted_exact_keywords = data?.targeted_exact_keywords || [];
  const negative_keywords = data?.negative_keywords || [];
  const campaigns = data?.campaigns || [];
  const totalSpend = search_terms.reduce((sum, t) => sum + t.spend, 0);
  const totalClicks = search_terms.reduce((sum, t) => sum + t.clicks, 0);
  const qualified = targeted_exact_keywords.length;
  const negatives = negative_keywords.length;
  const currentAcos = () => {
    const spend = campaigns.reduce((s: number, c: any) => {
      const week = (c.ad_history || []).slice(-7);
      return s + week.reduce((sum: number, d: any) => sum + d.spend, 0);
    }, 0);
    const sales = campaigns.reduce((s: number, c: any) => {
      const week = (c.ad_history || []).slice(-7);
      return s + week.reduce((sum: number, d: any) => sum + d.sales, 0);
    }, 0);
    return sales ? (spend / sales) * 100 : 8.2;
  };

  const exactTerms = new Set(targeted_exact_keywords.map((k) => k.term));
  const negativeTerms = new Set(negative_keywords.map((k) => k.term));

  const rows = search_terms.map((term) => {
    const exact = exactTerms.has(term.term);
    const negative = negativeTerms.has(term.term);
    const automation = exact ? "Exact target" : negative ? "Negative" : "Monitoring";
    const tone = exact ? "good" : negative ? "denied" : "pending";
    return (
      <tr key={term.term} className="border-t border-line">
        <td><div className="keyword-term">{term.term}</div><div className="keyword-source">Customer search term</div></td>
        <td className="number-cell">{term.clicks}</td>
        <td className="number-cell">${term.spend}</td>
        <td className="number-cell">{term.conversions}</td>
        <td className="number-cell">{term.acos.toFixed(1)}%</td>
        <td><span className={`status ${tone}`}>{automation}</span></td>
      </tr>
    );
  });

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <section className="panel mb-5">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">PPC ads engine</h2>
            <div className="panel-subtitle">Search-term harvesting and waste controls across the sponsored product funnel.</div>
          </div>
          <div className="switch">
            <label htmlFor="bid-toggle">
              <input type="checkbox" id="bid-toggle" data-bid-toggle defaultChecked={autonomousBids} />
              <span className="switch-track"></span>
              <span className="switch-label">Enable Autonomous Bid Adjustments</span>
            </label>
          </div>
        </div>
        <div className="panel-content">
          {error && <div role="alert" className="mb-4 flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950">{error}</div>}
          <div className="metrics metrics-five">
            <Metric label="TACoS" value={`${currentAcos().toFixed(1)}%`} detail="Total Advertising Cost of Sales · overall ad health" accent="green" tag="TOTAL ADS / TOTAL SALES" />
            <Metric label="Search term spend" value={`$${totalSpend.toFixed(0)}`} detail={`${totalClicks} customer clicks tracked`} accent="orange" tag="MOCK CAMPAIGN DATA" />
            <Metric label="Portfolio ACoS" value={`${currentAcos().toFixed(1)}%`} detail={`0.0 pts over 30 days`} accent="teal" tag="LAST 30 DAYS" />
            <Metric label="Exact keywords" value={String(qualified)} detail="Auto-harvested · >5 conversions, <25% ACoS" accent="green" tag="TARGETED" />
            <Metric label="Negative keywords" value={String(negatives)} detail="Blocked after 15+ clicks without a sale" accent="blue" tag="WASTE CONTROL" />
          </div>

          <section className="section-grid mb-5">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Automation rules</h2>
                  <div className="panel-subtitle">Applied to incoming search-term data</div>
                </div>
              </div>
              <div className="panel-content">
                <div className="feed-list">
                  <div className="feed-item"><span className="feed-dot"></span><div><div className="feed-title">Harvest proven terms</div><div className="feed-detail">More than 5 conversions and ACoS below 25% adds an exact-match target.</div></div></div>
                  <div className="feed-item"><span className="feed-dot inventory"></span><div><div className="feed-title">Block zero-conversion waste</div><div className="feed-detail">More than 15 clicks with no conversions adds a negative keyword.</div></div></div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel mb-5">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Campaign guardrail</h2>
                <div className="panel-subtitle">Trailing 7-day performance and automatic bid changes</div>
              </div>
              <span className="category-pill">{campaigns.length} campaigns</span>
            </div>
            <div className="panel-content">
              <div className="table-wrap">
                <table className="mock-table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th className="tabular-nums">7d spend</th>
                      <th className="tabular-nums">7d sales</th>
                      <th className="tabular-nums">7d ACoS</th>
                      <th className="tabular-nums">Bid</th>
                      <th>Status</th>
                      <th>Last change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={7} className="empty-cell" style={{padding:18}}>Loading campaigns…</td></tr> : campaigns.length ? campaigns.map((c: any) => {
                      const week = (c.ad_history || []).slice(-7);
                      const spend = week.reduce((sum: number, day: any) => sum + day.spend, 0);
                      const sales = week.reduce((sum: number, day: any) => sum + day.sales, 0);
                      const acos = sales ? (spend / sales) * 100 : 0;
                      const over = acos > 25;
                      const change = (c.bid_changes || [])[0];
                      return (
                        <tr key={c.name} className="border-t border-line">
                          <td><div className="product-name">{c.name}</div><div className="product-meta">{c.sku}</div></td>
                          <td className="number-cell">${spend.toFixed(0)}</td>
                          <td className="number-cell">${sales.toFixed(0)}</td>
                          <td className="number-cell">{acos.toFixed(1)}%</td>
                          <td className="number-cell">${c.bid_floor}</td>
                          <td><span className={over ? "status warn" : "status good"}>{over ? "Over limit" : "Within limit"}</span></td>
                          <td className="product-meta">{change ? `${change.from} → ${change.to} · ${change.date}` : "No changes"}</td>
                        </tr>
                      );
                    }) : <tr><td colSpan={7} className="empty-cell" style={{padding:18}}>No campaigns.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Customer search terms</h2>
                <div className="panel-subtitle">Evaluation runs automatically on each simulator tick</div>
              </div>
              <span className="category-pill">{search_terms.length} terms</span>
            </div>
            <div className="panel-content">
              <div className="table-wrap">
                <table className="mock-table">
                  <thead>
                    <tr>
                      <th>Search term</th>
                      <th className="tabular-nums">Clicks</th>
                      <th className="tabular-nums">Spend</th>
                      <th className="tabular-nums">Orders</th>
                      <th className="tabular-nums">ACoS</th>
                      <th>Automation status</th>
                    </tr>
                  </thead>
                  <tbody>{rows}</tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
