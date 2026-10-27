// Seed script for the Amazon SEO Tool Selector.
// AmzSphere is a pure-frontend mock stack (no PostgreSQL), so there are no
// database migrations. Seed data lives in web/lib/seo-tools.ts (SEED_TOOLS).
// This script validates the seed data integrity and can be run as a CI check.
//
// Run: node --experimental-strip-types web/scripts/seed-seo-tools.ts

import { SEED_TOOLS } from "../lib/seo-tools.ts";
import type { SeoTool } from "../lib/seo-tools.ts";

const REQUIRED_CATEGORIES = [
  "Keyword Research",
  "Listing Optimization",
  "Rank Tracking",
  "PPC/Advertising",
  "Product Research",
  "Review & Feedback",
  "Analytics",
  "Competitor Analysis",
] as const;

function validateSeed(tools: SeoTool[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (tools.length < 10) {
    errors.push(`Expected at least 10 seed tools, found ${tools.length}`);
  }

  const ids = new Set<string>();
  for (const tool of tools) {
    if (!tool.id) errors.push("Tool missing id");
    if (ids.has(tool.id)) errors.push(`Duplicate tool id: ${tool.id}`);
    ids.add(tool.id);
    if (!tool.name) errors.push(`Tool ${tool.id} missing name`);
    if (!tool.short_description) errors.push(`Tool ${tool.id} missing short_description`);
    if (!REQUIRED_CATEGORIES.includes(tool.category)) {
      errors.push(`Tool ${tool.id} has unknown category: ${tool.category}`);
    }
    if (!["free", "freemium", "paid"].includes(tool.pricing_model)) {
      errors.push(`Tool ${tool.id} has invalid pricing_model`);
    }
    if (!Array.isArray(tool.features) || tool.features.some((f) => !f.id || !f.label)) {
      errors.push(`Tool ${tool.id} has invalid features`);
    }
    if (!Array.isArray(tool.marketplaces) || tool.marketplaces.length === 0) {
      errors.push(`Tool ${tool.id} must support at least one marketplace`);
    }
    if (tool.rating != null && (tool.rating < 0 || tool.rating > 5)) {
      errors.push(`Tool ${tool.id} has invalid rating`);
    }
    if (!tool.website_url) errors.push(`Tool ${tool.id} missing website_url`);
    if (typeof tool.is_active !== "boolean") errors.push(`Tool ${tool.id} missing is_active`);
  }

  return { valid: errors.length === 0, errors };
}

const { valid, errors } = validateSeed(SEED_TOOLS);

console.log(`SEO Tool Selector seed validation:`);
console.log(`  tools: ${SEED_TOOLS.length}`);
console.log(`  categories: ${REQUIRED_CATEGORIES.length}`);
console.log(`  sample data: true`);
if (valid) {
  console.log("  status: OK");
  process.exit(0);
} else {
  console.error("  status: INVALID");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
