import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The inset app shell.
 *
 * The sidebar sits flat on the window background with no border of its own. The
 * content floats as a raised panel with one large rounded top left corner, a
 * thin top and left border and a soft shadow. The panel stays flush with the
 * top, right and bottom edges, and it carries its own scroll so the window
 * itself never scrolls.
 */
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-window">
      <aside className="hidden w-60 shrink-0 flex-col bg-window md:flex">
        {sidebar}
      </aside>

      <main
        className={cn(
          "relative flex min-w-0 flex-1 flex-col overflow-hidden",
          "border-t border-l border-line bg-panel",
          "rounded-tl-[44px]",
          "shadow-[-10px_0_28px_rgba(20,24,15,0.06)]",
        )}
      >
        {children}
      </main>
    </div>
  );
}

/** A sticky header that stays put while the panel body scrolls under it. */
export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-8 py-6">
      <div className="min-w-0 space-y-1.5">
        <h1 className="font-display truncate text-xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** The scrolling region of the panel. Scroll lives here, never on the window. */
export function PanelBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("scroll-slim min-h-0 flex-1 overflow-y-auto", className)}>
      <div className="px-8 py-7">{children}</div>
    </div>
  );
}
