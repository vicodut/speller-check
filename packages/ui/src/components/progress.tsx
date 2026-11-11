import type { ComponentProps } from "react";
import { cn } from "./cn.util";

/**
 * A progress bar with the shadcn look. A native <progress>, styled through its pseudo-elements:
 * no inline width style, which the page's CSP (style-src 'self') would refuse in markup.
 * Leave `value` out for an indeterminate bar.
 */
export const Progress = ({ className, max = 1, ...props }: ComponentProps<"progress">) => (
  <progress
    data-slot="progress"
    max={max}
    className={cn(
      "block h-2 w-full appearance-none overflow-hidden rounded-full border-0 bg-primary/20 accent-primary",
      "[&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:transition-all",
      "[&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary",
      className,
    )}
    {...props}
  />
);
