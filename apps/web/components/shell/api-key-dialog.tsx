"use client";

import * as React from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/field";
import { clearApiKey, maskApiKey, setApiKey, useApiKey } from "@/lib/api-key";
import { cn } from "@/lib/utils";

/**
 * Change the model API key from the page.
 *
 * A key normally lives in the environment of the deployed service, which means
 * changing it is a redeploy and everybody shares the one key. This puts the
 * choice in the browser instead: paste a key, look at the key already saved,
 * save it or walk away, and swap it again whenever the old one runs out.
 *
 * The field starts masked because a key is a password, and the eye reveals it
 * for the one case that actually needs it, which is checking that the key
 * already saved is the key you think it is.
 */
export function ApiKeyDialog({
  className,
  label = "Change API key",
}: {
  className?: string;
  label?: string;
}) {
  const saved = useApiKey();

  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [revealed, setRevealed] = React.useState(false);

  /**
   * Opening always starts from what is actually stored, so a half typed key
   * that was abandoned last time never comes back, and cancelling really does
   * leave the saved key alone.
   */
  function onOpenChange(next: boolean) {
    if (next) {
      setDraft(saved);
      setRevealed(false);
    }
    setOpen(next);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiKey(draft);
    setOpen(false);
  }

  function onRemove() {
    clearApiKey();
    setDraft("");
    setOpen(false);
  }

  const unchanged = draft.trim() === saved.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="silver" size="sm" className={className}>
          <KeyRound aria-hidden />
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent aria-describedby="api-key-help">
        <DialogTitle>Change API key</DialogTitle>
        <DialogDescription id="api-key-help" className="mt-1.5">
          The key is saved in this browser only. It is sent with your own
          classifications and is not stored on the server.
        </DialogDescription>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key-input">Model API key</Label>

            <div className="relative">
              <Input
                id="api-key-input"
                type={revealed ? "text" : "password"}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Paste your key here"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                // The dialog exists to type one value into, so the caret starts
                // in the only field it has.
                autoFocus
                className="pr-11 font-mono text-[13px]"
              />

              <button
                type="button"
                onClick={() => setRevealed((value) => !value)}
                aria-label={revealed ? "Hide the key" : "View the key"}
                aria-pressed={revealed}
                className={cn(
                  "absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1.5",
                  "text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink",
                  "focus-visible:ring-2 focus-visible:ring-brand-text/50 focus-visible:outline-none",
                )}
              >
                {revealed ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-ink-faint">
              {saved ? (
                <>
                  Saved in this browser:{" "}
                  <span className="font-mono text-ink-muted">
                    {maskApiKey(saved)}
                  </span>
                </>
              ) : (
                "No key is saved yet, so the service is running on its own key."
              )}
            </p>
          </div>

          <DialogFooter>
            {saved ? (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onRemove}
                className="sm:mr-auto"
              >
                Remove key
              </Button>
            ) : null}

            <Button
              type="button"
              variant="silver"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>

            <Button type="submit" variant="classic" disabled={unchanged}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
