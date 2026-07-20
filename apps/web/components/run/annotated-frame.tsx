"use client";

import * as React from "react";

import { materialMeta } from "@/lib/materials";
import type { Frame } from "@/lib/types";
import { cn, formatPercent } from "@/lib/utils";

/**
 * A classified frame with every detection drawn on it.
 *
 * Boxes arrive normalised between 0 and 1 with the origin at the top left, so
 * they are placed with percentage offsets and stay correct at any rendered
 * size. The label chip carries the specific item name the model returned, which
 * is what a sorter would actually call the thing, with the material category
 * behind it as the colour.
 *
 * A chip that would sit above the top edge of the frame flips inside the box
 * instead, so nothing is clipped at the top of the picture.
 */
export function AnnotatedFrame({
  frame,
  activeIndex,
  onHover,
}: {
  frame: Frame;
  activeIndex: number | null;
  onHover: (index: number | null) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-[#0e100e]">
      {/* The frame arrives as a data URL, so a plain img is the right tag. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frame.image}
        alt={`Classified frame ${frame.index + 1}`}
        className="block w-full"
      />

      {frame.detections.map((detection, index) => {
        const box = detection.box;
        if (!box) return null;

        const meta = materialMeta(detection.material);
        const on = activeIndex === index;
        const dim = activeIndex !== null && !on;
        const label = detection.note || meta.label;
        const flip = box.y < 0.06;

        return (
          <div
            key={index}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "absolute transition-opacity duration-150",
              dim ? "opacity-25" : "opacity-100",
            )}
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
            }}
          >
            <span
              className="absolute inset-0 rounded-[3px] border-2"
              style={{
                borderColor: meta.color,
                boxShadow: on
                  ? `0 0 0 3px ${meta.color}55, inset 0 0 0 9999px ${meta.color}22`
                  : undefined,
              }}
              aria-hidden
            />

            <span
              className={cn(
                "absolute left-0 max-w-[220px] truncate rounded-[3px] px-1.5 py-[2px] text-[10px] leading-tight font-semibold whitespace-nowrap text-white",
                flip ? "top-0" : "-top-[17px]",
              )}
              style={{
                backgroundColor: meta.color,
                textShadow: "0 1px 1px rgba(0,0,0,0.35)",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}

      {/* A quiet count in the corner, the way a machine vision view labels
          itself. */}
      <span className="absolute right-2 bottom-2 rounded-md bg-black/65 px-2 py-1 font-mono text-[10px] font-medium text-white/90">
        {frame.detections.length} items
        {frame.timestampSeconds !== null
          ? ` · ${frame.timestampSeconds.toFixed(1)}s`
          : ""}
      </span>
    </div>
  );
}

/** The list beside the picture. Hovering a row highlights its box. */
export function DetectionList({
  frame,
  activeIndex,
  onHover,
}: {
  frame: Frame;
  activeIndex: number | null;
  onHover: (index: number | null) => void;
}) {
  if (frame.detections.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong px-3 py-6 text-center text-xs text-ink-muted">
        {frame.error ?? "Nothing was found in this frame."}
      </p>
    );
  }

  return (
    <ul className="scroll-slim max-h-[26rem] space-y-1 overflow-y-auto pr-1">
      {frame.detections.map((detection, index) => {
        const meta = materialMeta(detection.material);
        return (
          <li key={index}>
            <button
              type="button"
              onMouseEnter={() => onHover(index)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(index)}
              onBlur={() => onHover(null)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                activeIndex === index
                  ? "border-line-strong bg-surface-raised"
                  : "border-line bg-surface hover:bg-surface-raised",
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: meta.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink">
                  {detection.note || meta.label}
                </span>
                <span className="block text-[11px] text-ink-faint">
                  {meta.label}
                </span>
              </span>
              <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                {formatPercent(detection.confidence, 0)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
