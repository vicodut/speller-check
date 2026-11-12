import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names; when two Tailwind classes conflict, the later one wins. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
