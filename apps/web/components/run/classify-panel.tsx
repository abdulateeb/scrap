"use client";

import * as React from "react";
import { FileVideo, ImageUp, RotateCcw, X } from "lucide-react";

import {
  AnnotatedFrame,
  DetectionList,
} from "@/components/run/annotated-frame";
import { CompositionPanel } from "@/components/run/composition";
import { LiveMode } from "@/components/run/live-mode";
import { BeltHero } from "@/components/three/belt-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, SectionLabel } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Alert, Spinner } from "@/components/ui/feedback";
import { classify } from "@/lib/api";
import type { Result, SourceKind } from "@/lib/types";
import { cn, formatBytes, formatDuration } from "@/lib/utils";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-matroska"];
const MAX_BYTES = 200 * 1024 * 1024;

function kindOf(file: File): SourceKind | null {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (VIDEO_TYPES.includes(file.type)) return "video";
  return null;
}

export function ClassifyPanel() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [tab, setTab] = React.useState<"upload" | "live">("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [sourceKind, setSourceKind] = React.useState<SourceKind>("image");
  const [maxFrames, setMaxFrames] = React.useState(8);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const [active, setActive] = React.useState<number | null>(null);

  // Object URLs are revoked when the preview is replaced or the panel unmounts.
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const accept = React.useCallback((next: File, kind: SourceKind) => {
    if (next.size > MAX_BYTES) {
      setError(`The file is larger than ${formatBytes(MAX_BYTES)}.`);
      return;
    }
    setError(null);
    setResult(null);
    setFile(next);
    setSourceKind(kind);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return kind === "image" ? URL.createObjectURL(next) : null;
    });
  }, []);

  const handleFiles = React.useCallback(
    (list: FileList | null) => {
      const next = list?.[0];
      if (!next) return;
      const kind = kindOf(next);
      if (!kind) {
        setError("Use a JPEG, PNG or WebP image, or an MP4, MOV or MKV video.");
        return;
      }
      setTab("upload");
      accept(next, kind);
    },
    [accept],
  );

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    setFrameIndex(0);
    setActive(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose an image or a video first.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const value = await classify({
        file,
        sourceKind,
        maxFrames: sourceKind === "video" ? maxFrames : undefined,
      });
      setResult(value);
      setFrameIndex(0);
      setActive(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Classification failed.");
    } finally {
      setPending(false);
    }
  }

  const frame = result?.frames[frameIndex];

  return (
    <form onSubmit={submit} className="space-y-5">
      <BeltHero onDropFiles={handleFiles} />

      <div
        role="tablist"
        aria-label="Input"
        className="inline-flex rounded-lg border border-line bg-surface-raised p-0.5"
      >
        {(
          [
            ["upload", "Upload"],
            ["live", "Live camera"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-md px-4 py-1.5 text-xs font-medium transition-colors",
              tab === value
                ? "bg-panel text-ink shadow-sm"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "live" ? (
        <Card>
          <CardContent className="pt-5">
            <LiveMode />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
              onChange={(event) => handleFiles(event.target.files)}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-surface px-6 py-9 transition-colors hover:border-brand-text/50 hover:bg-surface-raised"
            >
              <ImageUp className="size-7 text-brand-text" aria-hidden />
              <span className="text-sm font-medium text-ink">
                Click to upload
                <span className="font-normal text-ink-muted">
                  {" "}
                  or drag onto the belt
                </span>
              </span>
              <span className="font-mono text-[11px] text-ink-faint">
                JPG, PNG, WEBP, MP4, MOV, MKV
              </span>
            </button>

            {/* The action row only exists once there is a file. A primary
                button with nothing to act on is what made this area feel
                empty. */}
            {file ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 max-w-md flex-1 basis-full items-center gap-3 rounded-lg border border-line bg-surface p-2 sm:basis-72">
                  {preview ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={preview}
                      alt=""
                      className="size-11 shrink-0 rounded-md border border-line object-cover"
                    />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-line bg-surface-raised">
                      <FileVideo className="size-4 text-ink-faint" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">
                      {file.name}
                    </p>
                    <p className="font-mono text-[11px] text-ink-faint">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={reset}
                    aria-label="Remove the selected file"
                  >
                    <X aria-hidden />
                  </Button>
                </div>

                {sourceKind === "video" ? (
                  <label className="flex items-center gap-2 text-xs text-ink-muted">
                    Frames
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={maxFrames}
                      onChange={(event) =>
                        setMaxFrames(Number(event.target.value) || 1)
                      }
                      className="w-20"
                    />
                  </label>
                ) : null}

                <Button
                  type="submit"
                  variant="classic"
                  size="lg"
                  className="min-w-[9.5rem]"
                  disabled={pending}
                >
                  {pending ? <Spinner className="text-brand-ink" /> : null}
                  {pending ? "Classifying" : "Classify"}
                </Button>

                {result ? (
                  <Button
                    type="button"
                    variant="silver"
                    size="lg"
                    onClick={reset}
                    aria-label="Start again"
                  >
                    <RotateCcw aria-hidden />
                  </Button>
                ) : null}
              </div>
            ) : null}

            {error ? <Alert tone="danger">{error}</Alert> : null}
          </CardContent>
        </Card>
      )}

      {tab === "upload" && result ? (
        <>
          {result.error ? <Alert tone="warn">{result.error}</Alert> : null}

          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-5 sm:gap-x-10">
              {[
                ["Frames", String(result.frameCount)],
                ["Items", String(result.detectionCount)],
                ["Took", formatDuration(result.durationMs)],
              ].map(([label, value]) => (
                <div key={label}>
                  <SectionLabel>{label}</SectionLabel>
                  <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-ink">
                    {value}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <CompositionPanel composition={result.composition} />

          {result.frames.length > 1 ? (
            <div className="scroll-slim flex gap-2 overflow-x-auto pb-1">
              {result.frames.map((item, index) => (
                <button
                  key={item.index}
                  type="button"
                  onClick={() => {
                    setFrameIndex(index);
                    setActive(null);
                  }}
                  aria-current={index === frameIndex ? "true" : undefined}
                  className={cn(
                    "shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors",
                    index === frameIndex
                      ? "border-brand-text/50 bg-brand/12 text-ink"
                      : "border-line bg-surface text-ink-muted hover:text-ink",
                  )}
                >
                  {index + 1}
                  <span className="ml-1.5 font-mono text-[10px] text-ink-faint">
                    {item.detections.length}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {frame ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <AnnotatedFrame
                frame={frame}
                activeIndex={active}
                onHover={setActive}
              />
              <DetectionList
                frame={frame}
                activeIndex={active}
                onHover={setActive}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </form>
  );
}
