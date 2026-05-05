import { useEffect } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Placement = "head" | "body_start" | "body_end";

interface Snippet {
  id: number;
  name: string;
  code: string;
  placement: Placement;
  position: number;
}

const INJECTED_ATTR = "data-vka-snippet";

/**
 * Walk a subtree and replace every <script> element with a freshly created
 * one (recursively, including nested scripts). Inert scripts created via
 * innerHTML / template parsing won't execute — only document.createElement
 * <script> nodes do. Returns the (possibly-replaced) root element.
 */
function makeScriptsExecutable(root: Element): void {
  const inertScripts = Array.from(root.querySelectorAll("script"));
  for (const oldScript of inertScripts) {
    const newScript = document.createElement("script");
    for (let i = 0; i < oldScript.attributes.length; i++) {
      const a = oldScript.attributes[i];
      newScript.setAttribute(a.name, a.value);
    }
    if (oldScript.textContent) newScript.text = oldScript.textContent;
    oldScript.parentNode?.replaceChild(newScript, oldScript);
  }
}

/**
 * Parse one snippet's HTML/JS code into executable DOM nodes tagged with
 * `data-vka-snippet=<id>` so they can be cleared on re-mount.
 */
function buildExecutableNodes(code: string, snippetId: number): Node[] {
  const template = document.createElement("template");
  template.innerHTML = code;

  const out: Node[] = [];
  template.content.childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "SCRIPT") {
      // Top-level script: create executable replacement directly.
      const oldScript = node as HTMLScriptElement;
      const newScript = document.createElement("script");
      for (let i = 0; i < oldScript.attributes.length; i++) {
        const a = oldScript.attributes[i];
        newScript.setAttribute(a.name, a.value);
      }
      if (oldScript.textContent) newScript.text = oldScript.textContent;
      newScript.setAttribute(INJECTED_ATTR, String(snippetId));
      out.push(newScript);
    } else {
      const clone = node.cloneNode(true);
      if (clone.nodeType === Node.ELEMENT_NODE) {
        // Recursively swap any descendant <script> nodes for executable ones.
        makeScriptsExecutable(clone as Element);
        (clone as Element).setAttribute(INJECTED_ATTR, String(snippetId));
      }
      out.push(clone);
    }
  });
  return out;
}

function clearPreviouslyInjected() {
  document.querySelectorAll(`[${INJECTED_ATTR}]`).forEach(el => el.remove());
}

/**
 * Mounted once at app root. Fetches enabled snippets and injects them into
 * the document head/body. Idempotent across HMR / re-mounts because every
 * injected node is tagged with `data-vka-snippet` and cleared on each run
 * (regardless of whether the new fetch returns any rows).
 */
export function CodeSnippetsInjector() {
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/code-snippets`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Snippet[]) => {
        if (cancelled) return;
        // Always clear first — even on empty rows — so disabling/deleting a
        // snippet during the session removes it on re-mount/HMR.
        clearPreviouslyInjected();
        if (!Array.isArray(rows) || rows.length === 0) return;

        // Group by placement so we can handle body_start ordering correctly.
        const byPlacement: Record<Placement, Snippet[]> = {
          head: [],
          body_start: [],
          body_end: [],
        };
        for (const s of rows) {
          if (!s.code || !s.code.trim()) continue;
          if (byPlacement[s.placement]) byPlacement[s.placement].push(s);
        }

        // HEAD: append in API order.
        for (const s of byPlacement.head) {
          for (const node of buildExecutableNodes(s.code, s.id)) {
            document.head.appendChild(node);
          }
        }

        // BODY_END: append in API order.
        for (const s of byPlacement.body_end) {
          for (const node of buildExecutableNodes(s.code, s.id)) {
            document.body.appendChild(node);
          }
        }

        // BODY_START: must end up at top of <body> in API order. Build the
        // full ordered node list first, then iterate in REVERSE inserting at
        // body.firstChild — that yields the correct final left-to-right order
        // for both inter-snippet and intra-snippet sequencing.
        const startNodes: Node[] = [];
        for (const s of byPlacement.body_start) {
          for (const node of buildExecutableNodes(s.code, s.id)) {
            startNodes.push(node);
          }
        }
        for (let i = startNodes.length - 1; i >= 0; i--) {
          document.body.insertBefore(startNodes[i], document.body.firstChild);
        }
      })
      .catch(() => {
        /* snippets are best-effort — never break the app */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
