"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

/**
 * The hero, and the signature of this interface.
 *
 * The product is a camera watching a conveyor, so the interface is a camera
 * watching a conveyor. The belt is not decoration behind the controls: it is
 * the drop target. Drag a belt photo or a clip of the line onto it and the
 * scan gate lights up.
 *
 * The canvas is loaded only in the browser and never blocks the page. Keyboard
 * and screen reader users are not sent here at all; the file button underneath
 * does the identical job, and the canvas is hidden from the accessibility tree.
 */

const BeltScene = dynamic(() => import("@/components/three/belt-scene"), {
  ssr: false,
  loading: () => null,
});

/**
 * Both of these subscribe to a browser signal rather than mirroring it into
 * state, which is what useSyncExternalStore exists for. The third argument is
 * the value used while rendering on the server, where neither signal exists.
 */

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function readVisibility(): boolean {
  return !document.hidden;
}

export function BeltHero({
  onDropFiles,
}: {
  onDropFiles: (files: FileList | null) => void;
}) {
  const reduced = React.useSyncExternalStore(
    subscribeMotion,
    readMotion,
    () => false,
  );
  const visible = React.useSyncExternalStore(
    subscribeVisibility,
    readVisibility,
    () => true,
  );
  const [dragging, setDragging] = React.useState(false);
  const depth = React.useRef(0);

  const running = visible && !reduced;

  return (
    <section
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        onDropFiles(event.dataTransfer.files);
      }}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border bg-[#e8ece5] transition-colors duration-300",
        dragging ? "border-brand-text/60" : "border-line",
      )}
    >
      <div className="h-[300px] lg:h-[360px]" aria-hidden>
        <BeltScene running={running} highlight={dragging} />
      </div>

      {/* A quiet ring that lights up while a file is over the belt, since the
          copy that used to say so has been taken out. */}
      <span
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl ring-2 transition-opacity duration-200",
          dragging ? "opacity-100 ring-brand" : "opacity-0 ring-transparent",
        )}
        aria-hidden
      />

      <span className="sr-only">
        A conveyor belt carrying mixed waste under a scan gate. Use the file
        button below to upload.
      </span>
    </section>
  );
}
