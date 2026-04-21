declare global {
  interface Window {
    fbq: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: (...args: unknown[]) => void };
    _fbq: Window["fbq"];
  }
}

let initialised = false;

export function injectBaseCode(baseCode: string): void {
  if (initialised || !baseCode.trim()) return;
  initialised = true;
  try {
    const range = document.createRange();
    range.selectNode(document.head);
    const fragment = range.createContextualFragment(baseCode);
    document.head.appendChild(fragment);
  } catch {
    // fallback: extract and exec inline script content
    const tmp = document.createElement("div");
    tmp.innerHTML = baseCode;
    tmp.querySelectorAll("script").forEach(s => {
      const script = document.createElement("script");
      if (s.src) {
        script.src = s.src;
        script.async = true;
      } else {
        script.textContent = s.textContent;
      }
      document.head.appendChild(script);
    });
  }
}

export function initPixel(pixelId: string): void {
  if (initialised || !pixelId) return;
  initialised = true;

  const f = window;
  const fb = function (...args: unknown[]) {
    if (fb.callMethod) {
      fb.callMethod(...args);
    } else {
      fb.queue = fb.queue ?? [];
      fb.queue.push(args);
    }
  } as Window["fbq"];
  if (!f.fbq) f.fbq = fb;
  f._fbq = fb;
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

export function fbTrack(event: string, params?: Record<string, unknown>): void {
  if (!window.fbq) return;
  window.fbq("track", event, params ?? {});
}

export function fbPageView(): void {
  if (!window.fbq) return;
  window.fbq("track", "PageView");
}
