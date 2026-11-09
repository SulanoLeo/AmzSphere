"use client";

import { create } from "zustand";
import type { Campaign, Product } from "@/lib/provider/types";

export interface MissingAssets {
  bullets: boolean;
  images: boolean;
}

export type AdStatus = "active" | "paused" | "inactive";

export interface AmzProduct extends Product {
  seoScore: number;
  missingAssets: MissingAssets;
  stockLevel: number;
  velocity30d: number;
  daysSupply: number;
  acos: number;
  adStatus: AdStatus;
  isClientCreated?: boolean;
}

export interface AddProductPayload {
  title: string;
  sku: string;
  asin: string;
  price: number;
  stockLevel: number;
  bullets: string[];
  imagesUploaded: boolean;
}

type SeoFields = Pick<Product, "title" | "bullets" | "images" | "description" | "backend_keywords">;
type CampaignStatus = Campaign & {
  status?: string;
  enabled?: boolean;
  is_active?: boolean;
};

interface AmzStore {
  products: AmzProduct[];
  hydrateProducts: (products: Product[], campaigns?: Campaign[]) => void;
  upsertProducts: (products: Product[]) => void;
  addProduct: (productPayload: AddProductPayload) => AmzProduct;
  updateProductSEO: (sku: string, updatedFields: Partial<SeoFields>) => void;
  togglePpcStatus: (sku: string) => void;
}

const MIN_BULLETS = 5;
const MIN_IMAGES = 7;
const DEFAULT_DAILY_VELOCITY = 10;

function getMissingAssets(product: Pick<Product, "bullets" | "images">): MissingAssets {
  return {
    bullets: product.bullets.length < MIN_BULLETS,
    images: product.images.length < MIN_IMAGES,
  };
}

function getSeoScore(missingAssets: MissingAssets): number {
  return missingAssets.bullets || missingAssets.images ? 70 : 98;
}

function campaignAdStatus(campaign?: CampaignStatus): AdStatus | undefined {
  if (!campaign) return undefined;
  const status = campaign.status?.toLowerCase();
  if (status === "paused" || campaign.enabled === false || campaign.is_active === false) {
    return "paused";
  }
  if (status === "inactive" || status === "ended" || status === "archived") {
    return "inactive";
  }
  return undefined;
}

function toAmzProduct(product: Product, previous?: AmzProduct, campaign?: CampaignStatus): AmzProduct {
  const missingAssets = getMissingAssets(product);
  const stockLevel = Number(product.stock ?? product.sellable_units) || 0;
  const dailyVelocity = Number(product.daily_velocity) || 0;
  const computedDaysSupply = dailyVelocity > 0 ? stockLevel / dailyVelocity : Number.POSITIVE_INFINITY;
  const daysSupply = Number(product.days_of_supply) > 0 ? Number(product.days_of_supply) : computedDaysSupply;
  const campaignStatus = campaignAdStatus(campaign);

  return {
    ...product,
    seoScore: getSeoScore(missingAssets),
    missingAssets,
    stockLevel,
    velocity30d: dailyVelocity * 30,
    daysSupply,
    acos: Number(campaign?.trailing_acos ?? campaign?.base_acos) || 0,
    adStatus: campaignStatus ?? previous?.adStatus ?? (campaign ? "active" : "inactive"),
    isClientCreated: previous?.isClientCreated ?? false,
  };
}

export const useAmzStore = create<AmzStore>((set, get) => ({
  products: [],
  hydrateProducts: (products, campaigns) =>
    set((state) => {
      const previousBySku = new Map(state.products.map((product) => [product.sku, product]));
      const campaignBySku = new Map(
        (campaigns ?? []).map((campaign) => [campaign.sku, campaign as CampaignStatus]),
      );
      const hydratedProducts = products.map((product) =>
        toAmzProduct(
            product,
            previousBySku.get(product.sku),
            campaignBySku.get(product.sku),
        ),
      );
      const hydratedSkus = new Set(hydratedProducts.map((product) => product.sku.toUpperCase()));
      const localProducts = state.products.filter(
        (product) => product.isClientCreated && !hydratedSkus.has(product.sku.toUpperCase()),
      );
      return { products: [...hydratedProducts, ...localProducts] };
    }),
  upsertProducts: (products) =>
    set((state) => {
      const nextBySku = new Map(state.products.map((product) => [product.sku, product]));
      for (const product of products) {
        nextBySku.set(product.sku, toAmzProduct(product, nextBySku.get(product.sku)));
      }
      return { products: Array.from(nextBySku.values()) };
    }),
  addProduct: (productPayload) => {
    const title = productPayload.title.trim();
    const sku = productPayload.sku.trim();
    const asin = productPayload.asin.trim();
    const price = productPayload.price;
    const stockLevel = productPayload.stockLevel;

    if (!title || !sku || !asin) {
      throw new Error("Title, SKU, and ASIN are required.");
    }
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Price must be greater than zero.");
    }
    if (!Number.isInteger(stockLevel) || stockLevel < 0) {
      throw new Error("Initial stock must be a non-negative whole number.");
    }

    const currentProducts = get().products;
    const normalizedSku = sku.toUpperCase();
    const normalizedAsin = asin.toUpperCase();
    if (currentProducts.some((product) => product.sku.toUpperCase() === normalizedSku)) {
      throw new Error(`A product with SKU ${sku} already exists.`);
    }
    if (currentProducts.some((product) => product.asin.toUpperCase() === normalizedAsin)) {
      throw new Error(`A product with ASIN ${asin} already exists.`);
    }

    const bullets = productPayload.bullets.map((bullet) => bullet.trim()).filter(Boolean);
    const images = productPayload.imagesUploaded
      ? Array.from({ length: MIN_IMAGES }, (_, index) =>
          `/mock-product-images/${encodeURIComponent(sku)}/${index + 1}.jpg`,
        )
      : [];
    const dailyVelocity = DEFAULT_DAILY_VELOCITY;
    const daysOfSupply = stockLevel / dailyVelocity;
    const missingAssets = getMissingAssets({ bullets, images });
    const seoScore = getSeoScore(missingAssets);
    const priceToCents = (value: number) => Math.round(value * 100) / 100;
    const product: Product = {
      id: `local-${normalizedSku}`,
      asin,
      sku,
      marketplace_id: "ATVPDKIKX0DER",
      seller_id: "mock-seller",
      source: "manual",
      name: title,
      title,
      category: "Uncategorized",
      price,
      bullets,
      description: "",
      backend_keywords: [],
      images,
      sellable_units: stockLevel,
      stock: stockLevel,
      days_of_supply: daysOfSupply,
      daily_velocity: dailyVelocity,
      competitor_price: price,
      market_price: price,
      min_floor: priceToCents(price * 0.8),
      max_price: priceToCents(price * 1.2),
      unit_cost: priceToCents(price * 0.5),
      lead_time_days: 21,
      supplier: "Manual entry",
      supplier_id: null,
      po_draft_id: null,
      parent_asin: null,
      variation_theme: null,
      suppressed: false,
      last_synced_at: null,
      sync_status: "local",
      last_optimized_at: null,
      opt_score: seoScore,
      opt_issues: [
        ...(missingAssets.bullets ? ["Missing bullet points"] : []),
        ...(missingAssets.images ? ["Missing images"] : []),
      ],
      opt_status: missingAssets.bullets || missingAssets.images ? "needs_optimization" : "optimized",
    };
    const addedProduct: AmzProduct = {
      ...toAmzProduct(product),
      isClientCreated: true,
    };

    set((state) => ({ products: [...state.products, addedProduct] }));
    return addedProduct;
  },
  updateProductSEO: (sku, updatedFields) =>
    set((state) => ({
      products: state.products.map((product) => {
        if (product.sku !== sku) return product;
        const updatedProduct = { ...product, ...updatedFields };
        const missingAssets = getMissingAssets(updatedProduct);
        return {
          ...updatedProduct,
          seoScore: getSeoScore(missingAssets),
          missingAssets,
        };
      }),
    })),
  togglePpcStatus: (sku) =>
    set((state) => ({
      products: state.products.map((product) => {
        if (product.sku !== sku) return product;
        return {
          ...product,
          adStatus: product.adStatus === "active" ? "paused" : "active",
        };
      }),
    })),
}));
