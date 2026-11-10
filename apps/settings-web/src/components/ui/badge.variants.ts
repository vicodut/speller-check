import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn.util";

const badgeClasses = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-success-background text-success",
        warning: "border-transparent bg-warning-background text-warning",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeVariants = VariantProps<typeof badgeClasses>;

/** The badge look (shadcn, plus success and warning tones from the palette). */
export const badgeVariants = (
  options: BadgeVariants & { className?: string | undefined } = {},
): string => cn(badgeClasses(options));
