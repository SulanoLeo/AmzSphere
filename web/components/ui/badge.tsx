import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-sm bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700", className)} {...props} />;
}