"use client";

import * as React from "react";

/**
 * The model API key, held in the browser and nowhere else.
 *
 * The service can run on a key of its own from the environment, but that key
 * belongs to whoever deployed it. This lets the person in front of the page put
 * their own key in instead and swap it whenever they like, without a redeploy
 * and without anybody else's key being touched.
 *
 * It lives in localStorage, so it survives a reload and stays on the one
 * machine. It is never sent anywhere except on the requests to apps/api that
 * need a key to answer, and clearing it hands the work back to the service key.
 */

const STORAGE_KEY = "scrap.model-api-key";

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Cleared on every write so the next read goes back to storage. Without a cache
 * React would be free to call the snapshot on every render, and a snapshot that
 * touches localStorage each time is a synchronous disk read in a render path.
 */
let cached: string | null = null;

function read(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Storage is unavailable in a private window with site data blocked. The
    // page still works on the service key, so this is not worth an error.
    return "";
  }
}

function emit(): void {
  cached = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  // A key saved in one tab should show up in the others without a reload.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string {
  if (cached === null) cached = read();
  return cached;
}

/**
 * There is no key on the server, and the first client render has to agree with
 * the server render or React reports a hydration mismatch.
 */
function getServerSnapshot(): string {
  return "";
}

/** The stored key, or an empty string when the browser has none. */
export function getApiKey(): string {
  return read();
}

/** Save a key. An empty or blank value removes the stored one. */
export function setApiKey(value: string): void {
  const key = value.trim();
  try {
    if (key) window.localStorage.setItem(STORAGE_KEY, key);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing can be stored, so nothing is. The service key still applies.
  }
  emit();
}

/** Forget the stored key and go back to whatever the service is running on. */
export function clearApiKey(): void {
  setApiKey("");
}

/** The stored key as a value a component re renders on. */
export function useApiKey(): string {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * "AIzaSyD9tR2p...4f7c" becomes "AIza••••4f7c".
 *
 * Enough of the ends to recognise which key is saved, never enough to use it if
 * somebody is looking over a shoulder or watching a screen share.
 */
export function maskApiKey(key: string): string {
  const value = key.trim();
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(6)}${value.slice(-4)}`;
}
