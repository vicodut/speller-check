import type { ComponentProps } from "react";
import { cn } from "./cn.util";

/** A panel with the shadcn card look. A <section>, so each card is a landmark-able region. */
export const Card = ({ className, ...props }: ComponentProps<"section">) => (
  <section
    data-slot="card"
    className={cn(
      "flex flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  />
);

export const CardHeader = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="card-header"
    className={cn(
      "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
      className,
    )}
    {...props}
  />
);

export const CardTitle = ({ className, ...props }: ComponentProps<"h2">) => (
  <h2 data-slot="card-title" className={cn("leading-none font-semibold", className)} {...props} />
);

export const CardDescription = ({ className, ...props }: ComponentProps<"p">) => (
  <p
    data-slot="card-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);

/** Sits at the top right of the header, beside the title and description. */
export const CardAction = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="card-action"
    className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
    {...props}
  />
);

export const CardContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div data-slot="card-content" className={cn("px-6", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: ComponentProps<"div">) => (
  <div data-slot="card-footer" className={cn("flex items-center px-6", className)} {...props} />
);
