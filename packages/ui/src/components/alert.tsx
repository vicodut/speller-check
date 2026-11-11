import type { ComponentProps } from "react";
import { type AlertVariants, alertVariants } from "./alert.variants";
import { cn } from "./cn.util";

/**
 * A message box; an optional lucide icon goes first. Pass `role="alert"` for errors that must be
 * announced, `role="status"` for confirmations.
 */
export const Alert = ({ className, variant, ...props }: ComponentProps<"div"> & AlertVariants) => (
  <div data-slot="alert" className={alertVariants({ variant, className })} {...props} />
);

export const AlertTitle = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="alert-title"
    className={cn("col-start-2 min-h-4 font-medium tracking-tight", className)}
    {...props}
  />
);

export const AlertDescription = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="alert-description"
    className={cn(
      "col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
      className,
    )}
    {...props}
  />
);
