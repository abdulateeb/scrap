"use client";

import * as React from "react";

import { getHealth } from "@/lib/api";

import { Alert } from "@/components/ui/feedback";

/**
 * Shows nothing while the service is healthy.
 *
 * The operator does not need to be told which model is running or whether a key
 * is present. They need to be told when the thing is down, and only then.
 */
export function ServiceStatus() {
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getHealth()
      .then(() => {
        if (!cancelled) setOffline(false);
      })
      .catch(() => {
        if (!cancelled) setOffline(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!offline) return null;

  return (
    <Alert tone="danger" title="Classification service is offline">
      Start the API on port 5000, then reload this page.
    </Alert>
  );
}
