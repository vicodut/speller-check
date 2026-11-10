import type { ComponentProps } from "react";
import { cn } from "./cn.util";

/** A form label with the shadcn look; pass `htmlFor`, or wrap the control. */
export const Label = ({ className, ...props }: ComponentProps<"label">) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor or wrap the control.
  <label
    data-slot="label"
    className={cn(
      "flex select-none items-center gap-2 text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className,
    )}
    {...props}
  />
);
