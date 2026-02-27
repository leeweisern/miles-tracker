import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ className, label, id, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider"
          htmlFor={id}
        >
          {label}
        </label>
      )}
      <select
        className={cn(
          "appearance-none rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary",
          "focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-gold/30",
          "transition-colors duration-200",
          "bg-[length:12px] bg-[right_12px_center] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat pr-8",
          className
        )}
        id={id}
        {...props}
      />
    </div>
  );
}
