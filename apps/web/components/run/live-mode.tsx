"use client";

import * as React from "react";
import { CircleStop, Play, SwitchCamera, Video } from "lucide-react";

import { AnnotatedFrame } from "@/components/run/annotated-frame";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { classify } from "@/lib/api";
import { materialMeta } from "@/lib/materials";
import type { Frame } from "@/lib/types";
import { cn, formatPercent } from "@/lib/utils";

/**
 * Live mode.
 *
 * A camera pointed at the belt, scanned on a fixed cadence. One model call
 * takes a few seconds, so this is a scan interval and not a frame rate, and the
 * interface says so rather than pretending to run at video speed.
 *
 * Counts accumulate across every scan, so the composition beside the picture is
 * of the stream over time and not of the last frame alone.
 *
 * The camera is chosen in two ways, because the two situations are different.
 * On a desktop the machine often has several cameras registered and some of
 * them do not work, so there is a list to pick from. On a phone the useful
 * action is not picking from a list but turning the camera around, so there is
 * a flip control on the picture itself.
 */

/**
 * Two cadences, because one number could not serve both jobs.
 *
 * Fast sends a single model call per scan, which lands in about a second, so a
 * two second cadence is real rather than aspirational. Thorough tiles the frame
 * into a grid and classifies each tile as well as the whole, which is five
 * calls and measured at roughly four and a half seconds, so its interval is set
 * above that instead of quietly dropping every other tick.
 */
const MODES = {
  fast: { intervalMs: 2000, thorough: false, label: "Fast" },
  thorough: { intervalMs: 6000, thorough: true, label: "Thorough" },
} as const;

type Mode = keyof typeof MODES;

type Facing = "user" | "environment";

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

  const [cameras, setCameras] = React.useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = React.useState<string>("");
  const [facing, setFacing] = React.useState<Facing>("environment");
  const [mode, setMode] = React.useState<Mode>("fast");

  // The scan loop reads the mode through a ref, so changing it mid run takes
  // effect on the next scan without tearing down the interval or the camera.
  const modeRef = React.useRef<Mode>(mode);
  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  /**
   * Browsers hide camera labels until the user has granted permission once, so
   * before that this returns entries with an empty label. It is called again
   * after the camera opens, which is when the real names arrive.
   */
  const refreshCameras = React.useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setCameras(all.filter((device) => device.kind === "videoinput"));
    } catch {
      // Listing devices is a convenience. Failing to list them must not stop
      // the camera from being opened with the browser default.
    }
  }, []);

  const stopTracks = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = React.useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    stopTracks();
    setLive(false);
    setScanning(false);
  }, [stopTracks]);

  React.useEffect(() => stop, [stop]);

  React.useEffect(() => {
    // The lint rule reads this as setting state in an effect body. It is not:
    // refreshCameras awaits enumerateDevices first, so the state lands in a
    // later task. Listing the cameras on mount is the bootstrap half of the
    // subscription below, and without it the picker is empty until a device is
    // plugged in or unplugged.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCameras();
    // Cameras can be plugged in or removed while the page is open.
    const media = navigator.mediaDevices;
    if (!media?.addEventListener) return;
    const onChange = () => void refreshCameras();
    media.addEventListener("devicechange", onChange);
    return () => media.removeEventListener("devicechange", onChange);
  }, [refreshCameras]);

  /**
   * Opens a stream and attaches it to the video element, replacing whatever was
   * running before. Returns an error message rather than throwing, so every
   * caller reports failure the same way.
   */
  const openStream = React.useCallback(
    async (wanted: { deviceId?: string; facing?: Facing }): Promise<string | null> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return "This browser does not provide camera access.";
      }

      const video: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
      // An exact device id is a deliberate choice by the user, so it wins. The
      // facing mode is only a preference, because a desktop webcam reports no
      // facing at all and an exact match there would fail outright.
      if (wanted.deviceId) video.deviceId = { exact: wanted.deviceId };
      else if (wanted.facing) video.facingMode = { ideal: wanted.facing };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video,
          audio: false,
        });
        stopTracks();
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // The id is read back off the track, so the dropdown shows what is
        // actually running even when the browser chose the camera itself.
        const settings = stream.getVideoTracks()[0]?.getSettings();
        if (settings?.deviceId) setDeviceId(settings.deviceId);
        await refreshCameras();
        return null;
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : "";
        if (name === "NotAllowedError") {
          return "The camera was blocked. Allow camera access for this site, then try again.";
        }
        if (name === "NotFoundError" || name === "OverconstrainedError") {
          return "That camera could not be opened. Pick a different one from the list.";
        }
        if (name === "NotReadableError") {
          return "That camera is already in use by another application.";
        }
        return "The camera could not be opened.";
      }
    },
    [refreshCameras, stopTracks],
  );

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
        thorough: MODES[modeRef.current].thorough,
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

  const schedule = React.useCallback(
    (intervalMs: number) => {
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = window.setInterval(scanOnce, intervalMs);
    },
    [scanOnce],
  );

  // Changing the mode while the camera is running re-times the loop in place,
  // so the picture does not blink and the counts are not lost.
  React.useEffect(() => {
    if (!live) return;
    schedule(MODES[mode].intervalMs);
  }, [live, mode, schedule]);

  async function start() {
    setError(null);
    const failure = await openStream({ deviceId, facing });
    if (failure) {
      setError(failure);
      return;
    }
    setLive(true);
    window.setTimeout(scanOnce, 600);
    schedule(MODES[mode].intervalMs);
  }

  /** Switch camera without losing the counts already gathered. */
  async function choose(nextDeviceId: string) {
    setDeviceId(nextDeviceId);
    if (!live) return;
    setError(null);
    const failure = await openStream({ deviceId: nextDeviceId });
    if (failure) setError(failure);
  }

  /**
   * Turn the camera around. On a phone this is the front to back switch. On a
   * machine with several cameras and no facing information, the same control
   * moves to the next camera in the list, which is the useful behaviour there.
   */
  async function flip() {
    setError(null);
    const next: Facing = facing === "environment" ? "user" : "environment";
    setFacing(next);

    if (cameras.length > 1 && deviceId) {
      const at = cameras.findIndex((camera) => camera.deviceId === deviceId);
      const following = cameras[(at + 1) % cameras.length];
      if (following && following.deviceId !== deviceId) {
        setDeviceId(following.deviceId);
        if (live) {
          const failure = await openStream({ deviceId: following.deviceId });
          if (failure) setError(failure);
        }
        return;
      }
    }

    // Fall back to asking for the facing direction and letting the browser
    // resolve it, which is what works on a phone.
    setDeviceId("");
    if (live) {
      const failure = await openStream({ facing: next });
      if (failure) setError(failure);
    }
  }

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const ranked = Object.entries(totals).sort(([, a], [, b]) => b - a);
  const canFlip = cameras.length > 1 || !deviceId;

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
              {scanning
                ? "Scanning"
                : `Scans every ${MODES[mode].intervalMs / 1000} s`}
            </span>
          ) : null}

          {/* Turn the camera around. Sits on the picture at the top right,
              which is where a camera application puts it, so it is reachable
              with the thumb on a phone. */}
          {canFlip ? (
            <button
              type="button"
              onClick={flip}
              title="Switch camera"
              aria-label="Switch camera"
              className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <SwitchCamera className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        {error ? <Alert tone="warn">{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-2">
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

          {/* Speed against thoroughness. Fast is one model call per scan.
              Thorough tiles the frame and runs five, which finds more small
              items but cannot hold a short cadence. */}
          <div
            role="group"
            aria-label="Scan mode"
            className="inline-flex rounded-lg border border-line bg-surface-raised p-0.5"
          >
            {(Object.keys(MODES) as Mode[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                title={
                  value === "fast"
                    ? "One pass per scan, every 2 seconds"
                    : "Tiled into a grid, five passes per scan, every 6 seconds"
                }
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === value
                    ? "bg-panel text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {MODES[value].label}
              </button>
            ))}
          </div>

          {/* The camera list. A machine often has more than one registered and
              some of them do not open, so the user needs to be able to pick a
              working one rather than being stuck with the browser default. */}
          {cameras.length > 0 ? (
            <label className="flex min-w-0 flex-1 basis-56 items-center gap-2 text-xs text-ink-muted">
              <span className="sr-only">Camera</span>
              <select
                value={deviceId}
                onChange={(event) => void choose(event.target.value)}
                className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-window px-2 text-xs text-ink outline-none transition-colors focus:border-brand/60 focus:ring-2 focus:ring-brand/25"
              >
                <option value="">Default camera</option>
                {cameras.map((camera, index) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
