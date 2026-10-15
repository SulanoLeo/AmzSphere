import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-indigo-900 text-white hover:bg-indigo-800",
        outline: "border border-line bg-white text-ink hover:bg-canvas",
        ghost: "text-muted hover:bg-white hover:text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, ...props },
  ref,
) {
  return <button ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />;
});