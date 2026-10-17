#!/usr/bin/env python3
"""Patch static/app.js for the richer mock data. Run from the repo root.

All edits are matched exactly once and computed in memory first; if anything
does not match, nothing is written.
"""
import sys
from pathlib import Path

PATH = Path("static/app.js")
text = PATH.read_text(encoding="utf-8")


def replace(old, new):
    global text
    count = text.count(old)
    if count != 1:
        sys.exit(f"ABORT: expected 1 match, found {count} for:\n{old[:140]}")
    text = text.replace(old, new)


HELPERS = r'''function profileFor(product) {
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

'''

# Helpers go in front of renderProcurementQueue.
replace("function renderProcurementQueue() {", HELPERS + "function renderProcurementQueue() {")

# Catalog: no more crash on ASINs without a hard-coded profile.
replace("const profile = catalogProfiles[selectedCatalogAsin];", "const profile = profileFor(selected);")
replace("const item = catalogProfiles[product.asin];", "const item = profileFor(product);")
replace('<td class="number-cell">#${item.rank}</td>', '<td class="number-cell">${item.rank ? "#" + item.rank : "—"}</td>')
replace("<strong>#${profile.rank}</strong>", '<strong>${profile.rank ? "#" + profile.rank : "—"}</strong>')

# ACoS change is computed from history instead of a fixed "2.8 pts".
replace("""'<span class="metric-change">↓ 2.8 pts</span> over 30 days'""", 'acosDeltaLabel() + " over 30 days"')
replace("""'<span class="metric-change">↓ 2.8 pts</span> month over month'""", 'acosDeltaLabel() + " over 30 days"')

# Review summary is computed from the review themes.
replace("const reviews = state.reviews.slice(0, 5);",
        "const reviews = [...state.reviews].sort((a, b) => a.rating - b.rating || b.date.localeCompare(a.date)).slice(0, 5);\n  const insight = reviewInsight();")
replace("<blockquote class=\"insight-quote\">“3 customers report cracked or broken hinge hardware.”</blockquote>",
        "<blockquote class=\"insight-quote\">“${escapeHtml(insight.quote)}”</blockquote>")
replace('<p class="insight-body">The recurring complaint points to a weak plastic hinge assembly. Two reviews mention damage on arrival despite an intact outer carton.</p>',
        '<p class="insight-body">${escapeHtml(insight.body)}</p>')
replace("Replace the hinge connector with reinforced hardware and add a molded protective insert to the shipping carton.",
        "${escapeHtml(insight.fix)}")
replace('<span class="stars">★</span> &nbsp;', '<span class="stars">${"★".repeat(review.rating)}</span> &nbsp;')

# PPC guardrail text reflects the real rule, plus a campaign table.
replace("Trailing 7-Day ACoS &gt; 25% -&gt; Lower Bid Floor by 12% automatically at 00:00 UTC.", "' + guardrailRuleText() + '")
replace('<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Customer search terms</h2>',
        '${renderCampaigns()}\n    <div style="height:14px"></div>\n    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Customer search terms</h2>')

PATH.write_text(text, encoding="utf-8")
print("Patched static/app.js")
