export const TICK_SECONDS = 10;
export const ACTIVITY_LIMIT = 120;
export const HISTORY_DAYS = 30;
export const WEEKDAY_FACTORS: number[] = [1.00, 1.00, 0.97, 1.00, 1.05, 1.12, 0.86];
export const COMPETITOR_REVERSION = 0.08;
export const COMPETITOR_BAND = 0.20;
export const MIN_PRICE_CHANGE = 0.03;
export const MIN_PRICE_CHANGE_PCT = 0.025;
export const REPRICE_EVERY_TICKS = 6;

function nowIso(): string {
  return new Date().toISOString();
}

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function uuid4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function random(): number {
  return Math.random();
}

function uniform(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function randint(a: number, b: number): number {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function choice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function gauss(mu: number, sigma: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * sigma + mu;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function tickIsDue(state: any, now?: Date): boolean {
  const lastUpdated = state.last_updated;
  if (!lastUpdated) return true;
  let lastTick: Date;
  try {
    lastTick = new Date(String(lastUpdated).replace("Z", "+00:00"));
  } catch {
    return true;
  }
  const currentTime = now || new Date();
  return currentTime.getTime() - lastTick.getTime() >= TICK_SECONDS * 1000;
}

function recordActivity(state: any, category: string, title: string, detail: string): void {
  const activity: unknown[] = (state.activity as any[]) || [];
  (state.activity as any[]) = [
    { id: uuid4(), timestamp: nowIso(), category, title, detail },
    ...activity,
  ];
  if ((state.activity as any[]).length > ACTIVITY_LIMIT) {
    (state.activity as any[]) = (state.activity as any[]).slice(0, ACTIVITY_LIMIT);
  }
}

function recomputeAcosHistory(state: any): void {
  const campaigns: any[] = (state.campaigns as any[]) || [];
  if (!campaigns.length) return;
  const days = Math.min(...campaigns.map((c) => (c.ad_history as any[]).length));
  const history: number[] = [];
  for (let offset = days; offset > 0; offset--) {
    const spend = campaigns.reduce((sum, c) => sum + Number((c.ad_history as any[])[days - offset].spend), 0);
    const sales = campaigns.reduce((sum, c) => sum + Number((c.ad_history as any[])[days - offset].sales), 0);
    history.push(sales ? round2(spend / sales * 100) : 0.0);
  }
  state.acos_history = history;
}

function trailingAcos(campaign: any, windowDays: number): number | null {
  const window: any[] = (campaign.ad_history as any[]).slice(-windowDays);
  const spend = window.reduce((sum, d) => sum + Number(d.spend), 0);
  const sales = window.reduce((sum, d) => sum + Number(d.sales), 0);
  return sales ? spend / sales * 100 : null;
}

export class MockSimulator {
  tick(state: any): void {
    state.tick_count = (Number(state.tick_count) || 0) + 1;
    this.rollHistory(state);
    if (Number(state.tick_count) % REPRICE_EVERY_TICKS === 0) {
      this.reprice(state);
    }
    this.driftSearchTerms(state);
    this.harvestKeywords(state);
    this.applyGuardrail(state);
    this.watchInventory(state);
    state.last_updated = nowIso();
  }

  reprice(state: any): void {
    const products: any[] = (state.products as any[]) || [];
    for (const product of products) {
      const market = Number(product.market_price ?? product.competitor_price);
      const stepPct = uniform(0.10, 1.50) * choice([-1, 1]);
      const drift = market * stepPct / 100;
      const pull = COMPETITOR_REVERSION * (market - Number(product.competitor_price));
      const low = market * (1 - COMPETITOR_BAND);
      const high = market * (1 + COMPETITOR_BAND);
      let competitor = Math.max(0.50, Math.min(high, Math.max(low, Number(product.competitor_price) + drift + pull)));
      competitor = round2(competitor);
      product.competitor_price = competitor;

      const price = Number(product.price);
      const floor = Number(product.min_floor);
      const ceiling = product.max_price !== undefined ? Number(product.max_price) : Infinity;
      if (competitor < floor) continue;
      if (competitor < price) {
        const newPrice = round2(Math.max(floor, competitor - 0.01));
        if (price - newPrice >= Math.max(MIN_PRICE_CHANGE, price * MIN_PRICE_CHANGE_PCT)) {
          product.price = newPrice;
          const held = newPrice === floor;
          const detail = `${String(product.asin)} moved from $${price.toFixed(2)} to $${newPrice.toFixed(2)}, ` +
            (held ? `held at its $${floor.toFixed(2)} floor.` : "one cent below its competitor.");
          recordActivity(state, "repricer", "Buy Box price matched", detail);
        }
      } else if (competitor - 0.01 > price) {
        const step = Math.max(0.05, price * 0.03);
        const newPrice = round2(Math.min(ceiling, competitor - 0.01, price + step));
        if (newPrice - price >= Math.max(MIN_PRICE_CHANGE, price * MIN_PRICE_CHANGE_PCT)) {
          product.price = newPrice;
          const capped = newPrice === ceiling;
          const detail = `${String(product.asin)} moved from $${price.toFixed(2)} to $${newPrice.toFixed(2)} as its competitor rose to $${competitor.toFixed(2)}` +
            (capped ? " (capped at its price ceiling)." : ".");
          recordActivity(state, "repricer", "Price raised toward competitor", detail);
        }
      }
    }
  }

  driftSearchTerms(state: any): void {
    const terms: any[] = (state.search_terms as any[]) || [];
    for (const term of terms) {
      if (random() > 0.04) continue;
      const clicks = Number(term.clicks) || 0;
      const spend = Number(term.spend) || 0;
      const cpc = clicks ? spend / clicks : 0.40;
      const added = randint(1, 4);
      term.clicks = clicks + added;
      term.spend = round2(spend + added * cpc);
      term.impressions = Number(term.impressions || 0) + added * randint(18, 30);
      const conversions = Number(term.conversions) || 0;
      const rate = conversions / (clicks + added);
      if (term.order_value && random() < Math.max(rate, 0.05)) {
        term.conversions = conversions + 1;
        term.sales = round2(Number(term.sales || 0) + Number(term.order_value));
      }
      if (term.sales !== undefined) {
        const salesVal = Number(term.sales) || 0;
        term.acos = salesVal ? round2(Number(term.spend) / salesVal * 100) : 0.0;
      }
    }
  }

  harvestKeywords(state: any): void {
    const exactTerms: any[] = (state.targeted_exact_keywords as any[]) || [];
    const negativeTerms: any[] = (state.negative_keywords as any[]) || [];
    const exactSet = new Set(exactTerms.map((i) => String(i.term).toLowerCase()));
    const negativeSet = new Set(negativeTerms.map((i) => String(i.term).toLowerCase()));

    const terms: any[] = (state.search_terms as any[]) || [];
    for (const term of terms) {
      const key = String(term.term).toLowerCase();
      const conversions = Number(term.conversions) || 0;
      const acos = Number(term.acos) || 0;
      const clicks = Number(term.clicks) || 0;
      if (conversions > 5 && acos < 25 && !exactSet.has(key)) {
        exactTerms.push({ term: term.term, added_at: nowIso(), source: "Auto harvest" });
        exactSet.add(key);
        recordActivity(
          state,
          "ppc",
          "Exact keyword harvested",
          `${String(term.term)} qualified with ${conversions} conversions at ${acos.toFixed(1)}% ACoS.`,
        );
      } else if (clicks > 15 && conversions === 0 && !negativeSet.has(key)) {
        negativeTerms.push({ term: term.term, added_at: nowIso(), source: "Zero-conversion guard" });
        negativeSet.add(key);
        recordActivity(
          state,
          "ppc",
          "Negative keyword added",
          `${String(term.term)} reached ${clicks} clicks without a conversion.`,
        );
      }
    }
    state.targeted_exact_keywords = exactTerms;
    state.negative_keywords = negativeTerms;
  }

  applyGuardrail(state: any): void {
    const config = state.ppc_guardrail as any | undefined;
    if (!config) return;
    const today = utcToday().toISOString().split("T")[0];
    const campaigns: any[] = (state.campaigns as any[]) || [];
    for (const campaign of campaigns) {
      const acos = trailingAcos(campaign, Number(config.window_days) || 7);
      campaign.trailing_acos = acos !== null ? round2(acos) : null;
      if (acos === null || acos <= Number(config.acos_threshold)) continue;
      if (campaign.last_guardrail_date === today) continue;
      const oldBid = Number(campaign.bid_floor);
      const newBid = Math.max(
        Number(config.min_bid),
        round2(oldBid * (1 - Number(config.bid_reduction_pct) / 100)),
      );
      if (newBid >= oldBid) continue;
      campaign.bid_floor = newBid;
      campaign.last_guardrail_date = today;
      campaign.acos_modifier = Math.max(0.6, (Number(campaign.acos_modifier) || 1.0) * 0.94);
      const bidChanges: any[] = (campaign.bid_changes as any[]) || [];
      bidChanges.unshift({
        date: today,
        from: oldBid,
        to: newBid,
        trailing_acos: round2(acos),
      });
      if (bidChanges.length > 10) bidChanges.length = 10;
      campaign.bid_changes = bidChanges;
      recordActivity(
        state,
        "ppc",
        "Bid guardrail triggered",
        `${String(campaign.name)} trailing ${config.window_days}-day ACoS was ${round2(acos)}% ` +
          `(limit ${config.acos_threshold}%). Bid lowered from $${oldBid.toFixed(2)} to $${newBid.toFixed(2)}.`,
      );
    }
  }

  rollHistory(state: any): void {
    const endRaw = state.history_end;
    if (!endRaw || !state.sales_history) return;
    const today = utcToday();
    const endDate = new Date(String(endRaw));
    endDate.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(today);
    todayStart.setUTCHours(0, 0, 0, 0);
    const diffDays = Math.floor((todayStart.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    const steps = Math.min(diffDays, HISTORY_DAYS);
    if (steps <= 0) return;
    for (let offset = steps - 1; offset >= 0; offset--) {
      const day = new Date(todayStart);
      day.setUTCDate(day.getUTCDate() - offset);
      this.appendDay(state, day);
    }
    state.history_end = today.toISOString().split("T")[0];
    recomputeAcosHistory(state);
  }

  appendDay(state: any, day: Date): void {
    const latestUnits: Record<string, number> = {};
    const products: any[] = (state.products as any[]) || [];
    const salesHistory = state.sales_history as Record<string, number[]>;
    for (const product of products) {
      const sku = String(product.sku);
      const history = salesHistory[sku];
      if (!history) continue;
      const recent = history.slice(-14);
      const base = recent.length ? recent.reduce((sum, v) => sum + v, 0) / recent.length : Number(product.daily_velocity);
      const weekday = (day.getUTCDay() + 6) % 7;
      const units = Math.max(0, Math.round(base * WEEKDAY_FACTORS[weekday] * gauss(1, 0.10)));
      history.push(units);
      if (history.length > HISTORY_DAYS) {
        history.splice(0, history.length - HISTORY_DAYS);
      }
      latestUnits[sku] = units;
      product.daily_velocity = round1(history.reduce((sum, v) => sum + v, 0) / history.length);
    }
    const prices: Record<string, number> = {};
    for (const product of products) {
      prices[String(product.sku)] = Number(product.price);
    }
    const campaigns: any[] = (state.campaigns as any[]) || [];
    for (const campaign of campaigns) {
      const units = latestUnits[String(campaign.sku)];
      if (units === undefined) continue;
      const price = prices[String(campaign.sku)] || 0;
      const sales = round2(units * price * Number(campaign.ad_share));
      const acos = Number(campaign.base_acos) * (Number(campaign.acos_modifier) || 1.0) * Math.max(0.5, gauss(1, 0.08));
      const spend = round2(sales * acos / 100);
      const adHistory: any[] = (campaign.ad_history as any[]) || [];
      adHistory.push({
        spend,
        sales,
        clicks: Math.round(spend / Number(campaign.avg_cpc)),
        orders: Math.round(sales / price),
      });
      if (adHistory.length > HISTORY_DAYS) {
        adHistory.splice(0, adHistory.length - HISTORY_DAYS);
      }
    }
  }

  watchInventory(state: any): void {
    this.burnStock(state);
    this.draftPurchaseOrders(state);
  }

  burnStock(state: any): void {
    const products: any[] = (state.products as any[]) || [];
    for (const product of products) {
      const soldSinceLastTick = Number(product.daily_velocity) * TICK_SECONDS / 86400;
      product.stock = round3(Math.max(0, Number(product.stock) - soldSinceLastTick));
      product.sellable_units = product.stock;
      product.days_of_supply = round1(Number(product.stock) / Math.max(Number(product.daily_velocity), 0.1));
    }
    const globalProducts: any[] = (state.global_products as any[]) || [];
    for (let i = 0; i < Math.min(products.length, globalProducts.length); i++) {
      const p = products[i];
      const gp = globalProducts[i];
      gp.stock = p.stock;
      gp.sellable_units = p.stock;
      gp.days_of_supply = p.days_of_supply;
    }
  }

  draftPurchaseOrders(state: any): void {
    const products: any[] = (state.products as any[]) || [];
    for (const product of products) {
      if (Number(product.daily_velocity) <= 0) continue;
      const daysOfSupply = Number(product.stock) / Number(product.daily_velocity);
      if (daysOfSupply < 15 && !product.po_draft_id) {
        const poId = `PO-${uuid4().substring(0, 6).toUpperCase()}`;
        product.po_draft_id = poId;
        const purchaseOrder = {
          id: poId,
          product_asin: product.asin,
          product_name: product.name,
          supplier: product.supplier,
          units: Math.max(100, Math.round(Number(product.daily_velocity) * 30)),
          status: "draft",
          created_at: nowIso(),
        };
        const pos: any[] = (state.purchase_orders as any[]) || [];
        pos.unshift(purchaseOrder);
        recordActivity(
          state,
          "inventory",
          "Critical stock alert · PO drafted",
          `${String(product.name)} has ${daysOfSupply.toFixed(1)} days of supply. Draft ${poId} created for ${purchaseOrder.units} units.`,
        );
      }
    }
  }
}

export function buildSimulator(mode: string): MockSimulator {
  if (mode === "mock") return new MockSimulator();
  if (mode === "live") {
    throw new Error("The live SP-API adapter is not configured in this MVP. Set AMZ_DATA_MODE=mock.");
  }
  throw new Error("AMZ_DATA_MODE must be either 'mock' or 'live'.");
}
