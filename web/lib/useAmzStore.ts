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
  updateProductSEO: (sku: string, updatedFields: Partial<SeoFields>) => void;
  togglePpcStatus: (sku: string) => void;
}

const MIN_BULLETS = 5;
const MIN_IMAGES = 7;

function getMissingAssets(product: Pick<Product, "bullets" | "images">): MissingAssets {
  return {
    bullets: product.bullets.length < MIN_BULLETS,
    images: product.images.length < MIN_IMAGES,
  };
}

function getSeoScore(missingAssets: MissingAssets): number {
  return missingAssets.bullets || missingAssets.images ? 75 : 98;
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
  };
}

export const useAmzStore = create<AmzStore>((set) => ({
  products: [],
  hydrateProducts: (products, campaigns) =>
    set((state) => {
      const previousBySku = new Map(state.products.map((product) => [product.sku, product]));
      const campaignBySku = new Map(
        (campaigns ?? []).map((campaign) => [campaign.sku, campaign as CampaignStatus]),
      );
      return {
        products: products.map((product) =>
          toAmzProduct(
            product,
            previousBySku.get(product.sku),
            campaignBySku.get(product.sku),
          ),
        ),
      };
    }),
  upsertProducts: (products) =>
    set((state) => {
      const nextBySku = new Map(state.products.map((product) => [product.sku, product]));
      for (const product of products) {
        nextBySku.set(product.sku, toAmzProduct(product, nextBySku.get(product.sku)));
      }
      return { products: Array.from(nextBySku.values()) };
    }),
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
