"use strict";

/* Automation activity logs — mirrors the mock /activity view. */
export default function ActivityPage() {
  const filters = ["all", "repricer", "ppc", "inventory", "procurement", "catalog", "approval", "sync"];
  const activityFilter = "all";
  const items: Array<{ timestamp: string; title: string; detail: string; category: string }> = [];

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <section className="panel mb-5">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Automation activity logs</h2>
            <div className="panel-subtitle">A timestamped record of every simulated pricing, advertising, and inventory decision.</div>
          </div>
          <span className="category-pill">System audit</span>
        </div>
        <div className="panel-content">
          <div className="toolbar">
            <div className="table-count">{items.length} events · newest first</div>
            <div className="filter-group" role="group" aria-label="Filter activity">
              {filters.map((filter) => (
                <button
                  key={filter}
                  className={`filter-button ${activityFilter === filter ? "active" : ""}`}
                  type="button"
                  data-activity-filter={filter}
                >
                  {filter === "all" ? "All events" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-content feed-wrap">{items.length ? (
            <div className="timeline">
              {items.map((item) => (
                <div key={item.timestamp} className="feed-item">
                  <span className={`feed-dot ${item.category}`}></span>
                  <div>
                    <div className="feed-title">{item.title}</div>
                    <div className="feed-detail">{item.detail}</div>
                  </div>
                  <span className="category-pill">{item.category}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Waiting for the first simulator event.</div>
          )}</div>
        </div>
      </section>
    </main>
  );
}
