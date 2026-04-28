import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

window.addEventListener("unhandledrejection", (event) => {
  const r = event.reason;
  if (
    (r instanceof DOMException && r.name === "AbortError") ||
    (r instanceof Error && r.message === "signal is aborted without reason")
  ) {
    event.preventDefault();
  }
});

type MaintenanceGateResult = { blocked: boolean; isAdmin?: boolean; error?: boolean };
const maintenancePromise: Promise<MaintenanceGateResult> | undefined =
  (window as unknown as { __vkaMaintenance?: Promise<MaintenanceGateResult> }).__vkaMaintenance;

async function bootstrap() {
  if (maintenancePromise) {
    try {
      const result = await maintenancePromise;
      if (result.blocked) {
        return;
      }
    } catch {
    }
  }
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  createRoot(rootEl).render(<App />);
}

bootstrap();
