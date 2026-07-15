import * as React from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "brand" | "danger" | "warn" | "info";
}) {
  const tones: Record<string, string> = {
    neutral: "border-line-strong bg-surface-raised text-ink-muted",
    brand: "border-brand/35 bg-brand/12 text-brand-text",
    danger: "border-danger/35 bg-danger/12 text-danger",
    warn: "border-warn/35 bg-warn/12 text-warn",
    info: "border-info/35 bg-info/12 text-info",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "danger" | "warn";
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: { wrap: "border-info/30 bg-info/8 text-info", Icon: Info },
    warn: { wrap: "border-warn/30 bg-warn/8 text-warn", Icon: AlertTriangle },
    danger: {
      wrap: "border-danger/30 bg-danger/8 text-danger",
      Icon: AlertTriangle,
    },
  } as const;

  const { wrap, Icon } = tones[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-lg border p-3", wrap, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="text-xs font-semibold">{title}</p> : null}
        <div className="text-xs leading-relaxed text-ink-muted">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("size-4 animate-spin text-ink-muted", className)}
      aria-hidden
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface/40 px-6 py-14 text-center">
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-ink-muted">
        {description}
      </p>
      {action}
    </div>
  );
}

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-raised", className)}
      {...props}
    />
  );
}
