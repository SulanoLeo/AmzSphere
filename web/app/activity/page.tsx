"use client";

import { useEffect, useState } from "react";
import { ClientProductProvider } from "@/lib/provider/client";
import type { ActivityItem } from "@/lib/provider/types";

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

export default function ActivityPage() {
  const provider = new ClientProductProvider();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadActivity = async () => {
      setLoading(true);
      try {
        const payload = await provider.getActivity();
        if (active) setItems(payload);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load activity log");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadActivity();
    return () => { active = false; };
  }, [provider]);

  const categories = new Set(items.map((i) => i.category));
  const recent = items.slice(0, 10);

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <section className="panel mb-5">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Activity log</h2>
            <div className="panel-subtitle">Simulator events, repricing moves, PPC harvests, and human-review decisions.</div>
          </div>
          <span className="category-pill">{categories.size} event categories</span>
        </div>
        <div className="panel-content">
          {error && <div role="alert" className="mb-4 flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950">{error}</div>}
          <div className="metrics metrics-five">
            <Metric label="Events logged" value={String(items.length)} detail="Latest 120 events retained" accent="blue" tag="ACTIVITY" />
            <Metric label="Event categories" value={String(categories.size)} detail={Array.from(categories).join(", ") || "—"} accent="teal" tag="CATEGORIES" />
            <Metric label="Latest event" value={items[0]?.timestamp ? new Date(items[0].timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} detail={items[0]?.category || "—"} accent="green" tag="RECENT" />
            <Metric label="Retention limit" value="120 events" detail="Older events roll off automatically" accent="orange" tag="LOOP" />
          </div>

          <section className="panel mb-5">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Recent events</h2>
                <div className="panel-subtitle">Newest first · click any row to jump to related page</div>
              </div>
            </div>
            <div className="panel-content">
              <div className="table-wrap">
                <table className="mock-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Category</th>
                      <th>Title</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={4} className="empty-cell" style={{padding:18}}>Loading activity…</td></tr> : items.length ? items.map((item) => (
                      <tr key={item.id} className="border-t border-line">
                        <td className="tabular-nums text-[10px] text-muted">{item.timestamp}</td>
                        <td className="product-meta">{item.category}</td>
                        <td>{item.title}</td>
                        <td className="text-[10px] text-muted">{item.detail}</td>
                      </tr>
                    )) : <tr><td colSpan={4} className="empty-cell" style={{padding:18}}>No activity yet.</td></tr>}
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
