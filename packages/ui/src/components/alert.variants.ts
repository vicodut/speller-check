import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn.util";

const alertClasses = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        destructive: "border-destructive/50 bg-card text-destructive",
        success: "border-success/50 bg-success-background text-success",
        warning: "border-warning/50 bg-warning-background text-warning",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type AlertVariants = VariantProps<typeof alertClasses>;

/** The alert look (shadcn, plus success and warning tones from the palette). */
export const alertVariants = (
  options: AlertVariants & { className?: string | undefined } = {},
): string => cn(alertClasses(options));
