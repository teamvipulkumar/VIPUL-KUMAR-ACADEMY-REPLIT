declare global {
  interface Window {
    fbq: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: (...args: unknown[]) => void };
    _fbq: Window["fbq"];
  }
}

let initialised = false;

function markInitialised() {
  initialised = true;
}

export function injectBaseCode(baseCode: string): void {
  if (initialised || !baseCode.trim()) return;
  // If fbq already exists it was injected server-side via the HTML head — skip re-injection
  if (window.fbq) { initialised = true; return; }
  initialised = true;

  const tmp = document.createElement("div");
  tmp.innerHTML = baseCode;
  tmp.querySelectorAll("script").forEach(s => {
    const script = document.createElement("script");
    Array.from(s.attributes).forEach(a => { if (a.name !== "src") script.setAttribute(a.name, a.value); });
    if (s.src) {
      script.src = s.src;
      script.async = true;
    } else {
      script.textContent = s.textContent;
    }
    document.head.appendChild(script);
  });
  tmp.querySelectorAll("noscript").forEach(n => document.head.appendChild(n.cloneNode(true)));
}

export function initPixel(pixelId: string): void {
  if (initialised || !pixelId) return;
  if (window.fbq) { initialised = true; return; }
  initialised = true;

  const fb = function (...args: unknown[]) {
    if (fb.callMethod) fb.callMethod(...args);
    else { fb.queue = fb.queue ?? []; fb.queue.push(args); }
  } as Window["fbq"];
  if (!window.fbq) window.fbq = fb;
  window._fbq = fb;
  fb.push = fb;
  fb.loaded = true;
  fb.version = "2.0";
  fb.queue = [];

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq("init", pixelId);
  window.fbq("track", "PageView");
}

export function ensureInitialised(): void {
  if (window.fbq) markInitialised();
}

export function fbTrack(event: string, params?: Record<string, unknown>): void {
  if (!window.fbq) return;
  window.fbq("track", event, params ?? {});
}

export function fbPageView(): void {
  if (!window.fbq) return;
  window.fbq("track", "PageView");
}
