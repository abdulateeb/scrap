"use client";

import * as React from "react";
import { CircleStop, Play, Video } from "lucide-react";

import { AnnotatedFrame } from "@/components/run/annotated-frame";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { classify } from "@/lib/api";
import { materialMeta } from "@/lib/materials";
import type { Frame } from "@/lib/types";
import { formatPercent } from "@/lib/utils";

/**
 * Live mode.
 *
 * A camera pointed at the belt, scanned on a fixed cadence. One model call
 * takes a few seconds, so this is a scan interval and not a frame rate, and the
 * interface says so rather than pretending to run at video speed.
 *
 * Counts accumulate across every scan, so the composition beside the picture is
 * of the stream over time and not of the last frame alone.
 */

const INTERVAL_MS = 4000;

export function LiveMode() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const busy = React.useRef(false);
  const timer = React.useRef<number | null>(null);

  const [live, setLive] = React.useState(false);
  const [frame, setFrame] = React.useState<Frame | null>(null);
  const [active, setActive] = React.useState<number | null>(null);
  const [scans, setScans] = React.useState(0);
  const [totals, setTotals] = React.useState<Record<string, number>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState(false);

  const stop = React.useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
    setScanning(false);
  }, []);

  React.useEffect(() => stop, [stop]);

  const scanOnce = React.useCallback(async () => {
    const video = videoRef.current;
    if (!video || busy.current || video.videoWidth === 0) return;

    busy.current = true;
    setScanning(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) return;

      const result = await classify({
        file: new File([blob], "live.jpg", { type: "image/jpeg" }),
        sourceKind: "capture",
      });

      const next = result.frames[0];
      if (next) {
        setFrame(next);
        setActive(null);
        setScans((value) => value + 1);
        setTotals((previous) => {
          const merged = { ...previous };
          for (const detection of next.detections) {
            merged[detection.material] = (merged[detection.material] ?? 0) + 1;
          }
          return merged;
        });
      }
      setError(result.error);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The scan failed.");
    } finally {
      busy.current = false;
      setScanning(false);
    }
  }, []);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not provide camera access.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
      window.setTimeout(scanOnce, 600);
      timer.current = window.setInterval(scanOnce, INTERVAL_MS);
    } catch {
      setError(
        "The camera could not be opened. Check that the browser has permission.",
      );
    }
  }

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const ranked = Object.entries(totals).sort(([, a], [, b]) => b - a);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-xl border border-line bg-[#0e100e]">
          <video
            ref={videoRef}
            muted
            playsInline
            className="block w-full"
            style={{ display: frame ? "none" : "block" }}
          />
          {frame ? (
            <AnnotatedFrame
              frame={frame}
              activeIndex={active}
              onHover={setActive}
            />
          ) : null}
          {!live && !frame ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-2">
              <Video className="size-6 text-white/40" aria-hidden />
              <p className="text-xs text-white/60">Camera is off</p>
            </div>
          ) : null}
          {live ? (
            <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-black/65 px-2 py-1 font-mono text-[10px] font-medium text-white/90">
              <span
                className={
                  scanning
                    ? "size-1.5 animate-pulse rounded-full bg-brand"
                    : "size-1.5 rounded-full bg-white/50"
                }
                aria-hidden
              />
              {scanning ? "Scanning" : `Scans every ${INTERVAL_MS / 1000} s`}
            </span>
          ) : null}
        </div>

        {error ? <Alert tone="warn">{error}</Alert> : null}

        <div className="flex gap-2">
          {live ? (
            <Button type="button" variant="silver" onClick={stop}>
              <CircleStop aria-hidden />
              Stop
            </Button>
          ) : (
            <Button type="button" variant="classic" size="lg" onClick={start}>
              <Play aria-hidden />
              Start live scan
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-ink-faint uppercase">
            Running composition
          </p>
          <Badge>{scans} scans</Badge>
        </div>

        {total === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-3 py-8 text-center text-xs text-ink-muted">
            Start the camera and point it at the belt.
          </p>
        ) : (
          <>
            <div className="flex h-8 w-full overflow-hidden rounded-lg border border-line bg-surface-raised">
              {ranked.map(([material, count]) => (
                <span
                  key={material}
                  style={{
                    width: `${(count / total) * 100}%`,
                    backgroundColor: materialMeta(material).color,
                  }}
                />
              ))}
            </div>
            <ul className="space-y-1">
              {ranked.map(([material, count]) => (
                <li
                  key={material}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-1.5"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: materialMeta(material).color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">
                    {materialMeta(material).label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                    {count}
                  </span>
                  <span className="w-14 text-right font-mono text-xs font-semibold tabular-nums text-ink">
                    {formatPercent(count / total)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-faint">
              Counted across every scan since the camera started.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
