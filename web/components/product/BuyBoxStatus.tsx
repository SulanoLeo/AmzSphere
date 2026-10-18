"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/context/ProductContext";
import { ShieldCheck, TriangleAlert } from "lucide-react";

export function BuyBoxStatus() {
  const { product, triggerSmartRepricer } = useProduct();

  if (product.hasBuyBox) {
    return (
      <Badge className="bg-teal-50 text-teal-800">
        <ShieldCheck size={12} className="mr-1" />Buy Box owned
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className="bg-red-50 text-red-800 border border-red-200">
        <TriangleAlert size={12} className="mr-1" />Buy Box lost
      </Badge>
      <Button variant="outline" onClick={triggerSmartRepricer}>
        Trigger Smart Repricer
      </Button>
    </div>
  );
}
