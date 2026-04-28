import { useEffect } from "react";

/**
 * Lightweight runtime watcher for maintenance mode.
 *
 * The hard gate in index.html only runs at initial page load. If an admin
 * toggles maintenance ON while users are already browsing, those users would
 * never see the maintenance screen until refresh. This component polls the
 * public maintenance endpoint every 30s and triggers a hard reload if
 * maintenance turns ON for a non-admin — at which point the index.html gate
 * will catch it and render the maintenance page (no flash).
 *
 * Polling-only (no SSE) to keep the surface tiny and resilient.
 */
export function MaintenanceWatcher() {
  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}api/admin/public/maintenance`;

    async function check() {
      try {
        const r = await fetch(url, { credentials: "include", cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json() as { maintenanceMode?: boolean; isAdmin?: boolean };
        if (cancelled) return;
        if (data.maintenanceMode && !data.isAdmin) {
          // Force a reload so the inline gate in index.html takes over and
          // renders the static maintenance page before any React paint.
          window.location.reload();
        }
      } catch {
        // network blip — ignore, try again next interval
      }
    }

    const interval = window.setInterval(check, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
