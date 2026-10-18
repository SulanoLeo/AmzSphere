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
  const view = window.location.hash.replace(/^#\/?/, "");
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
  const pendingApprovals = state.orders.filter((order) => order.status === "pending").length;
  const menu = navigation.map(([key, code, label]) => `<a class="nav-link ${view === key ? "active" : ""}" href="#/${key}" ${view === key ? 'aria-current="page"' : ""}>
    <span class="nav-code">${code}</span><span>${label}</span>${key === "approvals" && pendingApprovals ? `<span class="nav-count">${pendingApprovals}</span>` : ""}
  </a>`).join("");
  const manager = state.manager;
  app.innerHTML = `<div class="layout">
    <aside class="sidebar">
      <a class="brand" href="#/overview" aria-label="AmzSphere overview">
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
  </div><div id="toast-root" aria-live="polite"></div>`;
  mountCharts(view);
}

function renderOverview() {
  const totalStock = state.products.reduce((sum, product) => sum + product.stock, 0);
  const pending = state.orders.filter((order) => order.status === "pending").length;
  const critical = state.products.filter((product) => daysOfSupply(product) < 15).length;
  const current = currentAcos();
  const recentActivity = state.activity.slice(0, 5);
  const reviews = [...state.reviews].sort((a, b) => a.rating - b.rating || b.date.localeCompare(a.date)).slice(0, 5);
  const insight = reviewInsight();
  const body = `${heading("Operations overview", "A live read on marketplace health, automation, and inventory exposure.")}
    <div class="metrics">
      ${metric("Portfolio ACoS", `${number(current, 1)}<span style="font:500 13px var(--font-ui)">%</span>`, acosDeltaLabel() + " over 30 days", "teal", "LAST 30 DAYS")}
      ${metric("Units on hand", number(totalStock), `${state.products.length} active SKUs across the catalog`, "blue", "INVENTORY")}
      ${metric("Pending approvals", number(pending), `${money(state.orders.filter((order) => order.status === "pending").reduce((sum, order) => sum + order.amount, 0), 0)} committed spend`, "orange", "B2B WORKFLOWS")}
      ${metric("Critical stock alerts", number(critical), critical ? '<span class="metric-change warn">Action required</span> · PO draft automation on' : "All products above reorder threshold", "green", "DAYS OF SUPPLY")}
    </div>
    <div class="section-grid">
      ${chartPanel("Advertising efficiency", "Portfolio ACoS · 30-day trend", "acos-chart", '<span class="chart-key"><span class="key-item"><span class="key-dot"></span>ACoS</span></span>')}
      ${chartPanel("Procurement mix", "Open and approved workflow value", "spend-chart")}
    </div>
    ${renderProcurementQueue()}
    <div class="section-grid">
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Automation activity</h2><div class="panel-subtitle">Latest decisions from the background engine</div></div><a class="button" href="#/activity">View all</a></div>
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
  if (!state.products.some((product) => product.asin === selectedCatalogAsin)) selectedCatalogAsin = state.products[0]?.asin || "";
  const selected = state.products.find((product) => product.asin === selectedCatalogAsin);
  const profile = profileFor(selected);
  const rows = state.products.map((product) => {
    const item = profileFor(product);
    const sync = (state.execution_queue || []).some((job) => job.type === "catalog_push" && job.asin === product.asin && job.status === "synced");
    return `<tr class="${product.asin === selectedCatalogAsin ? "selected-row" : ""}"><td><button type="button" class="table-select" data-catalog-select="${escapeHtml(product.asin)}">${escapeHtml(product.asin)}</button><div class="product-meta">${escapeHtml(product.sku)}</div></td><td class="number-cell">${item.rank ? "#" + item.rank : "—"}</td><td><div class="gap-list">${item.gaps.map((gap) => `<span>${escapeHtml(gap)}</span>`).join("")}</div></td><td><span class="status ${sync ? "approved" : "pending"}">${sync ? "Synced" : "Staged"}</span></td></tr>`;
  }).join("");
  const queued = (state.execution_queue || []).some((job) => job.type === "catalog_push" && job.asin === selectedCatalogAsin && job.status === "staged");
  return `${heading("SEO & Catalog Agent", "Remap listing content against observed search demand, review keyword gaps, and stage controlled updates.", "Catalog operations")}
    <div class="catalog-controls"><label for="catalog-product">Listing</label><select id="catalog-product" data-catalog-product>${state.products.map((product) => `<option value="${escapeHtml(product.asin)}" ${product.asin === selectedCatalogAsin ? "selected" : ""}>${escapeHtml(product.name)} · ${escapeHtml(product.asin)}</option>`).join("")}</select><span class="status pending">Sandbox · staged only</span></div>
    <div class="catalog-compare">
      <section class="panel listing-panel"><div class="panel-header"><div><h2 class="panel-title">Current live listing copy</h2><div class="panel-subtitle">Snapshot view · ${escapeHtml(selected.asin)}</div></div><span class="status pending">Current</span></div><div class="panel-content"><div class="listing-field"><span>Title</span><p>${escapeHtml(profile.currentTitle)}</p></div><div class="listing-field"><span>Key features</span><ul>${profile.currentBullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul></div><div class="listing-meta"><span>Organic rank</span><strong>${profile.rank ? "#" + profile.rank : "—"}</strong><span>Catalog source</span><strong>Mock snapshot</strong></div></div></section>
      <section class="panel listing-panel optimized-panel"><div class="panel-header"><div><h2 class="panel-title">AI-optimized / remapped listing copy</h2><div class="panel-subtitle">Suggested draft · keyword coverage mapped</div></div><span class="status warning">Review required</span></div><div class="metric-badges"><span class="metric-badge">🔍 Search Volume: 45k/mo</span><span class="metric-badge good">🎯 Keyword Difficulty: Low</span></div><div class="panel-content"><div class="listing-field"><span>Proposed title</span><p>${escapeHtml(profile.optimizedTitle)}</p></div><div class="listing-field"><span>Proposed key features</span><ul>${profile.optimizedBullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul></div><div class="listing-meta"><span>Target gaps</span><strong>${profile.gaps.length} mapped</strong><span>Sync state</span><strong>${queued ? "Staged in sandbox" : "Not submitted"}</strong></div></div></section>
    </div>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Add new product to catalog</h2><div class="panel-subtitle">Create a new catalog listing that appears across inventory, procurement, and seller store</div></div></div>
      <div class="panel-content"><form id="add-catalog-product-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;align-items:end;">
        <div><label style="display:block;margin-bottom:4px;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;">Product Name</label><input name="name" type="text" placeholder="e.g. Bamboo Desk Organizer" required style="width:100%;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
        <div><label style="display:block;margin-bottom:4px;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;">SKU</label><input name="sku" type="text" placeholder="e.g. BD-OG-01" required style="width:100%;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
        <div><label style="display:block;margin-bottom:4px;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;">ASIN</label><input name="asin" type="text" placeholder="e.g. B0XYZ12345" required style="width:100%;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
        <div><label style="display:block;margin-bottom:4px;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;">Category</label><input name="category" type="text" placeholder="e.g. Office" required style="width:100%;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
        <div><label style="display:block;margin-bottom:4px;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;">Price ($)</label><input name="price" type="number" step="0.01" placeholder="24.99" required style="width:100%;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
        <div><label style="display:block;margin-bottom:4px;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;">Stock Units</label><input name="stock" type="number" step="1" placeholder="500" required style="width:100%;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
        <div><label style="display:block;margin-bottom:4px;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;">Daily Velocity</label><input name="daily_velocity" type="number" step="0.1" placeholder="15" style="width:100%;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
        <div><label style="display:block;margin-bottom:4px;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;">Supplier</label><input name="supplier" type="text" placeholder="e.g. Acme Mfg" style="width:100%;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font:inherit;font-size:11px;"></div>
        <button type="submit" class="button button-primary" style="min-height:36px;padding:0 16px;">Add Product to Catalog</button>
      </form></div></section>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Organic indexing and keyword gaps</h2><div class="panel-subtitle">Ranks and gaps are illustrative until connected to approved search data</div></div><span class="category-pill">${state.products.length} ASINs</span></div><div class="table-wrap"><table><thead><tr><th>ASIN</th><th>Current organic indexing rank</th><th>Keyword gaps detected</th><th>Sync status</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <div class="catalog-action"><div><strong>Seller Central update</strong><span>Approval stages the selected draft in this sandbox; an SP-API worker is not configured.</span></div><button class="button button-primary" type="button" data-agent-action="catalog_push" data-asin="${escapeHtml(selectedCatalogAsin)}" ${queued ? "disabled" : ""}>Approve &amp; Push to Seller Central via SP-API</button></div>`;
}

function renderHow() {
  return `${heading("How AmzSphere works", "A transparent walkthrough of each simulator cycle, decision rule, and deployment mode.", "System guide")}
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">One cycle, start to finish</h2><div class="panel-subtitle">The same simulator rules run locally and in the hosted mock environment</div></div><span class="category-pill">10-second decision interval</span></div>
      <div class="panel-content"><div class="flow-steps">
        <div class="flow-step"><span class="flow-number">01</span><div><div class="flow-title">Read current state</div><div class="flow-copy">The dashboard loads products, keyword metrics, approvals, review samples, and recent activity from the API.</div></div><span class="flow-endpoint">GET /api/state</span></div>
        <div class="flow-step"><span class="flow-number">02</span><div><div class="flow-title">Advance the mock market</div><div class="flow-copy">Every 10 seconds an active dashboard requests a tick. The backend checks the last update time, so simultaneous requests do not advance the same interval twice.</div></div><span class="flow-endpoint">POST /api/simulator/tick</span></div>
        <div class="flow-step"><span class="flow-number">03</span><div><div class="flow-title">Evaluate automation rules</div><div class="flow-copy">Competitor prices move, qualified search terms are classified, and unit stock burns down from configured daily velocity.</div></div><span class="flow-endpoint">MockSimulator.tick()</span></div>
        <div class="flow-step"><span class="flow-number">04</span><div><div class="flow-title">Persist and report decisions</div><div class="flow-copy">New prices, keyword actions, low-stock drafts, and activity records are saved before the dashboard refreshes.</div></div><span class="flow-endpoint">JSON locally · Supabase on Vercel</span></div>
        <div class="flow-step"><span class="flow-number">05</span><div><div class="flow-title">Multi-channel product sync</div><div class="flow-copy">Product edits write to global_products instantly, mark marketplace listings as Syncing..., then a 3-second background timer flips them to Live & In Sync.</div></div><span class="flow-endpoint">POST /api/products/sync</span></div>
        <div class="flow-step"><span class="flow-number">06</span><div><div class="flow-title">Logistics & delivery tracking</div><div class="flow-copy">Shipment webhooks update order_shipments and drive the step-progress bars and tracking grid in real time.</div></div><span class="flow-endpoint">POST /api/webhooks/shipping</span></div>
      </div></div>
    </section>
    <div class="section-grid equal">
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Repricer rules</h2><div class="panel-subtitle">Competition updates each simulator tick</div></div><a class="button" href="#/repricer">Open monitor</a></div><div class="panel-content"><div class="rule-equation">Competitor − $0.01</div><p class="flow-copy">When a competitor is below your offer and above your minimum floor, the offer moves one cent below the competitor. It never prices below the floor. Competitor movement is randomized by $0.10–$1.50.</p></div></section>
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">PPC keyword rules</h2><div class="panel-subtitle">Customer search-term pool</div></div><a class="button" href="#/ppc">Open PPC engine</a></div><div class="panel-content"><div class="rule-line"><span class="status approved">Promote</span><span>&gt;5 conversions and &lt;25% ACoS adds an exact target.</span></div><div class="rule-line"><span class="status denied">Exclude</span><span>&gt;15 clicks and 0 conversions adds a negative.</span></div></div></section>
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Inventory rules</h2><div class="panel-subtitle">Velocity converts to a 10-second stock decrement</div></div><a class="button" href="#/inventory">Open inventory</a></div><div class="panel-content"><div class="rule-equation">Units ÷ units per day = days of supply</div><p class="flow-copy">Below 15 days of supply, the dashboard raises a critical alert and creates one draft PO per product. It does not send an order to a supplier.</p></div></section>
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Procurement decisions</h2><div class="panel-subtitle">Manager actions update workflow status</div></div><a class="button" href="#/approvals">Review approvals</a></div><div class="panel-content"><div class="rule-equation">Pending → Approved or Denied</div><p class="flow-copy">A decision records the mock manager and timestamp, then writes an audit event. No real purchase or payment is initiated.</p></div></section>
    </div>
    <div class="section-grid equal">
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Where state lives</h2><div class="panel-subtitle">Selected by environment and deployment</div></div><span class="status approved">Current mode · mock</span></div><div class="panel-content"><div class="feed-list">
        <div class="feed-item"><span class="feed-dot"></span><div><div class="feed-title">Local development</div><div class="feed-detail">The standard-library launcher uses mock_db.json and a local background loop.</div></div></div>
        <div class="feed-item"><span class="feed-dot procurement"></span><div><div class="feed-title">Vercel deployment</div><div class="feed-detail">FastAPI runs as a function. Supabase stores the JSONB state with version-checked writes; no process or local disk is treated as persistent.</div></div></div>
        <div class="feed-item"><span class="feed-dot inventory"></span><div><div class="feed-title">Scheduled heartbeat</div><div class="feed-detail">The dashboard ticks every 10 seconds while open. Vercel Hobby cron is daily; Pro or Enterprise can run the heartbeat every minute.</div></div></div>
      </div></div></section>
      <section class="panel insight-panel"><div class="panel-content"><div class="insight-tag">Live Amazon connection · Not active</div><blockquote class="insight-quote">Credentials alone do not enable Amazon automation.</blockquote><p class="insight-body">The LWA and AWS variables are placeholders. There is no SP-API or Amazon Ads adapter wired to this dashboard yet, and review summaries use fixed sample reviews.</p><div class="recommendation"><strong>Safety boundary</strong><br />All prices, ads, reviews, and purchase workflows shown here are mock data. Approval actions are not authenticated yet; keep hosted access private.</div></div></section>
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
      <td class="number-cell">${number(product.daily_velocity)} / day</td><td>${statusPill(label.toLowerCase() === "healthy" ? "approved" : label.toLowerCase() === "watch" ? "warning" : "critical")}</td>
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
      <div class="table-wrap"><table><thead><tr><th>Product</th><th>Stock cover</th><th>Velocity</th><th>Risk status</th><th>PO draft</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
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
  const filters = ["all", "repricer", "ppc", "inventory", "procurement"].map((filter) => `<button class="filter-button ${activityFilter === filter ? "active" : ""}" type="button" data-activity-filter="${filter}">${filter === "all" ? "All events" : filter}</button>`).join("");
  return `${heading("Automation activity logs", "A timestamped record of every simulated pricing, advertising, and inventory decision.", "System audit")}
    <section class="panel"><div class="toolbar"><div class="table-count">${number(items.length)} events · newest first</div><div class="filter-group" role="group" aria-label="Filter activity">${filters}</div></div><div class="panel-content">${renderFeed(items, true)}</div></section>`;
}

function renderApprovals() {
  const orders = state.orders.filter((order) => approvalFilter === "all" || order.status === approvalFilter);
  const pendingSpend = state.orders.filter((order) => order.status === "pending").reduce((sum, order) => sum + order.amount, 0);
  const filters = ["pending", "approved", "denied", "all"].map((filter) => `<button class="filter-button ${approvalFilter === filter ? "active" : ""}" type="button" data-approval-filter="${filter}">${filter.charAt(0).toUpperCase() + filter.slice(1)}</button>`).join("");
  const rows = orders.map((order) => `<tr><td><span class="order-id">${escapeHtml(order.id)}</span><div class="product-meta">${escapeHtml(order.product_name)}</div></td>
    <td><div class="product-name">${escapeHtml(order.supplier)}</div><div class="product-meta">${escapeHtml(order.category)}</div></td>
    <td class="number-cell">${number(order.units)} units</td><td class="price">${money(order.amount)}</td>
    <td><div>${statusPill(order.status)}</div><div class="product-meta">${escapeHtml(order.reason)}</div></td>
    <td>${order.status === "pending" ? `<div class="action-row"><button class="button button-approve" type="button" data-decision="approve" data-order-id="${escapeHtml(order.id)}">Approve</button><button class="button button-deny" type="button" data-decision="deny" data-order-id="${escapeHtml(order.id)}">Deny</button></div>` : `<span class="product-meta">${escapeHtml(order.reviewed_by || "Reviewed")}</span>`}</td></tr>`).join("");
  return `${heading("Procurement approvals", "Review enterprise purchasing workflows before they are committed.", "Administration")}
    <div class="metrics">
      ${metric("Awaiting decision", number(state.orders.filter((order) => order.status === "pending").length), "Approval required before purchase", "orange", "PENDING")}
      ${metric("Pending commitment", money(pendingSpend, 0), "Total value awaiting manager review", "teal", "USD")}
      ${metric("Reviewed by", escapeHtml(state.manager.name), escapeHtml(state.manager.role), "blue", "MANAGER PROFILE")}
      ${metric("Approved workflows", number(state.orders.filter((order) => order.status === "approved").length), "Decisions are recorded in activity logs", "green", "LIFETIME")}
    </div>
    <section class="panel"><div class="toolbar"><div class="table-count">${number(orders.length)} workflows shown · ${escapeHtml(state.manager.name)} is the active approver</div><div class="filter-group" role="group" aria-label="Filter purchase workflows">${filters}</div></div>
      <div class="table-wrap"><table><thead><tr><th>Workflow</th><th>Supplier</th><th>Quantity</th><th>Amount</th><th>Status / reason</th><th>Manager action</th></tr></thead><tbody>${rows || '<tr><td colspan="6"><div class="empty-state">No workflows in this view.</div></td></tr>'}</tbody></table></div></section>`;
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
});

window.addEventListener("hashchange", render);
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
  if (!window.location.hash) window.location.hash = "#/overview";
  try {
    await fetchState();
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
        if (!hasFocusedControl()) render();
      }
    } catch (error) {
      console.warn("Dashboard refresh failed", error);
    }
  }, 10000);
}

start();