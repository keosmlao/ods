"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresh operational data only while the dashboard tab is visible. */
export function DashboardAutoRefresh({ intervalMs = 180_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, router]);

  return null;
}
