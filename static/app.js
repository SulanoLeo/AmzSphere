const app = document.querySelector("#app");
const routeTitles = {
  overview: "Overview dashboard",
  catalog: "SEO & catalog agent",
  ppc: "PPC ads engine",
  inventory: "Inventory hub",
  "seller-store": "Seller Store",
  repricer: "Repricer monitor",
  activity: "Automation activity logs",
  approvals: "Procurement approvals",
  how: "How it works",
};
const navigation = [
  ["overview", "OV", "Overview Dashboard"],
  ["catalog", "SEO", "SEO & Catalog Agent"],
  ["ppc", "AD", "PPC Ads Engine"],
  ["inventory", "IN", "Inventory Hub"],
  ["seller-store", "SS", "Seller Store"],
  ["repricer", "RP", "Repricer Monitor"],
  ["activity", "LG", "Automation Activity Logs"],
  ["approvals", "PO", "B2B Approvals"],
  ["how", "HI", "How It Works"],
];

let state = null;
let charts = [];
let activityFilter = "all";
let approvalFilter = "pending";
let selectedCatalogAsin = "";
let sellerStoreAddAsin = "";
let toastTimer = null;
let renderPending = false;

let autonomousBids = false;

// Mock unit economics (landed cost incl. FBA fees) used for PO totals and payout margin.
// Products that are not listed here (e.g. newly added ones) show "—" instead of a made-up number.
const mockUnitCost = {
  B0C8Q4M2K7: 19.80,
  B0B7P9R3W1: 11.40,
  B0D2L6T8N4: 7.20,
  B0A9H5X3J6: 13.10,
  B0C3F7Y1V9: 4.90,
};
const REFERRAL_FEE = 0.15;

function payoutMargin(product) {
  const cost = mockUnitCost[product.asin];
  if (cost === undefined || !product.price) return null;
  return ((product.price * (1 - REFERRAL_FEE) - cost) / product.price) * 100;
}

const money = (amount, digits = 2) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
}).format(amount || 0);

const number = (value, digits = 0) => new Intl.NumberFormat("en-US", {
  maximumFractionDigits: digits,
}).format(value || 0);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function currentView() {
  const view = window.location.pathname.replace(/^\/+/, "");
  return Object.hasOwn(routeTitles, view) ? view : "overview";
}

function daysOfSupply(product) {
  return product.daily_velocity > 0 ? product.stock / product.daily_velocity : 0;
}

function statusForSupply(days) {
  if (days < 15) return ["critical", "Critical"];
  if (days < 30) return ["warning", "Watch"];
  return ["", "Healthy"];
}

function currentAcos() {
  return state.acos_history.at(-1) || 0;
}

function statusPill(status) {
  const key = String(status).toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return `<span class="status ${escapeHtml(key)}">${escapeHtml(label)}</span>`;
}

function activityTime(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? "Just now" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function heading(title, description, eyebrow = "Marketplace operations", extraActions = "") {
  return `<div class="page-heading">
    <div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1><p class="page-description">${escapeHtml(description)}</p></div>
    <div class="heading-actions">${extraActions}<button class="button" type="button" data-action="refresh">Refresh snapshot</button></div>
  </div>`;
}

function metric(label, value, foot, accent, tag = "LIVE") {
  return `<section class="metric">
    <div class="metric-label"><span>${escapeHtml(label)}</span><span class="mini-tag">${escapeHtml(tag)}</span></div>
    <div class="metric-value">${value}</div>
    <div class="metric-foot">${foot}</div>
    <div class="metric-accent ${accent}"></div>
  </section>`;
}

function chartPanel(title, subtitle, canvasId, key = "") {
  const showGuardrail = canvasId === "acos-chart";
  return `<section class="panel">
    <div class="panel-header"><div><h2 class="panel-title">${escapeHtml(title)}</h2><div class="panel-subtitle">${escapeHtml(subtitle)}</div></div>${key}</div>
    <div class="panel-content"><div class="chart-area"><canvas id="${canvasId}" aria-label="${escapeHtml(title)}"></canvas></div>${showGuardrail ? '<div class="guardrail-rule"><span class="guardrail-indicator">ACTIVE</span><div><strong>Active Guardrail Rule:</strong><span>' + guardrailRuleText() + '</span></div></div>' : ""}</div>
  </section>`;
}

const catalogProfiles = {
  B0C8Q4M2K7: {
    rank: 18,
    gaps: ["foldable laptop riser", "portable computer stand aluminum", "adjustable laptop stand for travel"],
    currentTitle: "ArcFold Aluminum Laptop Stand for Desk",
    currentBullets: ["Aluminum support for laptops", "Adjustable stand for desk use", "Foldable design for storage"],
    optimizedTitle: "Foldable Aluminum Laptop Stand for Desk, Adjustable Portable Computer Riser for Home Office and Travel",
    optimizedBullets: ["Raise your screen to a comfortable viewing height with a sturdy adjustable laptop riser.", "Fold-flat aluminum frame stores easily and travels between home, office, and classroom.", "Non-slip contact points help keep laptops stable on desks and shared work surfaces."],
  },
  B0B7P9R3W1: {
    rank: 42,
    gaps: ["silent wireless mouse", "ergonomic mouse for laptop"],
    currentTitle: "QuietClick Wireless Mouse",
    currentBullets: ["Wireless optical mouse", "Comfortable shape", "Works with most computers"],
    optimizedTitle: "QuietClick Wireless Mouse for Laptop and Desktop, Ergonomic Optical Mouse with Quiet Buttons",
    optimizedBullets: ["Quiet-click buttons support focused work in shared offices and study spaces.", "Ergonomic contour provides a comfortable everyday grip for laptop and desktop use.", "Wireless optical tracking connects to compatible computers for dependable navigation."],
  },
  B0D2L6T8N4: {
    rank: 31,
    gaps: ["reusable silicone bottle sleeve", "water bottle protective cover"],
    currentTitle: "TerraGrip Silicone Bottle Sleeve",
    currentBullets: ["Soft silicone bottle cover", "Protective grip", "Easy to clean"],
    optimizedTitle: "Reusable Silicone Water Bottle Sleeve, Protective Non-Slip Cover with Flexible Easy-Clean Grip",
    optimizedBullets: ["Flexible silicone helps protect compatible bottles from everyday scuffs.", "Textured non-slip grip makes bottles easier to hold during commutes and workouts.", "Rinse-clean reusable cover slips on and off for straightforward care."],
  },
  B0A9H5X3J6: {
    rank: 56,
    gaps: ["adjustable usb c desk lamp", "dimmable home office light"],
    currentTitle: "Luma USB-C Desk Light",
    currentBullets: ["USB-C desk lamp", "Compact lighting", "For workspaces"],
    optimizedTitle: "USB-C LED Desk Lamp for Home Office, Adjustable Compact Task Light for Work and Study",
    optimizedBullets: ["Direct task lighting toward your work surface with an adjustable desk lamp.", "Compact footprint fits home-office desks, bedside tables, and study spaces.", "USB-C powered design works with a compatible power source."],
  },
  B0C3F7Y1V9: {
    rank: 27,
    gaps: ["under desk cable organizer", "cord management clips for desk"],
    currentTitle: "SnapDock Cable Organizer Set",
    currentBullets: ["Cable clips for desks", "Organize charging cords", "Reusable set"],
    optimizedTitle: "Desk Cable Organizer Set, Cord Management Clips for Home Office Charging and Computer Cables",
    optimizedBullets: ["Keep frequently used charging and computer cords organized along a desk edge.", "Compact cable clips help reduce loose cords across home-office work surfaces.", "A multi-piece organizer set supports flexible placement around desks and workstations."],
  },
};

function profileFor(product) {
  const stored = (state.catalog_profiles || {})[product.asin] || catalogProfiles[product.asin];
  return stored || { rank: null, gaps: [], currentTitle: product.name, currentBullets: [], optimizedTitle: product.name, optimizedBullets: [] };
}

function acosDeltaLabel() {
  const history = state.acos_history || [];
  if (history.length < 2) return '<span class="metric-change">—</span>';
  const delta = history.at(-1) - history[0];
  const improved = delta <= 0;
  return `<span class="metric-change ${improved ? "" : "warn"}">${improved ? "↓" : "↑"} ${Math.abs(delta).toFixed(1)} pts</span>`;
}

function reviewInsight() {
  const themes = state.review_themes || {};
  const negative = (state.reviews || []).filter((review) => review.rating <= 2 && review.theme);
  const counts = {};
  negative.forEach((review) => { counts[review.theme] = (counts[review.theme] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 2) {
    return { quote: "No recurring complaints in recent low-rated reviews.", body: "No theme appears more than once among 1–2 star reviews.", fix: "Keep monitoring new reviews." };
  }
  const [theme, count] = top;
  const info = themes[theme] || {};
  const products = [...new Set(negative.filter((review) => review.theme === theme).map((review) => review.product))];
  return {
    quote: `${count} customers report ${info.label || theme.replace(/_/g, " ")}.`,
    body: `${info.summary || ""} Affects ${products.join(", ")}.`.trim(),
    fix: info.fix || "Review the affected listings and supplier QC.",
  };
}

function guardrailRuleText() {
  const cfg = state.ppc_guardrail;
  if (!cfg) return "Guardrail not configured.";
  return escapeHtml(`Trailing ${cfg.window_days}-day ACoS > ${cfg.acos_threshold}% → lower that campaign's bid by ${cfg.bid_reduction_pct}% (minimum $${Number(cfg.min_bid).toFixed(2)}), at most once per day.`);
}

function renderCampaigns() {
  const cfg = state.ppc_guardrail || {};
  const windowDays = cfg.window_days || 7;
  const rows = (state.campaigns || []).map((campaign) => {
    const week = campaign.ad_history.slice(-windowDays);
    const spend = week.reduce((sum, day) => sum + day.spend, 0);
    const sales = week.reduce((sum, day) => sum + day.sales, 0);
    const acos = sales ? (spend / sales) * 100 : 0;
    const over = cfg.acos_threshold && acos > cfg.acos_threshold;
    const change = (campaign.bid_changes || [])[0];
    const status = over ? '<span class="status warning">Over limit</span>' : '<span class="status approved">Within limit</span>';
    return `<tr><td><div class="product-name">${escapeHtml(campaign.name)}</div><div class="product-meta">${escapeHtml(campaign.sku)}</div></td>
      <td class="number-cell">${money(spend)}</td><td class="number-cell">${money(sales)}</td>
      <td class="number-cell">${number(acos, 1)}%</td><td class="number-cell">${money(campaign.bid_floor)}</td>
      <td>${status}</td><td class="product-meta">${change ? `${money(change.from)} → ${money(change.to)} · ${escapeHtml(change.date)}` : "No changes"}</td></tr>`;
  }).join("");
  return `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Campaign guardrail</h2><div class="panel-subtitle">Trailing ${windowDays}-day performance and automatic bid changes</div></div><span class="category-pill">${(state.campaigns || []).length} campaigns</span></div>
    <div class="table-wrap"><table><thead><tr><th>Campaign</th><th>${windowDays}d spend</th><th>${windowDays}d sales</th><th>${windowDays}d ACoS</th><th>Bid</th><th>Status</th><th>Last change</th></tr></thead><tbody>${rows || '<tr><td colspan="7"><div class="empty-state">No campaigns.</div></td></tr>'}</tbody></table></div></section>`;
}

function renderProcurementQueue() {
  const rows = state.products.map((product) => {
    const reorder = Math.max(0, Math.ceil(product.daily_velocity * 45 - product.stock));
    const status = product.asin === "B0B7P9R3W1" ? ["warning", "Review required · mock"] : ["approved", "Verified · mock"];
    const queued = (state.execution_queue || []).some((job) => job.type === "procurement_po" && job.sku === product.sku && job.status === "staged");
    return `<tr><td><div class="product-name">${escapeHtml(product.sku)}</div><div class="product-meta">${escapeHtml(product.name)}</div></td>
      <td class="number-cell">${number(product.stock)} units</td><td class="number-cell">${number(product.daily_velocity)} / day</td>
      <td class="number-cell">${number(reorder)} units</td><td><span class="status ${status[0] === "warning" ? "warning" : "approved"}">${escapeHtml(status[1])}</span></td>
      <td>${queued ? '<span class="status pending">Staged</span>' : '<span class="product-meta">Ready</span>'}</td></tr>`;
  }).join("");
  const eligible = state.products.filter((product) => product.stock / Math.max(product.daily_velocity, 1) < 30 && !((state.execution_queue || []).some((job) => job.type === "procurement_po" && job.sku === product.sku && job.status === "staged")));
  return `<section class="panel procurement-queue"><div class="panel-header"><div><h2 class="panel-title">Autonomous procurement queue</h2><div class="panel-subtitle">Inventory cover and suggested 45-day replenishment · supplier checks are sample data</div></div><button class="button button-primary" type="button" data-agent-action="procurement_po" ${eligible.length ? "" : "disabled"}>⚡ Auto-Generate &amp; Send PO via AI Agent</button></div>
    <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Warehouse stock</th><th>Velocity</th><th>Suggested reorder volume</th><th>AI supplier verification status</th><th>Queue</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="queue-footnote">Sandbox mode stages eligible SKUs below 30 days of cover. No purchase order is sent to a supplier.</div></section>`;
}

function renderShell(view, body) {
  const pendingApprovals = state.orders.filter((order) => order.status === "pending").length + (state.product_revisions || []).filter((revision) => revision.status === "pending_approval").length;
  const menu = navigation.map(([key, code, label]) => `<a class="nav-link ${view === key ? "active" : ""}" href="/${key}" ${view === key ? 'aria-current="page"' : ""}>
    <span class="nav-code">${code}</span><span>${label}</span>${key === "approvals" && pendingApprovals ? `<span class="nav-count">${pendingApprovals}</span>` : ""}
  </a>`).join("");
  const manager = state.manager;
  app.innerHTML = `<div class="layout">
    <aside class="sidebar">
      <a class="brand" href="/" aria-label="AmzSphere home">
        <span><span class="brand-name">AmzSphere</span></span>
      </a>
      <div class="nav-label">Workspace</div><nav class="nav-links" aria-label="Main navigation">${menu}</nav>
      <div class="sidebar-spacer"></div>
      <div class="engine-card"><div class="engine-card-top"><span class="pulse"></span>Simulation running</div><div class="engine-detail">Market refresh every 10 seconds</div></div>
      <div class="profile"><span class="avatar">${escapeHtml(manager.initials)}</span><span><span class="profile-name">${escapeHtml(manager.name)}</span><span class="profile-role">${escapeHtml(manager.role)}</span></span></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="crumb">AmzSphere <span aria-hidden="true">/</span> <strong>${escapeHtml(routeTitles[view])}</strong></div>
        <div class="topbar-right"><span class="mode-chip"><span class="pulse"></span>Mock engine live</span><span class="top-date">${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span></div>
      </header>
      <main class="main">${body}<div class="footer-note">Sandbox data · Decisions are simulated and never sent to Amazon</div></main>
    </div>
  </div><div id="toast-root" aria-live="polite"></div>${renderOptimizeDrawer()}${renderAddProductModal()}`;
  mountCharts(view);
}

function renderOverview() {
  const summary = productCache.summary || {};
  const sync = summary.sync || {};
  const syncLabel = syncAgeBadge(summary);
  const syncOk = sync.status === "completed";
  const totalStock = state.products.reduce((sum, product) => sum + product.stock, 0);
  const pendingRevisions = (state.product_revisions || []).filter((revision) => revision.status === "pending_approval").length;
  const critical = state.products.filter((product) => daysOfSupply(product) < 15).length;
  const needsOptimization = summary.needs_optimization ?? state.products.filter((product) => product.opt_status === "needs_optimization").length;
  const current = currentAcos();
  const recentActivity = state.activity.slice(0, 5);
  const reviews = [...state.reviews].sort((a, b) => a.rating - b.rating || b.date.localeCompare(a.date)).slice(0, 5);
  const insight = reviewInsight();
  const top10 = summary.top_10 || [];
  const body = `${heading("Operations overview", "A live read on marketplace health, optimization exposure, and inventory exposure.")}
    <div class="sync-bar">
      <span class="sync-badge ${syncOk ? "good" : "warn"}" title="${escapeHtml(JSON.stringify(sync || {}))}">${escapeHtml(syncLabel)}</span>
      <button type="button" class="button" data-action="sync-seller">${syncOk ? "Resync seller data" : "Sync seller data"}</button>
      <button type="button" class="button button-outline" data-action="refresh-overview">Refresh</button>
    </div>
    <div class="metrics">
      ${metric("Catalog items", number(summary.catalog_items ?? state.products.length), "Seller-linked ASINs · one shared product record each", "blue", "CATALOG")}
      ${metric("Sellable units", number(Math.round(summary.sellable_units ?? totalStock)), "Latest inventory snapshots across all marketplaces", "teal", "INVENTORY")}
      ${metric("Needs optimization", number(needsOptimization), summary.needs_optimization !== undefined ? "Products below a 70 optimization score" : "Listings missing copy quality rules", "orange", "OPTIMIZATION")}
      ${metric("Reorder flags", number(summary.reorder_flags ?? critical), critical ? "Below 15 days of supply" : "All products above reorder threshold", "warn", "DAYS OF SUPPLY")}
      ${metric("Pending approvals", number(pendingRevisions), pendingRevisions ? "Listing revisions awaiting your decision" : "No revisions awaiting review", "teal", "APPROVALS")}
    </div>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Optimization priority list</h2><div class="panel-subtitle">Ranked by (100 − score) × recent sales volume. Open the optimize drawer to draft changes.</div></div></div>
    <div class="table-wrap"><table><thead><tr><th>SKU</th><th>ASIN</th><th>Product</th><th>Score</th><th>Status</th><th>Impact</th><th>Issues</th><th>Action</th></tr></thead><tbody>
      ${top10.map((product) => {
        const issues = Array.isArray(product.opt_issues) ? product.opt_issues : [];
        return `<tr><td class="sku-cell">${escapeHtml(product.sku || "—")}</td><td class="sku-cell">${escapeHtml(product.asin || "—")}</td><td>${escapeHtml(product.name || product.title || "—")}</td><td class="number-cell score-cell"><strong>${number(product.opt_score)}</strong></td><td><span class="status ${statusClass(product.opt_status)}">${escapeHtml(product.opt_status || "—")}</span></td><td class="number-cell">${number(Math.round(product.impact))}</td><td class="issue-cell">${issues.map((issue) => `<span class="issue-tag">${escapeHtml(issue)}</span>`).join("") || '<span class="issue-tag muted">—</span>'}</td><td><button type="button" class="button button-outline button-sm" data-optimize="${escapeHtml(product.id)}">Optimize</button></td></tr>`;
      }).join("") || `<tr><td class="empty-cell" colSpan="8">${productCache.error ? escapeHtml(productCache.error) : "No products need optimization right now."}</td></tr>`}
    </tbody></table></div></section>
    <div class="section-grid">
      ${chartPanel("Advertising efficiency", "Portfolio ACoS · 30-day trend", "acos-chart", '<span class="chart-key"><span class="key-item"><span class="key-dot"></span>ACoS</span></span>')}
      ${chartPanel("Procurement mix", "Open and approved workflow value", "spend-chart")}
    </div>
    ${renderProcurementQueue()}
    <div class="section-grid">
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Automation activity</h2><div class="panel-subtitle">Latest decisions from the background engine</div></div><a class="button" href="/activity">View all</a></div>
        <div class="panel-content">${renderFeed(recentActivity, false)}</div></section>
      <section class="panel insight-panel"><div class="panel-content">
        <div class="insight-tag">AI review summary · Mock analysis</div>
        <blockquote class="insight-quote">“${escapeHtml(insight.quote)}”</blockquote>
        <p class="insight-body">${escapeHtml(insight.body)}</p>
        <div class="recommendation"><strong>Recommended fix</strong><br />${escapeHtml(insight.fix)}</div>
        <div class="review-list">${reviews.map((review, index) => `<details data-review-index="${index}"><summary><span class="stars">${"★".repeat(review.rating)}</span> &nbsp;${escapeHtml(review.product)} · ${escapeHtml(review.date)}</summary><p>${escapeHtml(review.text)}</p></details>`).join("")}</div>
      </div></section>
    </div>`;
  return body;
}

function statusClass(optStatus) {
  const map = { needs_optimization: "warn", draft_ready: "pending", pending_approval: "pending", approved: "approved", published: "approved", optimized: "good" };
  return map[optStatus] || "";
}


function renderPpc() {
  const totalSpend = state.search_terms.reduce((sum, term) => sum + term.spend, 0);
  const totalClicks = state.search_terms.reduce((sum, term) => sum + term.clicks, 0);
  const qualified = state.targeted_exact_keywords.length;
  const negatives = state.negative_keywords.length;
  const rows = state.search_terms.map((term) => {
    const exact = state.targeted_exact_keywords.some((item) => item.term === term.term);
    const negative = state.negative_keywords.some((item) => item.term === term.term);
    const automation = exact ? '<span class="status approved">Exact target</span>' : negative ? '<span class="status denied">Negative</span>' : '<span class="status pending">Monitoring</span>';
    return `<tr><td><div class="keyword-term">${escapeHtml(term.term)}</div><div class="keyword-source">Customer search term</div></td><td class="number-cell">${number(term.clicks)}</td><td class="number-cell">${money(term.spend)}</td><td class="number-cell">${number(term.conversions)}</td><td class="number-cell">${number(term.acos, 1)}%</td><td>${automation}</td></tr>`;
  }).join("");
  const bidToggle = `<label class="switch" for="bid-toggle"><input type="checkbox" id="bid-toggle" data-bid-toggle ${autonomousBids ? "checked" : ""} /><span class="switch-track"></span><span class="switch-label">Enable Autonomous Bid Adjustments</span></label>`;
  return `${heading("PPC ads engine", "Search-term harvesting and waste controls across the sponsored product funnel.", "Advertising", bidToggle)}
    <div class="metrics metrics-five">
      ${metric("TACoS", "8.2%", "Total Advertising Cost of Sales · overall ad health", "green", "TOTAL ADS / TOTAL SALES")}
      ${metric("Search term spend", money(totalSpend, 0), `${number(totalClicks)} customer clicks tracked`, "orange", "MOCK CAMPAIGN DATA")}
      ${metric("Portfolio ACoS", `${number(currentAcos(), 1)}%`, acosDeltaLabel() + " over 30 days", "teal", "LAST 30 DAYS")}
      ${metric("Exact keywords", number(qualified), "Auto-harvested · >5 conversions, <25% ACoS", "green", "TARGETED")}
      ${metric("Negative keywords", number(negatives), "Blocked after 15+ clicks without a sale", "blue", "WASTE CONTROL")}
    </div>
    <div class="section-grid">
      ${chartPanel("ACoS performance", "Daily portfolio trend · last 30 days", "acos-chart", '<span class="chart-key"><span class="key-item"><span class="key-dot"></span>ACoS</span></span>')}
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Automation rules</h2><div class="panel-subtitle">Applied to incoming search-term data</div></div></div>
        <div class="panel-content"><div class="feed-list">
          <div class="feed-item"><span class="feed-dot"></span><div><div class="feed-title">Harvest proven terms</div><div class="feed-detail">More than 5 conversions and ACoS below 25% adds an exact-match target.</div></div></div>
          <div class="feed-item"><span class="feed-dot inventory"></span><div><div class="feed-title">Block zero-conversion waste</div><div class="feed-detail">More than 15 clicks with no conversions adds a negative keyword.</div></div></div>
        </div></div>
      </section>
    </div>
    ${renderCampaigns()}
    <div style="height:14px"></div>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Customer search terms</h2><div class="panel-subtitle">Evaluation runs automatically on each simulator tick</div></div><span class="category-pill">${state.search_terms.length} terms</span></div>
      <div class="table-wrap"><table><thead><tr><th>Search term</th><th>Clicks</th><th>Spend</th><th>Orders</th><th>ACoS</th><th>Automation status</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function renderCatalog() {
  const products = state.products || [];
  const syncBadge = (p) => {
    const synced = (state.marketplace_listings || []).some(
      (listing) => listing.global_product_id === p.asin && /live/i.test(listing.status || ""));
    return `<span class="status ${synced ? "good" : "pending"}">${synced ? "Synced" : "Not synced"}</span>`;
  };
  const filtered = products.filter((product) => {
    if (catalogFilter.opt_status && product.opt_status !== catalogFilter.opt_status) return false;
    if (catalogFilter.low_stock && (product.days_of_supply ?? 999) >= 15) return false;
    if (catalogFilter.suppressed) {
      const suppressed = product.suppressed || (state.marketplace_listings || []).some(
        (listing) => listing.global_product_id === product.asin && /suppressed/i.test(listing.status || ""));
      if (!suppressed) return false;
    }
    if (catalogFilter.search) {
      const needle = catalogFilter.search.casefold();
      return [product.name, product.title, product.asin, product.sku, product.category].some((value) => String(value || "").casefold().includes(needle));
    }
    return true;
  });
  let sorted = [...filtered];
  if (catalogFilter.sort) {
    const reverse = catalogFilter.sort.startsWith("-");
    const key = catalogFilter.sort.replace(/^-/, "");
    sorted.sort((a, b) => {
      const av = a[key]; const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return reverse ? -1 : 1;
      if (bv == null) return reverse ? 1 : -1;
      const cmp = String(av).casefold().localeCompare(String(bv).casefold());
      return reverse ? -cmp : cmp;
    });
  }
  const page = Math.max(1, catalogFilter.page || 1);
  const pageSize = Math.max(1, Math.min(200, catalogFilter.page_size || 200));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
  const allSelected = viewState.selectedIds.length && viewState.selectedIds.every((id) => filtered.some((p) => p.id === id));
  const rows = paged.map((product) => {
    const selected = viewState.selectedIds.includes(product.id);
    const issues = Array.isArray(product.opt_issues) ? product.opt_issues : [];
    return `<tr class="${selected ? "selected-row" : ""}"><td><input type="checkbox" class="row-select" data-row-id="${escapeHtml(product.id)}" ${selected ? "checked" : ""} /></td>
      <td class="sku-cell">${escapeHtml(product.asin)}</td><td class="sku-cell">${escapeHtml(product.sku)}</td>
      <td>${escapeHtml(product.title || product.name || "—")}</td><td>${escapeHtml(product.category || "—")}</td>
      <td><span class="status ${statusClass(product.opt_status)}">${escapeHtml(product.opt_status || "—")}</span></td>
      <td class="number-cell score-cell">${number(product.opt_score ?? 0)}</td>
      <td class="issue-cell">${issues.map((issue) => `<span class="issue-tag muted">${escapeHtml(issue)}</span>`).join("") || '<span class="issue-tag muted">—</span>'}</td>
      <td class="number-cell">${number(product.stock ?? 0)}</td><td class="number-cell">${number(product.days_of_supply ?? 0)}</td>
      <td class="number-cell">${money(product.price ?? 0)}</td>
      <td><button type="button" class="button button-outline button-sm" data-optimize="${escapeHtml(product.id)}">Optimize</button>
          <button type="button" class="button button-outline button-sm" data-view="${escapeHtml(product.id)}">View</button></td></tr>`;
  }).join("");
  const chips = [
    { label: "Needs optimization", value: "needs_optimization" },
    { label: "Low stock (< 15d)", value: "low_stock" },
    { label: "Suppressed", value: "suppressed" },
  ].map((chip) => {
    const active = (chip.value === "low_stock" ? catalogFilter.low_stock : chip.value === "suppressed" ? catalogFilter.suppressed : catalogFilter.opt_status === chip.value);
    return `<button type="button" class="chip ${active ? "chip-active" : ""}" data-filter="${chip.value === "low_stock" ? "low_stock" : chip.value === "suppressed" ? "suppressed" : "opt_status"}}" data-filter-value="${chip.value === "low_stock" ? "true" : chip.value === "suppressed" ? "true" : chip.value}">${escapeHtml(chip.label)}</button>`;
  }).join("");
  return `${heading("SEO & Catalog", "One shared product record for the catalog: scores, filters, row actions, and bulk optimization.", "Catalog operations")}
    <div class="catalog-toolbar">
      <div class="toolbar-search"><span>Filter</span>${chips}<label style="margin-left:8px;display:inline-flex;align-items:center;gap:6px;"><span style="font:600 10px var(--font-ui);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;">Search</span><input id="catalog-search" value="${escapeHtml(catalogFilter.search)}" placeholder="SKU, ASIN, title, category" style="min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></label></div>
      <div class="toolbar-actions">
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" data-select-all ${allSelected ? "checked" : ""} /> <span style="font:600 10px var(--font-ui);color:var(--muted);text-transform:uppercase;">Select all on page</span></label>
        <button type="button" class="button button-outline" data-action="bulk-optimize" ${!viewState.selectedIds.length ? "disabled" : ""}>Optimize selected (${viewState.selectedIds.length})</button>
        <button type="button" class="button button-primary" data-action="add-product">Add product</button>
      </div>
    </div>
    <div class="table-wrap"><table><thead><tr><th style="width:34px"></th><th>ASIN</th><th>SKU</th><th>Title</th><th>Category</th><th>Status</th><th>Score</th><th>Issues</th><th>Stock</th><th>Days of supply</th><th>Price</th><th style="width:170px">Actions</th></tr></thead><tbody>
      ${rows || `<tr><td class="empty-cell" colSpan="12">${productCache.error ? escapeHtml(productCache.error) : "No products match the current filters."}</td></tr>`}
    </tbody></table></div>
    <div class="table-pagination">${paginationControls(page, totalPages, (nextPage) => { catalogFilter.page = nextPage; render(); })}
      <span class="pagination-caption">${number(total)} products · page ${number(page)} of ${number(totalPages)}</span>
    </div>`;
}

function paginationControls(page, totalPages, onChange) {
  if (totalPages <= 1) return "";
  const buttons = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) buttons.push(`<button type="button" class="page-button ${p === page ? "page-active" : ""}" data-page="${p}">${p}</button>`);
  return `<div class="pagination" role="navigation">${buttons.map((button, index) => index ? button : `<button type="button" class="page-button page-ellipsis" ${page <= 2 ? "disabled" : ""} data-page="${page - 1}">…</button>`).join("")}${page >= totalPages - 1 ? "" : `<button type="button" class="page-button page-ellipsis" ${page >= totalPages ? "disabled" : ""} data-page="${page + 1}">…</button>`}</div>`;
}


function renderOptimizeDrawer() {
  if (!viewState.drawerId) return "";
  const product = productById(viewState.drawerId);
  if (!product) return "";
  const issues = Array.isArray(product.opt_issues) ? product.opt_issues : [];
  const bulletsValue = Array.isArray(product.bullets) ? product.bullets.join("\n") : String(product.bullets || "");
  const keywordsValue = Array.isArray(product.backend_keywords) ? product.backend_keywords.join(", ") : String(product.backend_keywords || "");
  return `<div class="drawer-backdrop" data-action="close-drawer"></div>
    <div class="drawer" data-drawer>
      <div class="drawer-header"><div><span class="drawer-title">${viewState.drawerMode === "view" ? "View listing" : "Optimize listing"}</span><span class="drawer-sub">${escapeHtml(product.sku)} · ${escapeHtml(product.asin)}</span></div><button type="button" class="button button-outline button-sm" data-action="close-drawer">Close</button></div>
      <div class="drawer-body">
        <div class="compare-grid">
          <div class="compare-side"><div class="compare-head">Current · score ${number(product.opt_score ?? 0)}</div>
            <div class="compare-field"><span>Title</span><div class="field-value">${escapeHtml(product.title || product.name || "—")}</div></div>
            <div class="compare-field"><span>Bullets</span><ul class="field-list">${(product.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul></div>
            <div class="compare-field"><span>Backend keywords</span><div class="field-value">${escapeHtml((product.backend_keywords || []).join(", "))}</div></div>
            <div class="compare-field"><span>Description</span><div class="field-value">${escapeHtml(product.description || "—")}</div></div>
            <div class="compare-field"><span>Images</span><div class="field-value">${number(product.images?.length ?? 0)} main</div></div>
            ${issues.map((issue) => `<div class="compare-field issue"><span>Issue</span><span class="issue-tag muted">${escapeHtml(issue)}</span></div>`).join("")}
          </div>
          <div class="compare-side"><div class="compare-head">Suggested · editable before approval</div>
            <form id="optimize-form" data-product-id="${escapeHtml(product.id)}">
              <div class="compare-field"><span>Title</span><textarea name="title" required style="width:100%;min-height:44px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;">${escapeHtml(product.title || product.name || "")}</textarea></div>
              <div class="compare-field"><span>Bullets (one per line)</span><textarea name="bullets" required style="width:100%;min-height:88px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;">${escapeHtml(bulletsValue)}</textarea></div>
              <div class="compare-field"><span>Backend keywords (comma-separated)</span><input name="backend_keywords" value="${escapeHtml(keywordsValue)}" style="width:100%;min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
              <div class="compare-field"><span>Description</span><textarea name="description" style="width:100%;min-height:66px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;">${escapeHtml(product.description || "")}</textarea></div>
              <div class="compare-actions">
                ${viewState.drawerMode === "view" ? `<button type="button" class="button button-outline" data-action="close-drawer">Close</button>` : `
                  <button type="button" class="button button-outline" data-action="close-drawer">Cancel</button>
                  <button type="button" class="button" data-save-draft="${escapeHtml(product.id)}">Save draft</button>
                  <button type="button" class="button button-primary" data-send-approval="${escapeHtml(product.id)}">Send to approval</button>`}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>`;
}

function renderAddProductModal() {
  if (!viewState.addModal) return "";
  return `<div class="drawer-backdrop" data-action="close-add-modal"></div>
    <div class="drawer" style="width:min(720px,92vw);max-height:92vh;display:flex;flex-direction:column" data-add-modal>
      <div class="drawer-header"><div><span class="drawer-title">Add product</span><span class="drawer-sub">Import from Amazon or create manually</span></div><button type="button" class="button button-outline button-sm" data-action="close-add-modal">Close</button></div>
      <div class="drawer-body" style="flex:1;overflow:auto;padding:16px 20px 20px;">
        <div class="tabs"><button type="button" class="tab ${viewState.addTab === "import" ? "tab-active" : ""}" data-add-tab="import">Import from Amazon</button><button type="button" class="tab ${viewState.addTab === "manual" ? "tab-active" : ""}" data-add-tab="manual">Create manually</button></div>
        <div class="tab-panel ${viewState.addTab === "import" ? "" : "hidden"}" id="add-tab-import">
          <p class="hint">Look up a product in the mock Amazon catalog by ASIN or SKU. Re-importing is idempotent: mock sync upserts by ASIN + marketplace.</p>
          <form id="add-import-form" style="display:flex;gap:8px;align-items:end;margin-top:10px;">
            <input name="ref" type="text" placeholder="ASIN or SKU" required style="flex:1;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;">
            <button type="submit" class="button button-primary" style="min-height:36px;">Import</button>
          </form>
        </div>
        <div class="tab-panel ${viewState.addTab === "manual" ? "" : "hidden"}" id="add-tab-manual">
          <form id="add-manual-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:10px;">
            <div><label class="form-label">Product name</label><input name="add-name" type="text" placeholder="e.g. Bamboo Desk Organizer" required style="width:100%;min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
            <div><label class="form-label">SKU</label><input name="add-sku" type="text" placeholder="e.g. BD-OG-01" required style="width:100%;min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
            <div><label class="form-label">ASIN</label><input name="add-asin" type="text" placeholder="e.g. B0XYZ12345" required style="width:100%;min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
            <div><label class="form-label">Listing title</label><input name="add-title" type="text" placeholder="Defaults to product name" style="width:100%;min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
            <div><label class="form-label">Category</label><input name="add-category" type="text" placeholder="e.g. Office" style="width:100%;min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
            <div><label class="form-label">Price ($)</label><input name="add-price" type="number" step="0.01" placeholder="24.99" style="width:100%;min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
            <div><label class="form-label">Stock units</label><input name="add-stock" type="number" step="1" placeholder="500" style="width:100%;min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
            <div><label class="form-label">Daily velocity</label><input name="add-velocity" type="number" step="0.1" placeholder="15" style="width:100%;min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
            <div style="grid-column:1/-1;display:flex;gap:8px;"><button type="button" class="button button-outline" data-action="close-add-modal">Cancel</button><button type="submit" form="add-manual-form" class="button button-primary" style="min-height:36px;">Create product</button></div>
          </form>
        </div>
      </div>
    </div>`;
}

function renderHow() {
  return `${heading("How AmzSphere works", "One shared product record drives every page: catalog → optimize → approval → publish → all pages reflect the update.", "System guide")}
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Single source of truth: products</h2><div class="panel-subtitle">Every page reads and writes one product record. The flow is the same in mock and in the later SP-API swap.</div></div><span class="category-pill">Shared product record</span></div>
      <div class="panel-content"><div class="flow-steps">
        <div class="flow-step"><span class="flow-number">01</span><div><div class="flow-title">Add or sync a product</div><div class="flow-copy">Import by ASIN/SKU from the mock Amazon catalog or create manually. Sync upserts by ASIN + marketplace (idempotent, re-runnable) and records each run in the activity log.</div></div><span class="flow-endpoint">POST /api/products · POST /api/sync</span></div>
        <div class="flow-step"><span class="flow-number">02</span><div><div class="flow-title">Score every listing</div><div class="flow-copy">Deterministic rules score 0–100 on title length/keywords, bullets, images, description, backend keywords, and suppression. Score below 70 flags needs_optimization with human-readable issues.</div></div><span class="flow-endpoint">scoring.compute_opt_score</span></div>
        <div class="flow-step"><span class="flow-number">03</span><div><div class="flow-title">Draft an optimization</div><div class="flow-copy">Side-by-side current vs suggested copy (title, bullets, keywords, description). Saving creates a product_revision with status draft_ready or pending_approval; nothing touches Amazon until approved.</div></div><span class="flow-endpoint">POST /api/products/{id}/optimize</span></div>
        <div class="flow-step"><span class="flow-number">04</span><div><div class="flow-title">Approve or reject</div><div class="flow-copy">Approvals shows pending revisions with a before/after diff. Approve applies the changes to the shared product, sets opt_status=published, recomputes the score, updates marketplace listings to Live & In Sync, and logs the publish. Reject returns the product to needs_optimization.</div></div><span class="flow-endpoint">POST /api/approvals/{id}/approve|reject</span></div>
        <div class="flow-step"><span class="flow-number">05</span><div><div class="flow-title">Every page reflects the update</div><div class="flow-copy">After any write, the single [&quot;products&quot;] query key family invalidates so the catalog table, Overview cards, Inventory, Pricing, and Activity Log all refresh without a manual reload.</div></div><span class="flow-endpoint">invalidateProducts()</span></div>
        <div class="flow-step"><span class="flow-number">06</span><div><div class="flow-title">Execution guard</div><div class="flow-copy">Nothing is written to Amazon (or the mock &quot;Amazon&quot;) without an approved revision. Mock mode only — no real Amazon calls, no credentials, no secrets.</div></div><span class="flow-endpoint">approval-required writes</span></div>
      </div></div>
    </section>
    <div class="section-grid equal">
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Product model</h2><div class="panel-subtitle">One table shared by catalog, inventory, pricing, approvals, and activity log</div></div></div><div class="panel-content"><div class="rule-line"><span class="status approved">Identity</span><span>id, asin, sku, marketplace_id, source (amazon_sync | manual)</span></div><div class="rule-line"><span class="status approved">Listing</span><span>title, bullets[], description, backend_keywords, images[], price</span></div><div class="rule-line"><span class="status approved">Inventory</span><span>sellable_units, days_of_supply</span></div><div class="rule-line"><span class="status approved">Optimization</span><span>opt_score (0–100), opt_status, opt_issues[], last_optimized_at</span></div><div class="rule-line"><span class="status approved">Sync</span><span>last_synced_at, sync_status</span></div><div class="rule-line"><span class="status approved">Revisions</span><span>product_id, field changes before/after, status, created_by, created_at</span></div></div></section>
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">opt_status enum</h2><div class="panel-subtitle">needs_optimization → draft_ready → pending_approval → approved → published → optimized</div></div></div><div class="panel-content"><div class="rule-line"><span class="status warn">needs_optimization</span><span>Score &lt; 70 · appears in optimization priority list</span></div><div class="rule-line"><span class="status pending">draft_ready</span><div class="rule-line"><span class="status pending">pending_approval</span><span>Awaiting human approver decision</span></div><div class="rule-line"><span class="status approved">approved</span><span>Revision applied · published to mock Amazon</span></div><div class="rule-line"><span class="status good">published</span><span>Score recomputed · listings Live & In Sync</span></div><div class="rule-line"><span class="status good">optimized</span><span>Score ≥ 70 · no open issues</span></div></div></section>
      <section class="panel insight-panel"><div class="panel-content"><div class="insight-tag">Mock mode · visual simulation</div><blockquote class="insight-quote">Live won&apos;t run without SP-API credentials, PostgreSQL, Redis, and Google OAuth.</blockquote><p class="insight-body">The Next.js/FastAPI/Celery scaffold keeps the same product model and endpoints; only the sync source swaps from the mock catalog to real SP-API Listings/Catalog/FBA Inventory calls when credentials are added.</p><div class="recommendation"><strong>Safety boundary</strong><br />All data here is mock. Approval actions are not authenticated yet; keep hosted access private.</div></div></section>
    </div>`;
}

function renderInventory() {
  const lowStock = state.products.filter((product) => daysOfSupply(product) < 15);
  const totalStock = state.products.reduce((sum, product) => sum + product.stock, 0);
  const totalVelocity = state.products.reduce((sum, product) => sum + product.daily_velocity, 0);
  const rows = state.products.map((product) => {
    const days = daysOfSupply(product);
    const [tone, label] = statusForSupply(days);
    const fill = Math.min(100, (days / 45) * 100);
    return `<tr><td><div class="product-name">${escapeHtml(product.name)}</div><div class="product-meta">${escapeHtml(product.sku)} · <span class="asin">${escapeHtml(product.asin)}</span></div></td>
      <td><div class="stock-cell"><div class="stock-number"><span>${number(product.stock, 1)} units</span><span>${number(days, 1)}d</span></div><div class="stock-track"><div class="stock-fill ${tone}" style="width:${fill}%"></div></div></div></td>
      <td class="number-cell">${number(product.daily_velocity)} / day</td>
      <td class="number-cell score-cell">${number(product.opt_score ?? 0)} <span class="status-mini ${statusClass(product.opt_status)}">${escapeHtml(product.opt_status || "—")}</span></td>
      <td>${statusPill(label.toLowerCase() === "healthy" ? "approved" : label.toLowerCase() === "watch" ? "warning" : "critical")}</td>
      <td>${product.po_draft_id ? `<span class="order-id">${escapeHtml(product.po_draft_id)}</span>` : '<span class="product-meta">No draft</span>'}</td></tr>`;
  }).join("");
  const alertStrip = lowStock.length ? `<div class="critical-strip"><span class="critical-mark">!</span><div><div class="critical-title">${lowStock.length} critical replenishment ${lowStock.length === 1 ? "alert" : "alerts"}</div><div class="critical-detail">${lowStock.map((product) => `${escapeHtml(product.name)} · ${number(daysOfSupply(product), 1)} days of supply`).join(" &nbsp; / &nbsp; ")}<br />A purchase order draft is generated automatically when coverage falls below 15 days.</div></div></div>` : "";
  const drafts = state.purchase_orders.length ? state.purchase_orders.map((po) => {
    const unitCost = mockUnitCost[po.product_asin];
    const product = state.products.find((item) => item.asin === po.product_asin);
    const sku = product ? product.sku : "";
    const queued = (state.execution_queue || []).some((job) => job.type === "procurement_po" && job.sku === sku && job.status === "staged");
    const capital = unitCost === undefined ? "Unit cost not set" : money(po.units * unitCost);
    return `<div class="po-row po-card"><div><div class="po-name">${escapeHtml(po.product_name)}</div><div class="po-meta">${escapeHtml(po.supplier)} · ${number(po.units)} units · ${escapeHtml(po.status)}</div>
      <div class="po-total">Total Capital Required: <strong>${capital}</strong></div></div>
      <div class="po-actions"><span class="po-id">${escapeHtml(po.id)}</span>
      <button class="button ${queued ? "" : "button-primary"}" type="button" data-send-po data-sku="${escapeHtml(sku)}" data-units="${po.units}" ${queued || !sku ? "disabled" : ""}>${queued ? "In Procurement Queue" : "Send to Procurement Queue"}</button></div></div>`;
  }).join("") : '<div class="empty-state">No replenishment drafts yet.</div>';
  return `${heading("Inventory hub", "Stock cover, sales velocity, and purchase-order drafts in one place.", "Supply chain")}
    ${alertStrip}
    <div class="metrics">
      ${metric("Units on hand", number(totalStock), `${state.products.length} active catalog products`, "blue", "SELLABLE STOCK")}
      ${metric("Daily sales velocity", number(totalVelocity), "Units sold per day across the portfolio", "teal", "30-DAY AVERAGE")}
      ${metric("Critical products", number(lowStock.length), lowStock.length ? '<span class="metric-change warn">Below 15 days of supply</span>' : "No immediate replenishment risk", "orange", "AUTO-ALERT")}
      ${metric("PO drafts", number(state.purchase_orders.length), "Generated from inventory coverage rules", "green", "PROCUREMENT")}
    </div>
    <div class="section-grid">
      ${chartPanel("Stock coverage outlook", "Projected inventory depletion · next 30 days", "stock-chart", '<span class="chart-key"><span class="key-item"><span class="key-dot"></span>Units on hand</span></span>')}
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Purchase order drafts</h2><div class="panel-subtitle">Created automatically below 15 days of supply</div></div><span class="category-pill">${state.purchase_orders.length} drafts</span></div><div class="panel-content"><div class="po-list">${drafts}</div></div></section>
    </div>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Inventory by product</h2><div class="panel-subtitle">Days of supply = on-hand stock ÷ daily sales velocity</div></div></div>
      <div class="table-wrap"><table><thead><tr><th>Product</th><th>Stock cover</th><th>Velocity</th><th style="width:140px">Optimization</th><th>Risk status</th><th>PO draft</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function renderSellerStore() {
  const products = state.seller_store || [];
  const visible = products.filter((p) => p.visible);
  const hidden = products.filter((p) => !p.visible);
  const catalogNotAdded = state.products.filter((p) => !products.some((s) => s.asin === p.asin));
  const rows = products.map((product) => {
    const tone = product.visible ? "approved" : "denied";
    return `<tr><td><div class="product-name">${escapeHtml(product.name)}</div><div class="product-meta">${escapeHtml(product.sku)} · <span class="asin">${escapeHtml(product.asin)}</span></div></td>
      <td class="number-cell">${number(product.price, 2)}</td><td class="number-cell">${number(product.stock, 1)} units</td>
      <td>${escapeHtml(product.category)}</td>
      <td>${statusPill(tone)}</td>
      <td class="action-row"><button class="button ${product.visible ? "button-deny" : "button-approve"}" data-seller-toggle="${escapeHtml(product.id)}">${product.visible ? "Hide" : "Show"}</button></td></tr>`;
  }).join("");
  const addOptions = catalogNotAdded.map((p) => `<option value="${escapeHtml(p.asin)}">${escapeHtml(p.name)} (${escapeHtml(p.sku)})</option>`).join("");
  return `${heading("Seller Store", "Products listed and visible on your seller storefront.", "Marketplace")}
    <div class="metrics">
      ${metric("Listed products", number(products.length), `${visible.length} visible · ${hidden.length} hidden`, "blue", "SELLER STORE")}
      ${metric("Visible products", number(visible.length), "Live on storefront", "green", "VISIBLE")}
      ${metric("Hidden products", number(hidden.length), hidden.length ? '<span class="metric-change warn">Not shown to shoppers</span>' : "All products visible", hidden.length ? "orange" : "green", "HIDDEN")}
    </div>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Add product to seller store</h2><div class="panel-subtitle">Select from your catalog to list on the storefront</div></div></div>
      <div class="panel-content"><div class="catalog-controls"><label>Catalog product</label><select id="seller-store-add-select">${addOptions}</select></div><div style="margin-top:10px;"><button class="button button-primary" data-seller-add>${sellerStoreAddAsin ? "Selected: " + escapeHtml(sellerStoreAddAsin) : "Add to seller store"}</button></div></div></section>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Products on seller store</h2><div class="panel-subtitle">Toggle visibility to show/hide items from shoppers</div></div></div>
      <div class="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Category</th><th>Visibility</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty-state">No products listed yet. Add products from your catalog.</td></tr>'}</tbody></table></div></section>`;
}

function renderRepricer() {
  const rows = state.products.map((product) => {
    const gap = product.price - product.competitor_price;
    const position = gap <= 0 ? '<span class="status approved">At or below market</span>' : '<span class="status warning">Price opportunity</span>';
    const margin = payoutMargin(product);
    const marginTone = margin === null ? "pending" : margin >= 20 ? "approved" : margin >= 10 ? "warning" : "critical";
    const marginLabel = margin === null ? "—" : `${number(margin, 1)}%`;
    const headroom = product.price - product.min_floor;
    return `<tr><td><div class="product-name">${escapeHtml(product.name)}</div><div class="product-meta"><span class="asin">${escapeHtml(product.asin)}</span> · ${escapeHtml(product.sku)}</div></td>
      <td><div class="price">${money(product.price)}</div><div class="sub-price">Your offer</div></td>
      <td><span class="status ${marginTone}">${marginLabel}</span></td>
      <td><div class="price">${money(product.competitor_price)}</div><div class="sub-price">Lowest competitor</div></td>
      <td><div class="price">${money(product.min_floor)}</div><div class="sub-price">${money(headroom)} headroom</div></td>
      <td>${position}</td></tr>`;
  }).join("");
  return `${heading("Repricer monitor", "Competitive offers refresh every 10 seconds with a protected minimum margin floor.", "Pricing intelligence")}
    <div class="metrics">
      ${metric("Offers monitored", number(state.products.length), "Competitor prices fluctuate each cycle", "teal", "ACTIVE RULES")}
      ${metric("Floor protection", "100%", "No price can be set below your configured floor", "green", "GUARDRAIL")}
      ${metric("Matched offers", number(state.products.filter((product) => product.price <= product.competitor_price).length), "Priced at or below current competition", "orange", "BUY BOX POSITION")}
      ${metric("Last market update", state.last_updated ? new Date(state.last_updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Starting", "Competitor movement · $0.10–$1.50", "blue", "10-SECOND LOOP")}
    </div>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Live offer monitor</h2><div class="panel-subtitle">Price moves only when a competitor is below your offer and above your floor</div></div><span class="category-pill">Floor protected</span></div>
      <div class="table-wrap"><table><thead><tr><th>Product</th><th>Your price</th><th>Live payout margin %</th><th>Competitor</th><th>Min floor</th><th>Position</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <div style="height:14px"></div><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Repricing guardrail</h2><div class="panel-subtitle">One-cent Buy Box strategy with minimum price protection</div></div></div><div class="panel-content"><div class="note">When the lowest competitor falls below your offer but remains above your configured minimum floor, the simulator reprices to one cent below that offer. If the competitor breaches the floor, your offer is held. All changes are recorded in the activity log.</div></div></section>`;
}

function renderFeed(items, showCategory = true) {
  if (!items.length) return '<div class="empty-state">Waiting for the first simulator event.</div>';
  return `<div class="${showCategory ? "timeline" : "feed-list"}">${items.map((item) => `<div class="feed-item">
    <span class="feed-dot ${escapeHtml(item.category)}"></span>
    <div><div class="feed-title">${escapeHtml(item.title)}</div><div class="feed-detail">${escapeHtml(item.detail)}</div></div>
    ${showCategory ? `<span class="category-pill">${escapeHtml(item.category)}</span>` : `<span class="feed-time">${activityTime(item.timestamp)}</span>`}
  </div>`).join("")}</div>`;
}

function renderActivity() {
  const items = activityFilter === "all" ? state.activity : state.activity.filter((item) => item.category === activityFilter);
  const filters = ["all", "repricer", "ppc", "inventory", "procurement", "catalog", "approval", "sync"].map((filter) => `<button class="filter-button ${activityFilter === filter ? "active" : ""}" type="button" data-activity-filter="${filter}">${filter === "all" ? "All events" : filter.charAt(0).toUpperCase() + filter.slice(1)}</button>`).join("");
  return `${heading("Automation activity logs", "A timestamped record of every simulated pricing, advertising, and inventory decision.", "System audit")}
    <section class="panel"><div class="toolbar"><div class="table-count">${number(items.length)} events · newest first</div><div class="filter-group" role="group" aria-label="Filter activity">${filters}</div></div><div class="panel-content">${renderFeed(items, true)}</div></section>`;
}

function renderApprovals() {
  const revisions = (state.product_revisions || []).filter((revision) => revision.status === "pending_approval");
  const orders = state.orders.filter((order) => approvalFilter === "all" || order.status === approvalFilter);
  const filters = ["pending", "approved", "denied", "all"].map((filter) => `<button class="filter-button ${approvalFilter === filter ? "active" : ""}" type="button" data-approval-filter="${filter}">${filter.charAt(0).toUpperCase() + filter.slice(1)}</button>`).join("");
  const orderRows = orders.map((order) => `<tr><td><span class="order-id">${escapeHtml(order.id)}</span><div class="product-meta">${escapeHtml(order.product_name)}</div></td>
    <td><div class="product-name">${escapeHtml(order.supplier)}</div><div class="product-meta">${escapeHtml(order.category)}</div></td>
    <td class="number-cell">${number(order.units)} units</td><td class="price">${money(order.amount)}</td>
    <td><div>${statusPill(order.status)}</div><div class="product-meta">${escapeHtml(order.reason)}</div></td>
    <td>${order.status === "pending" ? `<div class="action-row"><button class="button button-approve" type="button" data-decision="approve" data-order-id="${escapeHtml(order.id)}">Approve</button><button class="button button-deny" type="button" data-decision="deny" data-order-id="${escapeHtml(order.id)}">Deny</button></div>` : `<span class="product-meta">${escapeHtml(order.reviewed_by || "Reviewed")}</span>`}</td></tr>`).join("");
  const revisionRows = revisions.map((revision) => {
    const product = (state.products || []).find((item) => item.id === revision.product_id);
    const changeRows = Object.entries(revision.field_changes || {}).map(([field, change]) => `<tr><td class="diff-label">${escapeHtml(field)}</td><td class="diff-before">${Array.isArray(change.before) ? change.before.join(" | ") : change.before === "" ? "—" : escapeHtml(String(change.before))}</td><td class="diff-arrow">→</td><td class="diff-after">${Array.isArray(change.after) ? change.after.join(" | ") : change.after === "" ? "—" : escapeHtml(String(change.after))}</td></tr>`).join("");
    return `<tr><td><div class="product-name">${escapeHtml(product ? (product.title || product.name) : "—")}</div><div class="product-meta">${escapeHtml(product ? product.sku : "—")} · ${escapeHtml(product ? product.asin : "—")}</div></td>
      <td class="revision-meta">${changeRows || '<span class="product-meta">No field changes</span>'}</td>
      <td class="number-cell">${activityTime(revision.created_at)}</td>
      <td class="action-row"><button class="button button-approve" type="button" data-approve-rev="${escapeHtml(revision.id)}">Approve</button><button class="button button-deny" type="button" data-reject-rev="${escapeHtml(revision.id)}">Reject</button></td></tr>`;
  }).join("");
  return `${heading("Listing approvals", "Review optimization drafts before they are applied to the shared product record and republished to the mock Amazon catalog.", "Administration")}
    <div class="metrics">
      ${metric("Awaiting decision", number(revisions.length), "Revisions require an approver before publishing", "orange", "PENDING")}
      ${metric("Approved drafts", number((state.product_revisions || []).filter((revision) => revision.status === "approved").length), "Approved revisions are published to mock Amazon", "green", "PUBLISHED")}
      ${metric("Rejected drafts", number((state.product_revisions || []).filter((revision) => revision.status === "rejected").length), "Rejected drafts return the product to needs optimization", "orange", "REJECTED")}
      ${metric("Reviewed by", escapeHtml(state.manager.name), escapeHtml(state.manager.role), "blue", "MANAGER PROFILE")}
    </div>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Pending revisions</h2><div class="panel-subtitle">Before/after diff per listing field · approving writes to the product and its marketplace listings</div></div></div>
      <div class="table-wrap"><table><thead><tr><th>Product</th><th>Field changes (before → after)</th><th>Submitted</th><th>Manager action</th></tr></thead><tbody>${revisionRows || '<tr><td colspan="4"><div class="empty-state">No listing revisions are awaiting approval.</div></td></tr>'}</tbody></table></div></section>
    <section class="panel"><div class="toolbar"><div class="table-count">${number(orders.length)} purchase workflows shown · ${escapeHtml(state.manager.name)} is the active approver</div><div class="filter-group" role="group" aria-label="Filter purchase workflows">${filters}</div></div>
      <div class="table-wrap"><table><thead><tr><th>Workflow</th><th>Supplier</th><th>Quantity</th><th>Amount</th><th>Status / reason</th><th>Manager action</th></tr></thead><tbody>${orderRows || '<tr><td colspan="6"><div class="empty-state">No workflows in this view.</div></td></tr>'}</tbody></table></div></section>`;
}


function makeLabels(count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - index - 1));
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

function mountCharts(view) {
  charts.forEach((chart) => chart.destroy());
  charts = [];
  if (!window.Chart) return;
  Chart.defaults.font.family = '"Amazon Ember", "Segoe UI", Arial, sans-serif';
  Chart.defaults.color = "#74828d";
  const grid = "#edf1f2";
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    plugins: { legend: { display: false }, tooltip: { padding: 10, displayColors: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0, font: { size: 9 } } },
      y: { grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { padding: 9, font: { size: 9 } } },
    },
  };
  const acosCanvas = document.getElementById("acos-chart");
  if (acosCanvas) {
    const values = state.acos_history;
    const gradient = acosCanvas.getContext("2d").createLinearGradient(0, 0, 0, 230);
    gradient.addColorStop(0, "#0071852d");
    gradient.addColorStop(1, "#00718500");
    charts.push(new Chart(acosCanvas, {
      type: "line",
      data: { labels: makeLabels(values.length), datasets: [{ data: values, borderColor: "#007185", backgroundColor: gradient, fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.34 }] },
      options: { ...lineOptions, scales: { ...lineOptions.scales, y: { ...lineOptions.scales.y, suggestedMin: 0, ticks: { ...lineOptions.scales.y.ticks, callback: (value) => `${value}%` } } }, plugins: { ...lineOptions.plugins, tooltip: { ...lineOptions.plugins.tooltip, callbacks: { label: (context) => ` ${context.parsed.y.toFixed(1)}% ACoS` } } } },
    }));
  }
  const spendCanvas = document.getElementById("spend-chart");
  if (spendCanvas) {
    const totals = new Map();
    state.orders.filter((order) => order.status !== "denied").forEach((order) => totals.set(order.category, (totals.get(order.category) || 0) + order.amount));
    const palette = ["#007185", "#ff9900", "#557fae", "#64a587", "#a5b5bd"];
    charts.push(new Chart(spendCanvas, {
      type: "doughnut",
      data: { labels: [...totals.keys()], datasets: [{ data: [...totals.values()], backgroundColor: palette, borderWidth: 3, borderColor: "#ffffff", hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "67%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, padding: 15, font: { size: 9 } } }, tooltip: { padding: 10, callbacks: { label: (context) => ` ${context.label}: ${money(context.raw, 0)}` } } } },
    }));
  }
  const stockCanvas = document.getElementById("stock-chart");
  if (stockCanvas) {
    const products = [...state.products].sort((left, right) => daysOfSupply(left) - daysOfSupply(right)).slice(0, 3);
    const colors = ["#b9433c", "#007185", "#ff9900"];
    const days = Array.from({ length: 30 }, (_, index) => index);
    charts.push(new Chart(stockCanvas, {
      type: "line",
      data: { labels: days.map((day) => day === 0 ? "Today" : `Day ${day}`), datasets: products.map((product, index) => ({ label: product.name, data: days.map((day) => Math.max(0, product.stock - product.daily_velocity * day)), borderColor: colors[index], backgroundColor: "transparent", borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.22 })) },
      options: { ...lineOptions, plugins: { ...lineOptions.plugins, legend: { display: true, position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, padding: 12, font: { size: 9 } } } }, scales: { ...lineOptions.scales, y: { ...lineOptions.scales.y, beginAtZero: true, title: { display: true, text: "Units", font: { size: 9, weight: "normal" } } } } },
    }));
  }
}

function hasFocusedControl() {
  const active = document.activeElement;
  return (app.contains(active) && active.matches("a, button, summary, input, select, [tabindex]"))
    || Boolean(app.querySelector("a:hover, button:hover, summary:hover, [tabindex]:hover"));
}

function focusSelector(active) {
  if (!active || !app.contains(active)) return null;
  if (active.matches("[data-action]")) return `[data-action="${active.dataset.action}"]`;
  if (active.matches("[data-activity-filter]")) return `[data-activity-filter="${active.dataset.activityFilter}"]`;
  if (active.matches("[data-approval-filter]")) return `[data-approval-filter="${active.dataset.approvalFilter}"]`;
  if (active.matches("[data-decision]")) return `[data-decision="${active.dataset.decision}"][data-order-id="${active.dataset.orderId}"]`;
  if (active.matches(".review-list summary")) return `[data-review-index="${active.parentElement.dataset.reviewIndex}"] summary`;
  if (active.matches("a[href]")) return `a[href="${active.getAttribute("href")}"]`;
  return active.id ? `#${CSS.escape(active.id)}` : null;
}

function render() {
  if (!state) return;
  const focusedElement = document.activeElement;
  const previousFocus = focusSelector(focusedElement);
  const expandedReviews = new Set([...app.querySelectorAll(".review-list details[open]")].map((detail) => detail.dataset.reviewIndex));
  renderPending = false;
  const view = currentView();
  const pages = {
    overview: renderOverview,
    catalog: renderCatalog,
    ppc: renderPpc,
    inventory: renderInventory,
    "seller-store": renderSellerStore,
    repricer: renderRepricer,
    activity: renderActivity,
    approvals: renderApprovals,
    how: renderHow,
  };
  renderShell(view, pages[view]());
  app.querySelectorAll(".review-list details").forEach((detail) => {
    detail.open = expandedReviews.has(detail.dataset.reviewIndex);
  });
  if (previousFocus) app.querySelector(previousFocus)?.focus({ preventScroll: true });
}

async function fetchState(forceRender = true) {
  const response = await fetch("/api/state", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`State request failed (${response.status})`);
  state = await response.json();
  if (forceRender) render();
}

// ------------------------------------------------------------------ shared products data layer
// Single ["products"] query-key family. Every page reads the same product records
// (state.products, refreshed from /api/state) and every mutation calls
// invalidateProducts() so all pages refresh without a manual reload.
const productCache = {
  data: null,
  summary: null,
  error: null,
  loading: false,
};
const viewState = {
  drawerId: null,
  drawerMode: "optimize",
  addModal: false,
  addTab: "import",
  selectedIds: [],
};
const catalogFilter = {
  opt_status: "", low_stock: false, suppressed: false,
  search: "", sort: "", page: 1, page_size: 200,
};

async function fetchJson(url, init = {}) {
  const headers = { Accept: "application/json", ...init.headers };
  if (init.body && !(init.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(url, { ...init, headers });
  const contentType = response.headers.get("content-type") || "";
  let payload;
  if (contentType.includes("application/json")) {
    try { payload = await response.json(); } catch { payload = null; }
  } else {
    const text = await response.text();
    throw new Error(`Server returned ${response.status} ${response.statusText}${text ? ` · ${text.slice(0, 120)}` : ""}`);
  }
  if (!response.ok) throw new Error((payload && payload.detail) || `Request failed (${response.status})`);
  return payload;
}

async function loadProducts() {
  productCache.loading = true;
  try {
    const [list, summary] = await Promise.all([
      fetchJson("/api/products?page_size=200"),
      fetchJson("/api/overview/summary"),
    ]);
    productCache.data = list.products || [];
    productCache.summary = summary || {};
    productCache.error = null;
  } catch (error) {
    productCache.error = error.message;
    productCache.data = productCache.data || [];
    productCache.summary = productCache.summary || {};
  } finally {
    productCache.loading = false;
  }
}

async function invalidateProducts() {
  await Promise.all([fetchState(false), loadProducts()]);
  render();
}

function productById(id) {
  return (productCache.data || []).find((product) => product.id === id) ||
    (state.products || []).find((product) => product.id === id);
}

async function addProductManually(form) {
  const body = {
    name: form.elements.namedItem("add-name").value.trim(),
    sku: form.elements.namedItem("add-sku").value.trim(),
    asin: form.elements.namedItem("add-asin").value.trim(),
    title: form.elements.namedItem("add-title").value.trim() || undefined,
    category: form.elements.namedItem("add-category").value.trim() || undefined,
    price: form.elements.namedItem("add-price").value || undefined,
    stock: form.elements.namedItem("add-stock").value || undefined,
    daily_velocity: form.elements.namedItem("add-velocity").value || undefined,
  };
  const product = await fetchJson("/api/products", { method: "POST", body: JSON.stringify(body) });
  viewState.addModal = false;
  form.reset();
  showToast(`Product added · ${product.product.asin}`);
  await invalidateProducts();
  return product;
}

async function importFromAmazon(ref) {
  const product = await fetchJson("/api/products/import", {
    method: "POST",
    body: JSON.stringify({ asin: ref }),
  });
  viewState.addModal = false;
  showToast(`Imported · ${product.product.asin}`);
  await invalidateProducts();
  return product;
}

async function patchProduct(id, body) {
  await fetchJson(`/api/products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
  await invalidateProducts();
}

async function optimizeProduct(id, suggested, saveDraft) {
  const result = await fetchJson(`/api/products/${encodeURIComponent(id)}/optimize`, {
    method: "POST",
    body: JSON.stringify({ suggested, save_draft: !!saveDraft }),
  });
  viewState.drawerId = null;
  showToast(saveDraft ? "Draft saved" : "Optimization sent to approval");
  await invalidateProducts();
  return result;
}

async function submitOptimize(productId, saveDraft) {
  const form = document.getElementById("optimize-form");
  if (!form) return;
  const formData = new FormData(form);
  const bullets = formData.get("bullets").split("\n").map((line) => line.trim()).filter((line) => line.length);
  const keywords = formData.get("backend_keywords").split(",").map((keyword) => keyword.trim()).filter((keyword) => keyword.length);
  const suggested = {
    title: formData.get("title"),
    bullets,
    backend_keywords: keywords,
    description: formData.get("description"),
  };
  await optimizeProduct(productId, suggested, saveDraft);
}

async function optimizeBulkSelected() {
  const ids = viewState.selectedIds;
  if (!ids.length) return;
  const result = await fetchJson("/api/products/optimize-bulk", {
    method: "POST",
    body: JSON.stringify({ product_ids: ids }),
  });
  viewState.selectedIds = [];
  showToast(`Bulk optimization · ${result.count} draft(s) sent to approval`);
  await invalidateProducts();
  return result;
}

async function decideRevision(revisionId, action) {
  await fetchJson(`/api/approvals/${encodeURIComponent(revisionId)}/${action}`, { method: "POST", body: JSON.stringify({}) });
  await invalidateProducts();
}

async function syncSellerData() {
  await fetchJson("/api/sync", { method: "POST", body: JSON.stringify({}) });
  showToast("Mock Amazon sync started");
  await invalidateProducts();
}

function syncAgeBadge(summary) {
  const sync = summary && summary.sync;
  if (!sync || sync.status !== "completed") return "Not connected";
  const completed = sync.completed_at || sync.started_at;
  if (!completed) return "Synced";
  const minutes = Math.round((Date.now() - new Date(completed).getTime()) / 60000);
  return `Synced ${minutes} min ago`;
}


function showToast(message, isError = false) {
  const root = document.querySelector("#toast-root");
  if (!root) return;
  window.clearTimeout(toastTimer);
  root.innerHTML = `<div class="toast ${isError ? "error" : ""}" role="status">${escapeHtml(message)}</div>`;
  toastTimer = window.setTimeout(() => { root.innerHTML = ""; }, 3400);
}

async function decideOrder(button) {
  const orderId = button.dataset.orderId;
  const action = button.dataset.decision;
  button.disabled = true;
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Could not update this workflow");
    await fetchState();
    showToast(`${orderId} ${action === "approve" ? "approved" : "denied"} by ${state.manager.name}.`);
  } catch (error) {
    button.disabled = false;
    showToast(error.message, true);
  }
}

async function stageAgentAction(button) {
  const action = button.dataset.agentAction;
  let request = { action };
  if (action === "catalog_push") {
    request.asin = button.dataset.asin;
  } else {
    request.items = state.products
      .filter((product) => product.stock / Math.max(product.daily_velocity, 1) < 30)
      .map((product) => ({ sku: product.sku, units: Math.max(1, Math.ceil(product.daily_velocity * 45 - product.stock)) }));
  }
  button.disabled = true;
  try {
    const response = await fetch("/api/agent-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Could not stage this agent action");
    await fetchState();
    showToast(payload.message || "Action staged in sandbox. No external system was contacted.");
  } catch (error) {
    button.disabled = false;
    showToast(error.message, true);
  }
}

async function sendPoToQueue(button) {
  button.disabled = true;
  try {
    const response = await fetch("/api/agent-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "procurement_po", items: [{ sku: button.dataset.sku, units: Number(button.dataset.units) }] }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Could not queue this purchase order");
    await fetchState();
    showToast("Purchase order staged in the sandbox queue. No supplier was contacted.");
  } catch (error) {
    button.disabled = false;
    showToast(error.message, true);
  }
}

document.addEventListener("click", async (event) => {
  const refreshButton = event.target.closest('[data-action="refresh"]');
  if (refreshButton) {
    refreshButton.disabled = true;
    try {
      await fetchState();
      showToast("Dashboard snapshot refreshed.");
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }
  const decisionButton = event.target.closest("[data-decision]");
  if (decisionButton) {
    await decideOrder(decisionButton);
    return;
  }
  const poButton = event.target.closest("[data-send-po]");
  if (poButton) {
    await sendPoToQueue(poButton);
    return;
  }
  const agentButton = event.target.closest("[data-agent-action]");
  if (agentButton) {
    await stageAgentAction(agentButton);
    return;
  }
  const catalogButton = event.target.closest("[data-catalog-select]");
  if (catalogButton) {
    selectedCatalogAsin = catalogButton.dataset.catalogSelect;
    render();
    return;
  }
  const activityButton = event.target.closest("[data-activity-filter]");
  if (activityButton) {
    activityFilter = activityButton.dataset.activityFilter;
    render();
    return;
  }
  const approvalButton = event.target.closest("[data-approval-filter]");
  if (approvalButton) {
    approvalFilter = approvalButton.dataset.approvalFilter;
    render();
  }
  const sellerAddButton = event.target.closest("[data-seller-add]");
  if (sellerAddButton) {
    if (!sellerStoreAddAsin) {
      showToast("Please select a product from the catalog first.", true);
      return;
    }
    sellerAddButton.disabled = true;
    try {
      const response = await fetch("/api/seller-store/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ asin: sellerStoreAddAsin }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not add product to seller store");
      await fetchState();
      sellerStoreAddAsin = "";
      showToast(payload.message || "Product added to seller store.");
    } catch (error) {
      sellerAddButton.disabled = false;
      showToast(error.message, true);
    }
    return;
  }
  const sellerToggleButton = event.target.closest("[data-seller-toggle]");
  if (sellerToggleButton) {
    sellerToggleButton.disabled = true;
    try {
      const response = await fetch(`/api/seller-store/${sellerToggleButton.dataset.sellerToggle}/toggle-visibility`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not update visibility");
      await fetchState();
      showToast(`Product visibility set to ${payload.product.visible ? "visible" : "hidden"} in seller store.`);
    } catch (error) {
      sellerToggleButton.disabled = false;
      showToast(error.message, true);
    }
    return;
  }

  const optimizeButton = event.target.closest("[data-optimize]");
  if (optimizeButton) {
    event.preventDefault();
    viewState.drawerId = optimizeButton.dataset.optimize;
    viewState.drawerMode = "optimize";
    render();
    return;
  }
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    event.preventDefault();
    viewState.drawerId = viewButton.dataset.view;
    viewState.drawerMode = "view";
    render();
    return;
  }
  if (event.target.matches("[data-save-draft]")) {
    event.preventDefault();
    await submitOptimize(event.target.dataset.saveDraft, true);
    return;
  }
  if (event.target.matches("[data-send-approval]")) {
    event.preventDefault();
    await submitOptimize(event.target.dataset.sendApproval, false);
    return;
  }
  if (event.target.matches("[data-action='close-drawer'], [data-action='close-add-modal']")) {
    event.preventDefault();
    viewState.drawerId = null;
    viewState.addModal = false;
    render();
    return;
  }
  if (event.target.matches("[data-add-tab]")) {
    event.preventDefault();
    viewState.addTab = event.target.dataset.addTab;
    render();
    return;
  }
  if (event.target.matches("[data-action='sync-seller']")) {
    event.preventDefault();
    await syncSellerData();
    return;
  }
  if (event.target.matches("[data-action='refresh-overview']")) {
    event.preventDefault();
    await invalidateProducts();
    return;
  }
  if (event.target.matches("[data-action='bulk-optimize']")) {
    event.preventDefault();
    await optimizeBulkSelected();
    return;
  }
  if (event.target.matches("[data-action='add-product']")) {
    event.preventDefault();
    viewState.addModal = true;
    viewState.addTab = "import";
    render();
    return;
  }
  if (event.target.matches(".row-select")) {
    const id = event.target.dataset.rowId;
    if (event.target.checked) {
      if (!viewState.selectedIds.includes(id)) viewState.selectedIds.push(id);
    } else {
      viewState.selectedIds = viewState.selectedIds.filter((selected) => selected !== id);
    }
    render();
    return;
  }
  if (event.target.matches("[data-select-all]")) {
    const pageIds = (document.querySelectorAll(".row-select:checked") ? [] : []);
    const visibleIds = Array.from(document.querySelectorAll(".row-select")).map((checkbox) => checkbox.dataset.rowId);
    if (event.target.checked) {
      viewState.selectedIds = [...new Set([...viewState.selectedIds, ...visibleIds])];
    } else {
      viewState.selectedIds = viewState.selectedIds.filter((id) => !visibleIds.includes(id));
    }
    render();
    return;
  }
  if (event.target.matches("[data-filter]")) {
    const key = event.target.dataset.filter;
    const value = event.target.dataset.filterValue;
    if (key === "low_stock") catalogFilter.low_stock = value === "true";
    else if (key === "suppressed") catalogFilter.suppressed = value === "true";
    else { catalogFilter.opt_status = value; }
    catalogFilter.page = 1;
    render();
    return;
  }
  if (event.target.matches("[data-page]")) {
    catalogFilter.page = Number(event.target.dataset.page);
    render();
    return;
  }
  if (event.target.matches("[data-approve-rev]")) {
    event.preventDefault();
    await decideRevision(event.target.dataset.approveRev, "approve");
    return;
  }
  if (event.target.matches("[data-reject-rev]")) {
    event.preventDefault();
    await decideRevision(event.target.dataset.rejectRev, "reject");
    return;
  }
  const navLink = event.target.closest("a[href]");
  if (navLink) {
    const href = navLink.getAttribute("href");
    if (href && !href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:") && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      window.history.pushState({}, "", href);
      render();
      return;
    }
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-bid-toggle]")) {
    autonomousBids = event.target.checked;
    render();
    return;
  }
  if (event.target.matches("[data-catalog-product]")) {
    selectedCatalogAsin = event.target.value;
    render();
  }
  if (event.target.id === "seller-store-add-select") {
    sellerStoreAddAsin = event.target.value;
    render();
  }
  if (event.target.id === "catalog-search") {
    catalogFilter.search = event.target.value;
    catalogFilter.page = 1;
    render();
  }
});

document.addEventListener("submit", async (event) => {
  const addCatalogForm = event.target.closest("#add-catalog-product-form");
  if (addCatalogForm) {
    event.preventDefault();
    const formData = new FormData(addCatalogForm);
    const payload = {
      name: formData.get("name"),
      sku: formData.get("sku"),
      asin: formData.get("asin"),
      category: formData.get("category"),
      price: parseFloat(formData.get("price")),
      stock: parseFloat(formData.get("stock")),
      daily_velocity: formData.get("daily_velocity") ? parseFloat(formData.get("daily_velocity")) : undefined,
      supplier: formData.get("supplier") || undefined,
    };
    const submitBtn = addCatalogForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Adding...";
    try {
      const response = await fetch("/api/catalog-products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Could not add product to catalog");
      await fetchState();
      addCatalogForm.reset();
      showToast(result.message || "Product added to catalog.");
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Add Product to Catalog";
      showToast(error.message, true);
    }
    return;
  }
  const importForm = event.target.closest("#add-import-form");
  if (importForm) {
    event.preventDefault();
    const ref = importForm.elements.namedItem("ref").value.trim();
    if (!ref) return;
    const submitBtn = importForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Importing...";
    try {
      await importFromAmazon(ref);
      importForm.reset();
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Import";
      showToast(error.message, true);
    }
    return;
  }
  const manualForm = event.target.closest("#add-manual-form");
  if (manualForm) {
    event.preventDefault();
    await addProductManually(manualForm);
    return;
  }
});

window.addEventListener("popstate", render);
document.addEventListener("focusout", () => {
  window.setTimeout(() => {
    if (renderPending && !hasFocusedControl()) render();
  }, 0);
}, true);
document.addEventListener("pointerout", (event) => {
  const target = event.target instanceof Element ? event.target.closest("a, button, summary, [tabindex]") : null;
  const related = event.relatedTarget instanceof Element ? event.relatedTarget.closest("a, button, summary, [tabindex]") : null;
  if (target && !related) {
    window.setTimeout(() => {
      if (renderPending && !hasFocusedControl()) render();
    }, 0);
  }
}, true);

async function start() {
  try {
    await fetchState();
    await loadProducts();
  } catch (error) {
    app.innerHTML = `<main class="boot-screen"><div><p>Could not connect to the AmzSphere API.</p><p>${escapeHtml(error.message)}</p></div></main>`;
    return;
  }
  window.setInterval(async () => {
    try {
      const previousUpdate = state.last_updated;
      const response = await fetch("/api/simulator/tick", { method: "POST", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Simulator request failed (${response.status})`);
      state = await response.json();
      if (state.last_updated !== previousUpdate) {
        renderPending = true;
        await loadProducts();
        if (!hasFocusedControl()) render();
      }
    } catch (error) {
      console.warn("Dashboard refresh failed", error);
    }
  }, 10000);
}

start();