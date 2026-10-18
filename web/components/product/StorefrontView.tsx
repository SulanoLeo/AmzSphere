"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BadgeCheck, TriangleAlert } from "lucide-react";
import { useProduct } from "@/context/ProductContext";

export function StorefrontView() {
  const { product, metrics } = useProduct();

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-sm font-semibold text-indigo-950">Simulated Amazon Storefront</h2>
          <p className="mt-1 text-xs text-muted">Live preview of the Listing workspace</p>
        </div>
        <Badge>Preview</Badge>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-hidden rounded-md border border-line bg-amber-50/50">
          <div className="h-32 bg-gradient-to-br from-amber-50 to-white" />
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Amazon Listing</p>
            <h3 className="text-sm font-semibold text-indigo-950">Premium Widget · {product.sku}</h3>
            <p className="mt-1 text-[10px] text-muted">ASIN: {product.asin}</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-indigo-950">${product.retailPrice.toFixed(2)}</p>
                <p className="text-[10px] text-muted">
                  Landed ${metrics.landedCost.toFixed(2)} · Fee ${metrics.amazonFees.toFixed(2)}
                </p>
              </div>
              {product.hasBuyBox ? (
                <Badge className="bg-teal-50 text-teal-800">
                  <BadgeCheck size={12} className="mr-1" />Buy Box
                </Badge>
              ) : (
                <Badge className="bg-red-50 text-red-800 border border-red-200">
                  <TriangleAlert size={12} className="mr-1" />Buy Box Lost
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
