"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface ProductRecord {
  sku: string;
  asin: string;
  supplierName: string;
  factoryUnitCost: number;
  shippingCostPerUnit: number;
  retailPrice: number;
  salesVelocity: number;
  currentStock: number;
  dailyPpcAdSpend: number;
  hasBuyBox: boolean;
  competitorPrice: number | null;
}

export interface DerivedMetrics {
  landedCost: number;
  amazonFees: number;
  unitProfit: number;
  dailyProfit: number;
  daysOfStockRemaining: number;
  reorderNeeded: boolean;
}

export interface ProductContextValue {
  product: ProductRecord;
  metrics: DerivedMetrics;
  updateSourcing: (patch: Partial<Omit<ProductRecord, "sku" | "asin">>) => void;
  pushChangesSync: () => void;
  simulateHijackerAttack: () => void;
  triggerSmartRepricer: () => void;
  setHasBuyBox: (value: boolean) => void;
  loadFromDashboard: (record: Partial<ProductRecord>) => void;
}

const DEFAULT_PRODUCT: ProductRecord = {
  sku: "AMZ-001",
  asin: "B0C9W7XNQ3",
  supplierName: "GlobalSource Trading Co.",
  factoryUnitCost: 4.5,
  shippingCostPerUnit: 1.2,
  retailPrice: 19.99,
  salesVelocity: 8,
  currentStock: 420,
  dailyPpcAdSpend: 12.0,
  hasBuyBox: true,
  competitorPrice: null,
};

const ProductContext = createContext<ProductContextValue | null>(null);

export function useProduct(): ProductContextValue {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProduct must be used within ProductProvider");
  return ctx;
}

function computeMetrics(p: ProductRecord): DerivedMetrics {
  const landedCost = p.factoryUnitCost + p.shippingCostPerUnit;
  const amazonFees = p.retailPrice * 0.15;
  const unitProfit = p.retailPrice - landedCost - amazonFees;
  const dailyProfit = unitProfit * p.salesVelocity - p.dailyPpcAdSpend;
  const daysOfStockRemaining =
    p.salesVelocity > 0 ? Math.ceil(p.currentStock / p.salesVelocity) : Infinity;
  return {
    landedCost,
    amazonFees,
    unitProfit,
    dailyProfit,
    daysOfStockRemaining,
    reorderNeeded: daysOfStockRemaining < 30,
  };
}

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const [product, setProduct] = useState<ProductRecord>(DEFAULT_PRODUCT);
  const metrics = useMemo(() => computeMetrics(product), [product]);

  const updateSourcing = useCallback(
    (patch: Partial<Omit<ProductRecord, "sku" | "asin">>) => {
      setProduct((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const pushChangesSync = useCallback(() => {
    // State is already reactive; this hook is the sync entry point for future backend POST.
  }, []);

  const simulateHijackerAttack = useCallback(() => {
    setProduct((prev) => ({
      ...prev,
      hasBuyBox: false,
      competitorPrice: Math.max(0.01, prev.retailPrice - 2.5),
    }));
  }, []);

  const triggerSmartRepricer = useCallback(() => {
    setProduct((prev) => {
      const competitor = prev.competitorPrice ?? prev.retailPrice;
      const newPrice = Math.max(0.01, competitor - 0.1);
      return { ...prev, retailPrice: newPrice, hasBuyBox: true };
    });
  }, []);

  const setHasBuyBox = useCallback((value: boolean) => {
    setProduct((prev) => ({ ...prev, hasBuyBox: value }));
  }, []);

  const loadFromDashboard = useCallback((record: Partial<ProductRecord>) => {
    setProduct((prev) => ({ ...prev, ...record }));
  }, []);

  const value = useMemo(
    () => ({
      product,
      metrics,
      updateSourcing,
      pushChangesSync,
      simulateHijackerAttack,
      triggerSmartRepricer,
      setHasBuyBox,
      loadFromDashboard,
    }),
    [product, metrics, updateSourcing, pushChangesSync, simulateHijackerAttack, triggerSmartRepricer, setHasBuyBox, loadFromDashboard]
  );

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}
