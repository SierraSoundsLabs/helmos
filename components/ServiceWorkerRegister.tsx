"use client";

import { useEffect } from "react";

// Registers /sw.js on every page so the app is installable as a PWA.
//
// We register on every page (not just /dashboard) so a marketing-page
// visitor who's already added Helm to their home screen still has an
// active SW when they land. Cheap: registration is idempotent and the
// SW itself does nothing on the network path.
//
// Errors are swallowed silently — a failed registration must not break
// the site. The most common failure is "SW disabled in this browser"
// (incognito Safari, certain enterprise configs), which is fine: the
// app degrades to a normal website.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Skip on localhost over http — SW requires https in prod, but
    // localhost is exempt. We allow it so dev can test the install
    // banner. If you ever need to disable in dev: check NODE_ENV here.
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Intentionally silent — registration is best-effort.
    });
  }, []);

  return null;
}
