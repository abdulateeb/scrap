"use client";

import * as React from "react";
import { Button as RadixButton } from "@radix-ui/themes";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Buttons.
 *
 * `classic` and `silver` are the real Radix Themes control, rendered by Radix
 * itself, so the bevel, the gradient and the pressed state are the ones Radix
 * ships rather than an imitation of them. The accent comes from the Theme in
 * the root layout.
 *
 * `classic` is the green primary. `silver` is the light metal secondary, which
 * is Radix's surface treatment on the gray scale: a pale face with dark text,
 * so it sits beside the green without competing with it.
 *
 * The remaining variants are small local treatments Radix has no equivalent
 * for, and they stay hand rolled.
 */

const localVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-text/50 focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        ghost: "text-ink-muted hover:bg-surface-raised hover:text-ink",
        danger:
          "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
        link: "text-brand-text underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs [&_svg]:size-3.5",
        md: "h-9 px-4 [&_svg]:size-4",
        lg: "h-11 px-6 [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

type RadixVariant = "classic" | "silver";
type LocalVariant = "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const RADIX_SIZE: Record<Size, "1" | "2" | "3"> = {
  sm: "1",
  md: "2",
  lg: "3",
  icon: "2",
};

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    Omit<VariantProps<typeof localVariants>, "variant"> {
  variant?: RadixVariant | LocalVariant;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "silver", size = "md", asChild, ...props },
    ref,
  ) {
    if (variant === "classic" || variant === "silver") {
      const silver = variant === "silver";
      return (
        <RadixButton
          ref={ref}
          variant={silver ? "surface" : "classic"}
          color={silver ? "gray" : undefined}
          size={RADIX_SIZE[size as Size]}
          className={cn("cursor-pointer", className)}
          {...props}
        />
      );
    }

    const Component = asChild ? Slot : "button";
    return (
      <Component
        ref={ref}
        className={cn(
          localVariants({
            variant: variant as LocalVariant,
            size: size as Size,
          }),
          className,
        )}
        {...props}
      />
    );
  },
);
