import { materialMeta } from "@/lib/materials";
import type { Composition } from "@/lib/types";
import { formatPercent } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";

/**
 * The composition of a run.
 *
 * The share is the count of detections of one material divided by the total
 * number of detections across the frames that were classified. It is a count
 * based share over sampled frames, not a mass based share of the stream, and
 * the footnote says so on screen so the number is never read as more than it is.
 */
export function CompositionPanel({
  composition,
}: {
  composition: Composition | null;
}) {
  if (!composition || composition.totalDetections === 0) {
    return (
      <EmptyState
        title="Nothing classified yet"
        description="Drop a belt photo or clip onto the conveyor to start."
      />
    );
  }

  const shares = [...composition.shares].sort((a, b) => b.share - a.share);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stream composition</CardTitle>
        <p className="font-mono text-[11px] text-ink-muted">
          {composition.totalDetections} items across{" "}
          {composition.framesUsed} classified{" "}
          {composition.framesUsed === 1 ? "frame" : "frames"}
          {composition.framesExcluded > 0
            ? `, ${composition.framesExcluded} excluded`
            : ""}
          .
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          className="flex h-9 w-full overflow-hidden rounded-lg border border-line bg-window"
          role="img"
          aria-label="Share of each material in this run"
        >
          {shares.map((entry) => {
            const meta = materialMeta(entry.material);
            return (
              <span
                key={entry.material}
                title={`${meta.label} ${formatPercent(entry.share)}`}
                style={{
                  width: `${entry.share * 100}%`,
                  backgroundColor: meta.color,
                }}
              />
            );
          })}
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {shares.map((entry) => {
            const meta = materialMeta(entry.material);
            return (
              <li
                key={entry.material}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-window/60 px-3 py-2"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-xs text-ink">
                  {meta.label}
                </span>
                <span className="font-mono text-xs tabular-nums text-ink-muted">
                  {entry.count}
                </span>
                <span className="w-16 text-right font-mono text-sm font-semibold tabular-nums text-ink">
                  {formatPercent(entry.share)}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] text-ink-faint">
          Counted per sampled frame, not a mass balance of the belt.
        </p>
      </CardContent>
    </Card>
  );
}
