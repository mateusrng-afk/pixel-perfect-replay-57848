/**
 * Recovery for "Importing a module script failed" (Safari) and its Chrome/Firefox
 * equivalents: when a page file fails to download (flaky mobile network, app
 * resumed from background, new deploy), the app never starts. Browsers cache the
 * failed import, so only a full reload fixes it. We reload at most once per 10s
 * to avoid loops when the network is really down.
 */
const CHUNK_ERROR_RE =
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return CHUNK_ERROR_RE.test(message);
}

/** Inline script for the document head; runs before the app's own modules load. */
export const CHUNK_RELOAD_SCRIPT = `(function(){var K="gs-chunk-reload",R=${CHUNK_ERROR_RE.toString()};function reload(){try{var t=Number(sessionStorage.getItem(K))||0;if(Date.now()-t<10000)return;sessionStorage.setItem(K,String(Date.now()))}catch(e){}location.reload()}window.addEventListener("vite:preloadError",function(e){e.preventDefault();reload()});window.addEventListener("unhandledrejection",function(e){var r=e.reason;if(R.test((r&&r.message)||String(r)))reload()});window.addEventListener("error",function(e){if(R.test(e.message||""))reload()})})();`;

/** Same once-per-10s guard, for use from React error boundaries. */
export function reloadAfterChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem("gs-chunk-reload")) || 0;
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem("gs-chunk-reload", String(Date.now()));
  } catch {
    // storage unavailable: still reload
  }
  window.location.reload();
  return true;
}
