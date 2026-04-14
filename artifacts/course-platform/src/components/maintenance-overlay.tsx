import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Construction } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function MaintenanceOverlay() {
  const { user } = useAuth();
  const [maintenance, setMaintenance] = useState<{ maintenanceMode: boolean; maintenanceMessage: string | null } | null>(null);

  const check = () => {
    fetch(`${API_BASE}/api/admin/public/maintenance`)
      .then(r => r.json())
      .then(data => setMaintenance(data))
      .catch(() => {});
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!maintenance?.maintenanceMode) return null;
  if (user?.role === "admin") return null;

  const message = maintenance.maintenanceMessage?.trim()
    || "We're currently performing scheduled maintenance. We'll be back online shortly!";

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto">
          <Construction className="w-10 h-10 text-amber-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Under Maintenance</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-400/5 border border-amber-400/20">
          <p className="text-xs text-amber-300">We apologize for the inconvenience. Please check back soon.</p>
        </div>
      </div>
    </div>
  );
}
