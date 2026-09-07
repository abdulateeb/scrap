"use client";

import * as React from "react";
import {
  CircleStop,
  FileVideo,
  ImageUp,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

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
import { Alert, Badge, Spinner } from "@/components/ui/feedback";
import { classify } from "@/lib/api";
import { env } from "@/lib/env";
import type { MaterialKey } from "@/lib/materials";
import type { Composition, Result, SourceKind } from "@/lib/types";
import { cn, formatBytes, formatDuration } from "@/lib/utils";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-matroska"];

// Kept in one place in lib/env, because a guard here that disagrees with what
// the platform accepts is worse than no guard at all: the person picks a file,
// waits through the upload, and then gets a bare 413 instead of this message.
const MAX_BYTES = env.maxUploadBytes;

type JobStatus = "queued" | "running" | "done" | "failed";

interface Job {
  id: string;
  file: File;
  kind: SourceKind;
  /** Object URL for images, so the queue can show a thumbnail. */
  preview: string | null;
  status: JobStatus;
  result: Result | null;
  error: string | null;
}

function kindOf(file: File): SourceKind | null {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (VIDEO_TYPES.includes(file.type)) return "video";
  return null;
}

/**
 * One composition over several files.
 *
 * Shares are recomputed from the summed counts rather than averaged, because
 * averaging percentages across runs of different sizes would let a file with
 * three items pull as hard as a file with three hundred. The mean confidence is
 * weighted by count for the same reason.
 */
function combine(results: Result[]): Composition | null {
  const totals = new Map<MaterialKey, { count: number; confidence: number }>();
  let framesUsed = 0;
  let framesExcluded = 0;

  for (const result of results) {
    const composition = result.composition;
    if (!composition) continue;
    framesUsed += composition.framesUsed;
    framesExcluded += composition.framesExcluded;
    for (const share of composition.shares) {
      const running = totals.get(share.material) ?? { count: 0, confidence: 0 };
      running.count += share.count;
      running.confidence += share.meanConfidence * share.count;
      totals.set(share.material, running);
    }
  }

  const total = [...totals.values()].reduce((sum, one) => sum + one.count, 0);
  if (total === 0) return null;

  return {
    totalDetections: total,
    framesUsed,
    framesExcluded,
    shares: [...totals.entries()]
      .map(([material, one]) => ({
        material,
        count: one.count,
        share: one.count / total,
        meanConfidence: one.confidence / one.count,
      }))
      .sort((a, b) => b.share - a.share),
  };
}

export function ClassifyPanel() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abort = React.useRef<AbortController | null>(null);
  const cancelled = React.useRef(false);

  const [tab, setTab] = React.useState<"upload" | "live">("upload");
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [maxFrames, setMaxFrames] = React.useState(8);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const [active, setActive] = React.useState<number | null>(null);

  // Object URLs are revoked when the panel unmounts. Removing a single job
  // revokes its own URL at the point of removal.
  const jobsRef = React.useRef<Job[]>([]);
  React.useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  React.useEffect(() => {
    return () => {
      for (const job of jobsRef.current) {
        if (job.preview) URL.revokeObjectURL(job.preview);
      }
    };
  }, []);

  /**
   * Takes everything that was dropped, pasted or picked. Files that cannot be
   * used are counted and reported in one line rather than one alert each, so
   * dropping a folder of mixed content does not bury the screen.
   */
  const addFiles = React.useCallback((list: FileList | File[] | null) => {
    const incoming = Array.from(list ?? []);
    if (incoming.length === 0) return;

    const accepted: Job[] = [];
    const wrongType: string[] = [];
    const tooBig: string[] = [];

    for (const file of incoming) {
      const kind = kindOf(file);
      if (!kind) {
        wrongType.push(file.name);
        continue;
      }
      if (file.size > MAX_BYTES) {
        tooBig.push(file.name);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        file,
        kind,
        preview: kind === "image" ? URL.createObjectURL(file) : null,
        status: "queued",
        result: null,
        error: null,
      });
    }

    const complaints: string[] = [];
    if (wrongType.length > 0) {
      complaints.push(
        wrongType.length === 1
          ? `${wrongType[0]} is not a supported type`
          : `${wrongType.length} files were not a supported type`,
      );
    }
    if (tooBig.length > 0) {
      complaints.push(
        tooBig.length === 1
          ? `${tooBig[0]} is over ${formatBytes(MAX_BYTES)}`
          : `${tooBig.length} files were over ${formatBytes(MAX_BYTES)}`,
      );
    }

    setTab("upload");
    setNotice(
      complaints.length > 0
        ? `${complaints.join(", and ")}. ${
            accepted.length > 0
              ? `${accepted.length} added to the queue.`
              : "Nothing was added."
          }`
        : null,
    );

    if (accepted.length === 0) return;
    setError(null);
    setJobs((old) => [...old, ...accepted]);
    setSelectedId((old) => old ?? accepted[0].id);
  }, []);

  /**
   * The whole window is the drop target.
   *
   * Only the belt used to accept a drop, which meant a drop anywhere else was
   * handled by the browser: it navigated away and opened the file, losing the
   * page. Preventing the default across the window is what stops that, so this
   * listener exists as much to avoid the navigation as to accept the file.
   */
  React.useEffect(() => {
    let depth = 0;
    const carriesFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const onEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onOver = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      // Prevented even when the payload is not a file, because the browser
      // opening a dragged link over the page is the same lost session.
      event.preventDefault();
      depth = 0;
      setDragging(false);
      if (carriesFiles(event)) addFiles(event.dataTransfer?.files ?? null);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  /** A screenshot on the clipboard is the fastest way to try the thing. */
  React.useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      // Text pasted into the frames box carries no files, so this leaves
      // ordinary typing alone.
      if (!files || files.length === 0) return;
      event.preventDefault();
      addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  function removeJob(id: string) {
    setJobs((old) => {
      const going = old.find((job) => job.id === id);
      if (going?.preview) URL.revokeObjectURL(going.preview);
      return old.filter((job) => job.id !== id);
    });
    setSelectedId((old) => (old === id ? null : old));
  }

  function clearAll() {
    abort.current?.abort();
    cancelled.current = true;
    for (const job of jobs) {
      if (job.preview) URL.revokeObjectURL(job.preview);
    }
    setJobs([]);
    setSelectedId(null);
    setNotice(null);
    setError(null);
    setRunning(false);
    setFrameIndex(0);
    setActive(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function cancelRun() {
    cancelled.current = true;
    abort.current?.abort();
  }

  /**
   * Runs the queue one file at a time.
   *
   * Sequential on purpose. The model calls are already run in parallel inside
   * one file, so firing several files at once would only queue behind the same
   * concurrency limit while making the progress display a lie.
   */
  async function runQueue() {
    const pending = jobs.filter(
      (job) => job.status === "queued" || job.status === "failed",
    );
    if (pending.length === 0) return;

    cancelled.current = false;
    setRunning(true);
    setError(null);

    for (const job of pending) {
      if (cancelled.current) break;

      setJobs((old) =>
        old.map((one) =>
          one.id === job.id ? { ...one, status: "running", error: null } : one,
        ),
      );
      setSelectedId(job.id);

      const controller = new AbortController();
      abort.current = controller;

      try {
        const result = await classify(
          {
            file: job.file,
            sourceKind: job.kind,
            maxFrames: job.kind === "video" ? maxFrames : undefined,
          },
          { signal: controller.signal },
        );
        setJobs((old) =>
          old.map((one) =>
            one.id === job.id ? { ...one, status: "done", result } : one,
          ),
        );
      } catch (cause) {
        if (cancelled.current) {
          setJobs((old) =>
            old.map((one) =>
              one.id === job.id ? { ...one, status: "queued" } : one,
            ),
          );
          break;
        }
        const message =
          cause instanceof Error ? cause.message : "Classification failed.";
        setJobs((old) =>
          old.map((one) =>
            one.id === job.id
              ? { ...one, status: "failed", error: message }
              : one,
          ),
        );
      } finally {
        abort.current = null;
      }
    }

    setRunning(false);
  }

  const done = jobs.filter((job) => job.status === "done" && job.result);
  const doneResults = done.map((job) => job.result as Result);
  const selected = jobs.find((job) => job.id === selectedId) ?? null;
  const frame = selected?.result?.frames[frameIndex];
  const pendingCount = jobs.filter(
    (job) => job.status === "queued" || job.status === "failed",
  ).length;
  const batch = jobs.length > 1;

  const totalDuration = doneResults.reduce(
    (sum, one) => sum + one.durationMs,
    0,
  );

  return (
    <div className="space-y-5">
      <BeltHero dragging={dragging} />

      {/* Shown while a file is anywhere over the page, because the drop is now
          accepted anywhere rather than on the belt alone. */}
      {dragging ? (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-[2px]"
          aria-hidden
        >
          <div className="rounded-2xl border-2 border-dashed border-brand bg-panel px-8 py-6 text-center shadow-xl">
            <ImageUp className="mx-auto size-8 text-brand-text" aria-hidden />
            <p className="mt-2 text-sm font-medium text-ink">
              Drop to add to the queue
            </p>
            <p className="font-mono text-[11px] text-ink-faint">
              Images and videos, as many as you like
            </p>
          </div>
        </div>
      ) : null}

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
              multiple
              className="sr-only"
              accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
              onChange={(event) => addFiles(event.target.files)}
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
                  or drop files anywhere, or paste a screenshot
                </span>
              </span>
              <span className="font-mono text-[11px] text-ink-faint">
                JPG, PNG, WEBP, MP4, MOV, MKV &middot; up to{" "}
                {formatBytes(MAX_BYTES)} each
              </span>
            </button>

            {notice ? <Alert tone="warn">{notice}</Alert> : null}
            {error ? <Alert tone="danger">{error}</Alert> : null}

            {jobs.length > 0 ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel>
                    Queue
                    <span className="ml-2 font-mono text-[11px] normal-case tracking-normal text-ink-faint">
                      {done.length} of {jobs.length} done
                    </span>
                  </SectionLabel>

                  <div className="flex items-center gap-2">
                    {jobs.some((job) => job.kind === "video") ? (
                      <label className="flex items-center gap-2 text-xs text-ink-muted">
                        Frames
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={maxFrames}
                          disabled={running}
                          onChange={(event) =>
                            setMaxFrames(
                              Math.max(
                                1,
                                Math.min(20, Number(event.target.value) || 1),
                              ),
                            )
                          }
                          className="w-16"
                        />
                      </label>
                    ) : null}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAll}
                      aria-label="Clear the queue"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>

                <ul className="scroll-slim max-h-72 space-y-1.5 overflow-y-auto">
                  {jobs.map((job, index) => (
                    <li key={job.id}>
                      {/* A row, not a button wrapping a button. Selecting and
                          removing are two separate controls side by side. */}
                      <div
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-2 transition-colors",
                          job.id === selectedId
                            ? "border-brand-text/50 bg-brand/8"
                            : "border-line bg-surface hover:bg-surface-raised",
                        )}
                      >
                        <span className="w-5 shrink-0 text-center font-mono text-[11px] text-ink-faint">
                          {index + 1}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(job.id);
                            setFrameIndex(0);
                            setActive(null);
                          }}
                          aria-current={
                            job.id === selectedId ? "true" : undefined
                          }
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                        >
                          {job.preview ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={job.preview}
                              alt=""
                              className="size-9 shrink-0 rounded-md border border-line object-cover"
                            />
                          ) : (
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-raised">
                              <FileVideo
                                className="size-4 text-ink-faint"
                                aria-hidden
                              />
                            </span>
                          )}

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-ink">
                              {job.file.name}
                            </span>
                            <span className="block font-mono text-[11px] text-ink-faint">
                              {formatBytes(job.file.size)}
                              {job.result
                                ? ` · ${job.result.detectionCount} items`
                                : ""}
                            </span>
                          </span>
                        </button>

                        {job.status === "running" ? (
                          <Spinner className="text-brand-text" />
                        ) : null}
                        <Badge
                          tone={
                            job.status === "done"
                              ? "brand"
                              : job.status === "failed"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {job.status}
                        </Badge>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={running}
                          onClick={() => removeJob(job.id)}
                          aria-label={`Remove ${job.file.name}`}
                        >
                          <X aria-hidden />
                        </Button>
                      </div>

                      {job.error ? (
                        <p className="mt-1 pl-8 text-[11px] text-danger">
                          {job.error}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-3">
                  {running ? (
                    <Button type="button" variant="silver" onClick={cancelRun}>
                      <CircleStop aria-hidden />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="classic"
                      size="lg"
                      className="min-w-[9.5rem]"
                      disabled={pendingCount === 0}
                      onClick={() => void runQueue()}
                    >
                      {pendingCount === 0
                        ? "All done"
                        : batch
                          ? `Classify ${pendingCount}`
                          : "Classify"}
                    </Button>
                  )}

                  {done.length > 0 && !running ? (
                    <Button
                      type="button"
                      variant="silver"
                      size="lg"
                      onClick={clearAll}
                      aria-label="Start again"
                    >
                      <RotateCcw aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}

      {tab === "upload" && done.length > 0 ? (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-5 sm:gap-x-10">
              {[
                ["Files", `${done.length}`],
                [
                  "Frames",
                  String(
                    doneResults.reduce((sum, one) => sum + one.frameCount, 0),
                  ),
                ],
                [
                  "Items",
                  String(
                    doneResults.reduce(
                      (sum, one) => sum + one.detectionCount,
                      0,
                    ),
                  ),
                ],
                ["Took", formatDuration(totalDuration)],
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

          {/* One figure over everything classified so far. With a single file
              this is that file's own composition, so the panel reads the same
              as it always did. */}
          <CompositionPanel composition={combine(doneResults)} />

          {selected?.result ? (
            <div className="space-y-3">
              <SectionLabel>
                {batch ? `Frames of ${selected.file.name}` : "Frames"}
              </SectionLabel>

              {selected.result.error ? (
                <Alert tone="warn">{selected.result.error}</Alert>
              ) : null}

              {selected.result.frames.length > 1 ? (
                <div className="scroll-slim flex gap-2 overflow-x-auto pb-1">
                  {selected.result.frames.map((item, index) => (
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
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
