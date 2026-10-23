export const OPT_SCORE_MAX = 100;
export const OPT_SCORE_MIN = 0;
export const NEEDS_OPTIMIZATION_THRESHOLD = 70;

export const PENALTY_TITLE = 20;
export const PENALTY_BULLETS = 15;
export const PENALTY_IMAGES = 15;
export const PENALTY_DESCRIPTION = 10;
export const PENALTY_BACKEND_KEYWORDS = 10;
export const PENALTY_SUPPRESSED = 30;

export const MIN_TITLE_CHARS = 80;
export const MIN_BULLETS = 5;
export const MIN_BULLET_CHARS = 20;
export const MIN_IMAGES = 7;
export const MIN_DESCRIPTION_CHARS = 50;

export interface Rule {
  name: string;
  penalty: number;
  message: string;
  condition: (product: Record<string, unknown>) => [boolean, string];
}

export interface ScoringResult {
  score: number;
  issues: string[];
  status: string;
}

function hasMainKeyword(title: string, keywords: string[]): boolean {
  const titleLower = title.toLowerCase();
  return keywords.some((keyword) => keyword && titleLower.includes(keyword.toLowerCase()));
}

function titleRule(product: Record<string, unknown>): [boolean, string] {
  const title = (product.title || product.name || "") as string;
  const keywords = (product.backend_keywords || []) as string[];
  const tooShort = title.trim().length < MIN_TITLE_CHARS;
  const missingKeyword = keywords.length > 0 && !hasMainKeyword(title, keywords);
  if (tooShort && missingKeyword) {
    return [true, "Title is shorter than 80 characters and does not contain a backend keyword."];
  }
  if (tooShort) {
    return [true, "Title is shorter than 80 characters."];
  }
  if (missingKeyword) {
    return [true, "Title does not contain any of the backend keywords."];
  }
  return [false, ""];
}

function bulletsRule(product: Record<string, unknown>): [boolean, string] {
  const bullets = (product.bullets || []) as unknown[];
  if (bullets.length < MIN_BULLETS) {
    return [true, `Only ${bullets.length} bullet points; at least ${MIN_BULLETS} are recommended.`];
  }
  const short = bullets.filter((b) => String(b || "").trim().length < MIN_BULLET_CHARS);
  if (short.length > 0) {
    return [true, `${short.length} bullet points are very short (under ${MIN_BULLET_CHARS} characters).`];
  }
  return [false, ""];
}

function imagesRule(product: Record<string, unknown>): [boolean, string] {
  const images = (product.images || []) as unknown[];
  if (images.length < MIN_IMAGES) {
    return [true, `Only ${images.length} main images; at least ${MIN_IMAGES} are recommended.`];
  }
  return [false, ""];
}

function descriptionRule(product: Record<string, unknown>): [boolean, string] {
  const description = (product.description || "") as string;
  if (description.trim().length < MIN_DESCRIPTION_CHARS) {
    return [true, `Description is shorter than ${MIN_DESCRIPTION_CHARS} characters.`];
  }
  return [false, ""];
}

function backendKeywordsRule(product: Record<string, unknown>): [boolean, string] {
  const keywords = (product.backend_keywords || []) as unknown[];
  if (keywords.length === 0) {
    return [true, "No backend search keywords are configured."];
  }
  return [false, ""];
}

function suppressedRule(product: Record<string, unknown>): [boolean, string] {
  if (product.suppressed === true) {
    return [true, "Listing is suppressed."];
  }
  const listings = (product.marketplace_listings || []) as Record<string, unknown>[];
  for (const listing of listings) {
    if (String(listing.status || "").toLowerCase() === "suppressed") {
      return [true, "A marketplace listing is suppressed."];
    }
  }
  return [false, ""];
}

export const RULES: Rule[] = [
  { name: "title", penalty: PENALTY_TITLE, message: "", condition: titleRule },
  { name: "bullets", penalty: PENALTY_BULLETS, message: "", condition: bulletsRule },
  { name: "images", penalty: PENALTY_IMAGES, message: "", condition: imagesRule },
  { name: "description", penalty: PENALTY_DESCRIPTION, message: "", condition: descriptionRule },
  { name: "backend_keywords", penalty: PENALTY_BACKEND_KEYWORDS, message: "", condition: backendKeywordsRule },
  { name: "suppressed", penalty: PENALTY_SUPPRESSED, message: "", condition: suppressedRule },
];

export function evaluateRules(product: Record<string, unknown>): [number, string[]] {
  let score = OPT_SCORE_MAX;
  const issues: string[] = [];
  for (const rule of RULES) {
    const [failed, message] = rule.condition(product);
    if (failed) {
      score -= rule.penalty;
      issues.push(message || `${rule.name.replace(/_/g, " ")} needs attention.`);
    }
  }
  return [Math.max(OPT_SCORE_MIN, Math.min(OPT_SCORE_MAX, score)), issues];
}

export function statusForScore(score: number): string {
  return score < NEEDS_OPTIMIZATION_THRESHOLD ? "needs_optimization" : "optimized";
}

export function recentSalesVolume(product: Record<string, unknown>, windowDays = 7): number {
  const history = (product.sales_history || []) as number[];
  if (history.length > 0) {
    return history.slice(-windowDays).reduce((sum, v) => sum + v, 0);
  }
  return (Number(product.daily_velocity) || 0) * windowDays;
}

export function impactRank(product: Record<string, unknown>): number {
  const score = Number(product.opt_score) || 0;
  const volume = recentSalesVolume(product);
  return (100 - score) * volume;
}

export function computeOptScore(product: Record<string, unknown>): ScoringResult {
  const [score, issues] = evaluateRules(product);
  return { score, issues, status: statusForScore(score) };
}
