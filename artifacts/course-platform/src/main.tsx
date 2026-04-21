import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress harmless AbortError / "signal is aborted without reason" that fires
// whenever React Query cancels an in-flight fetch on navigation. These are not
// real errors — the Vite runtime-error overlay would show them as crashes.
window.addEventListener("unhandledrejection", (event) => {
  const r = event.reason;
  if (
    (r instanceof DOMException && r.name === "AbortError") ||
    (r instanceof Error && r.message === "signal is aborted without reason")
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
