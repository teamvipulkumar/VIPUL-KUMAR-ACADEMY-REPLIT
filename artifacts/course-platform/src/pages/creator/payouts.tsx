import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Wallet, Sparkles, Clock, CheckCircle2, XCircle, Calendar,
  Building2, Smartphone, Hash, ArrowDownToLine,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Payout {
  id: number;
  amount: number;
  status: string;
  releaseDate: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: string;
}

interface DashboardData {
  totals: { lifetimeEarnings: number; pending: number; paid: number };
  nextPayout: { date: string; amount: number };
  creator: { kycStatus: string; hasBank: boolean };
}

async function fetchPayouts(): Promise<Payout[]> {
  const res = await fetch(`${API_BASE}/api/creator/payouts`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load payouts");
  return res.json();
}
async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/api/creator/dashboard`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function CreatorPayoutsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["creator-payouts"], queryFn: fetchPayouts });
  const { data: dash } = useQuery({ queryKey: ["creator-dashboard"], queryFn: fetchDashboard });
  const next = dash?.nextPayout;
  const pendingCount = (data ?? []).filter(p => p.status === "pending").length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-5 md:p-6">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Payouts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Saturday auto-payout cycle. Once released, the status becomes <span className="font-semibold text-foreground">Pending</span> until the bank transfer is made and marked <span className="font-semibold text-green-400">Paid</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={CheckCircle2} color="green"  label="Total Paid Out" value={dash ? fmt(dash.totals.paid) : "—"}    sub="All-time received" />
        <StatCard icon={Clock}        color="amber"  label="Pending"        value={dash ? fmt(dash.totals.pending) : "—"} sub={`${pendingCount} batch${pendingCount === 1 ? "" : "es"} pending`} />
        <StatCard icon={ArrowDownToLine} color="blue"   label="Lifetime Earnings" value={dash ? fmt(dash.totals.lifetimeEarnings) : "—"} sub="Net of cancellations" />
        <StatCard
          icon={Calendar}
          color="violet"
          label="Next Cycle"
          value={next ? new Date(next.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "—"}
          sub={next ? `Auto-release ${new Date(next.date).toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" })}` : ""}
        />
      </div>

      {/* Setup hint if KYC/bank missing */}
      {dash && (dash.creator.kycStatus !== "approved" || !dash.creator.hasBank) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 flex items-center gap-3 text-xs">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-muted-foreground">
            Payouts will only release once <span className="text-foreground font-semibold">KYC is approved</span> and <span className="text-foreground font-semibold">bank/UPI is added</span>.
            {dash.creator.kycStatus !== "approved" && " KYC pending."} {!dash.creator.hasBank && " Bank/UPI missing."}
          </span>
        </div>
      )}

      {/* Payout history table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Payout History</h2>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No payouts yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Pending commissions will be batched into a payout on the next Saturday.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/20">
                  <th className="py-3 px-4 font-medium">Released</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Method</th>
                  <th className="py-3 px-4 font-medium">Reference</th>
                  <th className="py-3 px-4 font-medium">Paid On</th>
                </tr>
              </thead>
              <tbody>
                {data.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(p.releaseDate ?? p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums">{fmt(p.amount)}</td>
                    <td className="py-3 px-4"><PayoutStatusPill status={p.status} /></td>
                    <td className="py-3 px-4">
                      <PaymentMethodBadge method={p.paymentMethod} />
                    </td>
                    <td className="py-3 px-4">
                      {p.paymentReference ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                          <Hash className="w-3 h-3" />{p.paymentReference}
                        </span>
                      ) : <span className="text-xs text-muted-foreground/50">—</span>}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── helpers ─────────────── */
function StatCard({
  icon: Icon, color, label, value, sub,
}: {
  icon: LucideIcon;
  color: "green" | "amber" | "blue" | "violet";
  label: string;
  value: string;
  sub?: string;
}) {
  const colorMap: Record<string, string> = {
    green:  "text-green-400  bg-green-500/10  border-green-500/30",
    amber:  "text-amber-400  bg-amber-500/10  border-amber-500/30",
    blue:   "text-blue-400   bg-blue-500/10   border-blue-500/30",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/30",
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-md transition-all">
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-xl md:text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-1">{sub}</div>}
    </div>
  );
}

function PayoutStatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; icon: LucideIcon }> = {
    pending:   { cls: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "Pending",   icon: Clock },
    paid:      { cls: "bg-green-500/10 text-green-400 border-green-500/30", label: "Paid",      icon: CheckCircle2 },
    failed:    { cls: "bg-red-500/10   text-red-400   border-red-500/30",   label: "Failed",    icon: XCircle },
    cancelled: { cls: "bg-red-500/10   text-red-400   border-red-500/30",   label: "Cancelled", icon: XCircle },
  };
  const m = map[status] ?? { cls: "bg-muted text-muted-foreground border-border", label: status, icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${m.cls}`}>
      <m.icon className="w-3 h-3" />{m.label}
    </span>
  );
}

function PaymentMethodBadge({ method }: { method: string | null }) {
  if (!method) return <span className="text-xs text-muted-foreground/50">—</span>;
  const isUpi = method.toLowerCase() === "upi";
  const Icon = isUpi ? Smartphone : Building2;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-[11px] font-medium capitalize">
      <Icon className="w-3 h-3" />{method}
    </span>
  );
}
