import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "./cn.util";

/**
 * A native <select> with the shadcn look (no popover library: the OS menu stays, with its
 * keyboard and screen-reader support). `className` goes on the select itself.
 */
export const NativeSelect = ({ className, children, ...props }: ComponentProps<"select">) => (
  <div data-slot="native-select" className="relative w-full min-w-0">
    <select
      className={cn(
        "h-9 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-input bg-transparent py-1 pr-9 pl-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow]",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
    />
  </div>
);
