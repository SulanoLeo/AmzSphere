"use client";

import type { ReactNode } from "react";
import { ProductProvider } from "@/context/ProductContext";

export function Providers({ children }: { children: ReactNode }) {
  return <ProductProvider>{children}</ProductProvider>;
}
