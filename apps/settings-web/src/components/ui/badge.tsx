import type { ComponentProps } from "react";
import { type BadgeVariants, badgeVariants } from "./badge.variants";

/** A small label: a source (saved, env, unset), a kind (local, cloud), a model name. */
export const Badge = ({ className, variant, ...props }: ComponentProps<"span"> & BadgeVariants) => (
  <span data-slot="badge" className={badgeVariants({ variant, className })} {...props} />
);
