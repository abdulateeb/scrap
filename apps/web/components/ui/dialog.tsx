"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Theme } from "@radix-ui/themes";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The dialog.
 *
 * Radix handles the parts that are easy to get wrong by hand: the focus is
 * trapped inside while it is open and returned to whatever opened it on close,
 * Escape and a click on the backdrop both close it, and the rest of the page is
 * hidden from a screen reader while it is up.
 *
 * The look is the shell's own. The backdrop blurs the page behind it rather
 * than only darkening it, so the dialog reads as the one thing in front, and
 * the panel sits in the middle of the screen at every size.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DialogContent({ className, children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      {/* The portal puts this at the end of the body, which is outside the
          Theme in the root layout. Radix Themes styles its controls through a
          class on that element, so without a Theme here the buttons inside the
          dialog come out as bare unstyled text. No background on it: the
          overlay below is the background. */}
      <Theme hasBackground={false}>
        <DialogPrimitive.Overlay
          className={cn(
            "dialog-overlay fixed inset-0 z-[60]",
            "bg-ink/45 backdrop-blur-md",
          )}
        />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "dialog-panel fixed top-1/2 left-1/2 z-[60]",
            "w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-line bg-panel p-6 outline-none",
            "shadow-[0_24px_60px_rgba(20,24,15,0.22)]",
            className,
          )}
          {...props}
        >
          {children}

          <DialogPrimitive.Close
            className={cn(
              "absolute top-4 right-4 rounded-md p-1.5 text-ink-faint transition-colors",
              "hover:bg-surface-raised hover:text-ink",
              "focus-visible:ring-2 focus-visible:ring-brand-text/50 focus-visible:outline-none",
            )}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </Theme>
    </DialogPrimitive.Portal>
  );
});

export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "font-display text-base font-semibold tracking-tight text-ink",
        className,
      )}
      {...props}
    />
  );
});

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-[13px] leading-relaxed text-ink-muted", className)}
      {...props}
    />
  );
});

/** The row of controls at the bottom. Stacks on a narrow screen. */
export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
