import type { ComponentProps } from "react";
import { type ButtonVariants, buttonVariants } from "./button.variants";

type Props = ComponentProps<"button"> & ButtonVariants;

/** A button with the shadcn look. `type` defaults to "button", so it never submits by accident. */
export const Button = ({ className, variant, size, type = "button", ...props }: Props) => (
  <button
    type={type}
    data-slot="button"
    className={buttonVariants({ variant, size, className })}
    {...props}
  />
);
