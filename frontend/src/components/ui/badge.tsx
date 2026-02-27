import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium font-mono text-xs",
  {
    variants: {
      variant: {
        default: "bg-bg-elevated text-text-secondary",
        economy: "bg-cabin-economy/15 text-cabin-economy",
        business: "bg-cabin-business/15 text-cabin-business",
        first: "bg-cabin-first/15 text-cabin-first",
        available: "bg-available/15 text-available",
        unavailable: "bg-unavailable/15 text-unavailable",
        gold: "bg-gold/15 text-gold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
