import { useState, useEffect, useCallback, Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Users, DollarSign, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, ChevronDown, ChevronUp, MessageSquare, ShieldCheck,
  Ban, RotateCcw, Percent, Loader2, Plus, Trash2, Download,
  Settings, FileText, CreditCard, BadgeIndianRupee, BarChart3,
  Shield, Image, Edit2, Save, X, Calendar
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API_BASE}${path}`, { credentials: "include", ...opts });
}

/* ── Types ── */
type Affiliate = {
  applicationId: number;
  userId: number;
  name: string;
  email: string;
  referralCode: string | null;
  role: string;
  isBlocked: boolean;
  commissionOverride: number | null;
  approvedAt: string | null;
  totalClicks: number;
  totalConversions: number;
  totalEarnings: number;
  pendingPayout: number;
  paidOut: number;
  kycStatus: string;
};

type Application = {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  promoteDescription: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  userRole: string;
};

type Payout = {
  id: number;
  userId: number;
  amount: number;
  paymentMethod: string;
  paymentDetails: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
  userName: string;
  userEmail: string;
  bankName: string | null;
  accountNumber: string | null;
};

type KycRecord = {
  id: number;
  userId: number;
  idProofName: string | null;
  panNumber: string | null;
  addressProofName: string | null;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  userName: string;
  userEmail: string;
};

type Creative = {
  id: number;
  title: string;
  type: "image" | "banner" | "text";
  url: string | null;
  content: string | null;
  description: string | null;
  createdAt: string;
};

type AffSettings = {
  commissionRate: number;
  affiliateEnabled: boolean;
  affiliateCookieDays: number;
  affiliateMinPayout: number;
  payoutPeriodDays: number;
};

/* ── Status helpers ── */
const STATUS = {
  pending:  { label: "Pending",  cls: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  approved: { label: "Approved", cls: "text-green-400 border-green-400/30 bg-green-400/10" },
  rejected: { label: "Rejected", cls: "text-red-400  border-red-400/30  bg-red-400/10" },
  not_submitted: { label: "Not Submitted", cls: "text-muted-foreground border-border bg-card" },
} as const;

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status as keyof typeof STATUS] ?? STATUS.not_submitted;
  return <Badge className={`text-[10px] ${s.cls}`}>{s.label}</Badge>;
}

function fmt(n: number) { return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }

/* ══════════════════════════════════════════
   TAB 1 — Overview: Manage Affiliates
══════════════════════════════════════════ */
function OverviewTab() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingCommission, setEditingCommission] = useState<number | null>(null);
  const [commissionVal, setCommissionVal] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/affiliate/admin/all-affiliates");
      if (res.ok) setAffiliates(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = affiliates.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalEarnings = affiliates.reduce((s, a) => s + a.totalEarnings, 0);
  const totalPending = affiliates.reduce((s, a) => s + a.pendingPayout, 0);
  const blocked = affiliates.filter(a => a.isBlocked).length;

  const doBlock = async (appId: number, block: boolean) => {
    setActionLoading(`block-${appId}`);
    try {
      const res = await apiFetch(`/api/affiliate/admin/affiliates/${appId}/${block ? "block" : "unblock"}`, { method: "POST" });
      if (res.ok) { toast({ title: block ? "Affiliate blocked" : "Affiliate unblocked" }); load(); }
      else toast({ title: "Action failed", variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const doCommission = async (appId: number) => {
    setActionLoading(`comm-${appId}`);
    try {
      const res = await apiFetch(`/api/affiliate/admin/affiliates/${appId}/commission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: commissionVal === "" ? null : commissionVal }),
      });
      if (res.ok) { toast({ title: "Commission updated" }); setEditingCommission(null); load(); }
      else toast({ title: "Failed to update commission", variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Affiliates", value: affiliates.length, color: "text-blue-400", icon: <Users className="w-4 h-4" /> },
          { label: "Total Earned", value: fmt(totalEarnings), color: "text-green-400", icon: <BadgeIndianRupee className="w-4 h-4" /> },
          { label: "Pending Payouts", value: fmt(totalPending), color: "text-amber-400", icon: <Clock className="w-4 h-4" /> },
          { label: "Blocked", value: blocked, color: "text-red-400", icon: <Ban className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">{s.icon}<span className="text-xs">{s.label}</span></div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search affiliate…" className="pl-8 bg-card border-border h-8 text-sm" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-card rounded animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No approved affiliates yet</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-card border-b border-border">
              <tr>{["Affiliate", "Code", "Clicks", "Conv.", "Earned", "Pending", "KYC", "Commission", "Status", "Actions"].map(h =>
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-3 py-3">{h}</th>
              )}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(a => (
                <tr key={a.userId} className={`hover:bg-card/50 transition-colors ${a.isBlocked ? "opacity-60" : ""}`}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-sm">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-primary">{a.referralCode ?? "—"}</td>
                  <td className="px-3 py-3 text-sm">{a.totalClicks}</td>
                  <td className="px-3 py-3 text-sm">{a.totalConversions}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-green-400">{fmt(a.totalEarnings)}</td>
                  <td className="px-3 py-3 text-sm text-amber-400">{fmt(a.pendingPayout)}</td>
                  <td className="px-3 py-3"><StatusBadge status={a.kycStatus} /></td>
                  {/* Commission */}
                  <td className="px-3 py-3">
                    {editingCommission === a.applicationId ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" min={0} max={100}
                          value={commissionVal}
                          onChange={e => setCommissionVal(e.target.value)}
                          placeholder="%" className="w-14 h-6 text-xs bg-background border-border px-1"
                        />
                        <button onClick={() => doCommission(a.applicationId)} disabled={!!actionLoading} className="text-green-400 hover:text-green-300">
                          {actionLoading === `comm-${a.applicationId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </button>
                        <button onClick={() => setEditingCommission(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{a.commissionOverride != null ? `${a.commissionOverride}% (custom)` : "Default"}</span>
                        <button onClick={() => { setEditingCommission(a.applicationId); setCommissionVal(String(a.commissionOverride ?? "")); }} className="text-muted-foreground hover:text-primary">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-3 py-3">
                    {a.isBlocked
                      ? <Badge className="text-[10px] text-red-400 border-red-400/30 bg-red-400/10">Blocked</Badge>
                      : <Badge className="text-[10px] text-green-400 border-green-400/30 bg-green-400/10">Active</Badge>
                    }
                  </td>
                  {/* Actions */}
                  <td className="px-3 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!actionLoading}
                      onClick={() => doBlock(a.applicationId, !a.isBlocked)}
                      className={`h-6 text-[10px] gap-1 ${a.isBlocked ? "border-green-500/30 text-green-400 hover:bg-green-500/10" : "border-red-500/30 text-red-400 hover:bg-red-500/10"}`}
                    >
                      {actionLoading === `block-${a.applicationId}` ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : a.isBlocked ? <RotateCcw className="w-2.5 h-2.5" /> : <Ban className="w-2.5 h-2.5" />}
                      {a.isBlocked ? "Unblock" : "Block"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB 2 — Applications
══════════════════════════════════════════ */
function AppCard({ app, onAction }: { app: Application; onAction: () => void }) {
  const [expanded, setExpanded] = useState(app.status === "pending");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const { toast } = useToast();
  const meta = STATUS[app.status];

  const approve = async () => {
    setLoading("approve");
    try {
      const res = await apiFetch(`/api/affiliate/admin/applications/${app.id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Application approved" });
      onAction();
    } catch { toast({ title: "Failed to approve", variant: "destructive" }); }
    finally { setLoading(null); }
  };

  const reject = async () => {
    if (!note.trim()) { toast({ title: "Admin note required to reject", variant: "destructive" }); return; }
    setLoading("reject");
    try {
      const res = await apiFetch(`/api/affiliate/admin/applications/${app.id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: note }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Application rejected" });
      onAction();
    } catch { toast({ title: "Failed to reject", variant: "destructive" }); }
    finally { setLoading(null); }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {app.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{app.fullName}</p>
            <Badge className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{app.email} · Applied {fmtDate(app.createdAt)}</p>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border p-4 bg-background/30 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><MessageSquare className="w-3 h-3" />Promotion Plan</p>
            <p className="text-sm text-foreground leading-relaxed bg-background border border-border rounded-lg p-3">{app.promoteDescription}</p>
          </div>
          {app.adminNote && (
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
              <p className="text-xs font-medium text-red-400 mb-1">Admin Note:</p>
              <p className="text-sm text-muted-foreground">{app.adminNote}</p>
            </div>
          )}
          {app.status === "pending" && (
            <div className="space-y-2 pt-1">
              <Textarea
                placeholder="Admin note (required for rejection)…"
                value={note} onChange={e => setNote(e.target.value)}
                rows={2} className="bg-background border-border resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={approve} disabled={!!loading} size="sm" className="bg-green-500 hover:bg-green-600 text-white gap-1.5">
                  {loading === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}Approve
                </Button>
                <Button onClick={reject} disabled={!!loading} size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5">
                  {loading === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}Reject
                </Button>
              </div>
            </div>
          )}
          {app.status !== "pending" && app.reviewedAt && (
            <p className="text-xs text-muted-foreground">Reviewed {fmtDate(app.reviewedAt)}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ApplicationsTab() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/affiliate/admin/applications");
      if (res.ok) setApps(await res.json());
    } catch { toast({ title: "Failed to load", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = apps.filter(a =>
    (filter === "all" || a.status === filter) &&
    (!search || a.fullName.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase()))
  );

  const counts = { all: apps.length, pending: 0, approved: 0, rejected: 0 };
  apps.forEach(a => { counts[a.status]++; });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: "all", label: "Total", color: "text-foreground" },
          { key: "pending", label: "Pending", color: "text-amber-400" },
          { key: "approved", label: "Approved", color: "text-green-400" },
          { key: "rejected", label: "Rejected", color: "text-red-400" },
        ].map(s => (
          <div key={s.key} className="bg-card border border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => setFilter(s.key as typeof filter)}>
            <p className={`text-2xl font-bold ${s.color}`}>{counts[s.key as keyof typeof counts]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" className="pl-8 bg-card border-border h-8 text-sm" />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No applications found</p>
          <p className="text-sm text-muted-foreground mt-1">{search || filter !== "all" ? "Try changing the filters." : "No one has applied yet."}</p>
        </div>
      ) : (
        <div className="space-y-3">{filtered.map(app => <AppCard key={app.id} app={app} onAction={load} />)}</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB 3 — Payouts
══════════════════════════════════════════ */
function PayoutsTab() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/affiliate/admin/all-payouts");
      if (res.ok) setPayouts(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doApprove = async (id: number) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await apiFetch(`/api/affiliate/admin/payouts/${id}/approve`, { method: "POST" });
      if (res.ok) { toast({ title: "Payout approved" }); load(); }
      else toast({ title: "Failed", variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const doReject = async (id: number) => {
    setActionLoading(`reject-${id}`);
    try {
      const res = await apiFetch(`/api/affiliate/admin/payouts/${id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: rejectNote[id] || "Rejected by admin" }),
      });
      if (res.ok) { toast({ title: "Payout rejected" }); load(); }
      else toast({ title: "Failed", variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const filtered = payouts.filter(p => filter === "all" || p.status === filter);
  const pending = payouts.filter(p => p.status === "pending");
  const totalPending = pending.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending Requests</p>
          <p className="text-xl font-bold text-amber-400">{pending.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending Amount</p>
          <p className="text-xl font-bold text-amber-400">{fmt(totalPending)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Requests</p>
          <p className="text-xl font-bold text-foreground">{payouts.length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5 w-fit">
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-card rounded animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-12 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No payout requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-sm">{p.userName}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{p.userEmail} · Requested {fmtDate(p.requestedAt)}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Amount: </span><span className="font-bold text-green-400">{fmt(p.amount)}</span></div>
                    <div><span className="text-muted-foreground">Method: </span><span>{p.paymentMethod}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Details: </span><span className="font-mono">{p.paymentDetails}</span></div>
                    {p.bankName && <div><span className="text-muted-foreground">Bank: </span><span>{p.bankName}</span></div>}
                    {p.rejectionReason && <div className="col-span-2 text-red-400"><span className="font-medium">Reason: </span>{p.rejectionReason}</div>}
                  </div>
                </div>
                {p.status === "pending" && (
                  <div className="space-y-2 min-w-[180px]">
                    <Input
                      value={rejectNote[p.id] ?? ""}
                      onChange={e => setRejectNote(r => ({ ...r, [p.id]: e.target.value }))}
                      placeholder="Rejection reason (optional)"
                      className="bg-background border-border h-7 text-xs"
                    />
                    <div className="flex gap-1.5">
                      <Button onClick={() => doApprove(p.id)} disabled={!!actionLoading} size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white gap-1 h-7 text-xs">
                        {actionLoading === `approve-${p.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}Approve
                      </Button>
                      <Button onClick={() => doReject(p.id)} disabled={!!actionLoading} size="sm" variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1 h-7 text-xs">
                        {actionLoading === `reject-${p.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB 4 — KYC
══════════════════════════════════════════ */
function KycTab() {
  const [records, setRecords] = useState<KycRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<number, string>>({});
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/affiliate/admin/all-kyc");
      if (res.ok) setRecords(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = async (userId: number, action: "approve" | "reject") => {
    const note = rejectNote[userId] ?? "";
    if (action === "reject" && !note.trim()) {
      toast({ title: "Please enter a rejection reason", variant: "destructive" }); return;
    }
    setActionLoading(`${action}-${userId}`);
    try {
      const res = await apiFetch(`/api/affiliate/admin/kyc/${userId}/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { adminNote: note } : {}),
      });
      if (res.ok) { toast({ title: `KYC ${action}d` }); load(); }
      else toast({ title: "Failed", variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const filtered = records.filter(r => filter === "all" || r.status === filter);
  const pendingCount = records.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Photo lightbox */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={expandedPhoto} alt="PAN" className="w-full rounded-xl border border-border" />
            <button
              onClick={() => setExpandedPhoto(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-card"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
              {f} {f !== "all" && `(${records.filter(r => r.status === f).length})`}
            </button>
          ))}
        </div>
        {pendingCount > 0 && (
          <span className="text-xs text-amber-400 font-medium">{pendingCount} pending review</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-12 text-center">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No KYC submissions</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full min-w-[700px]">
            <thead className="bg-card border-b border-border">
              <tr>
                {["Affiliate", "Name as Per PAN", "PAN Number", "PAN Photo", "Date", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(r => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-card/40 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground leading-tight">{r.userName}</p>
                      <p className="text-[11px] text-muted-foreground">{r.userEmail}</p>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-foreground max-w-[160px] truncate" title={r.idProofName ?? ""}>
                      {r.idProofName ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-mono text-foreground tracking-widest whitespace-nowrap">
                      {r.panNumber ?? <span className="text-muted-foreground font-sans tracking-normal">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.addressProofName ? (
                        <div
                          className="w-12 h-8 rounded overflow-hidden border border-border cursor-pointer group relative flex-shrink-0"
                          onClick={() => setExpandedPhoto(r.addressProofName!)}
                        >
                          <img src={r.addressProofName} alt="PAN" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.submittedAt)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2.5">
                      {r.status === "pending" ? (
                        <div className="flex items-center gap-1.5">
                          <Button onClick={() => doAction(r.userId, "approve")} disabled={!!actionLoading} size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white h-6 text-[10px] px-2 gap-1">
                            {actionLoading === `approve-${r.userId}` ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle2 className="w-2.5 h-2.5" />}Approve
                          </Button>
                          <Button
                            onClick={() => setRejectNote(n => ({ ...n, [r.userId]: n[r.userId] === undefined ? "" : undefined as any }))}
                            size="sm" variant="outline"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-6 text-[10px] px-2 gap-1">
                            <XCircle className="w-2.5 h-2.5" />Reject
                          </Button>
                        </div>
                      ) : r.adminNote ? (
                        <p className="text-[10px] text-muted-foreground max-w-[120px] truncate" title={r.adminNote}>{r.adminNote}</p>
                      ) : null}
                    </td>
                  </tr>
                  {/* Inline reject reason row */}
                  {r.status === "pending" && rejectNote[r.userId] !== undefined && (
                    <tr className="bg-red-500/5">
                      <td colSpan={6} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Enter rejection reason…"
                            value={rejectNote[r.userId] ?? ""}
                            onChange={e => setRejectNote(n => ({ ...n, [r.userId]: e.target.value }))}
                            className="bg-background border-red-500/30 text-sm h-7 flex-1"
                            autoFocus
                          />
                          <Button onClick={() => doAction(r.userId, "reject")} disabled={!!actionLoading} size="sm"
                            className="bg-red-500 hover:bg-red-600 text-white h-7 text-xs px-3 gap-1 flex-shrink-0">
                            {actionLoading === `reject-${r.userId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}Confirm Reject
                          </Button>
                          <button
                            onClick={() => setRejectNote(n => { const c = { ...n }; delete c[r.userId]; return c; })}
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB 5 — Creatives
══════════════════════════════════════════ */
function CreativesTab() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", type: "text" as Creative["type"], url: "", content: "", description: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/affiliate/creatives");
      if (res.ok) setCreatives(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title || !form.type) { toast({ title: "Title and type required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/api/affiliate/admin/creatives", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) { toast({ title: "Creative added" }); setShowForm(false); setForm({ title: "", type: "text", url: "", content: "", description: "" }); load(); }
      else toast({ title: "Failed to add creative", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const del = async (id: number) => {
    try {
      await apiFetch(`/api/affiliate/admin/creatives/${id}`, { method: "DELETE" });
      toast({ title: "Creative removed" });
      load();
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Promotional materials available to affiliates for download.</p>
        <Button onClick={() => setShowForm(s => !s)} size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />Add Creative
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="font-semibold text-sm">New Creative</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Banner 728x90" className="bg-background border-border text-sm h-8" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type *</Label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Creative["type"] }))}
                className="w-full h-8 rounded-md bg-background border border-border text-sm px-2">
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="banner">Banner</option>
              </select>
            </div>
          </div>
          {form.type !== "text" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL</Label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." className="bg-background border-border text-sm h-8" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Content / Ad Copy</Label>
            <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={3} className="bg-background border-border resize-none text-sm" placeholder="Ad copy text…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" className="bg-background border-border text-sm h-8" />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Save
            </Button>
            <Button onClick={() => setShowForm(false)} variant="outline" size="sm">Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-card rounded animate-pulse" />)}</div>
      ) : creatives.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-12 text-center">
          <Image className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No creatives yet</p>
          <p className="text-sm text-muted-foreground">Add banners, images, and ad copy for your affiliates.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>{["Title", "Type", "Content", "Added", ""].map(h =>
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-3 py-3">{h}</th>
              )}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {creatives.map(c => (
                <tr key={c.id} className="hover:bg-card/50">
                  <td className="px-3 py-3 font-medium text-sm">{c.title}</td>
                  <td className="px-3 py-3"><Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 capitalize">{c.type}</Badge></td>
                  <td className="px-3 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{c.content ?? c.url ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{fmtDate(c.createdAt)}</td>
                  <td className="px-3 py-3">
                    <button onClick={() => del(c.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB 6 — Settings
══════════════════════════════════════════ */
function SettingsTab() {
  const [settings, setSettings] = useState<AffSettings>({ commissionRate: 20, affiliateEnabled: true, affiliateCookieDays: 30, affiliateMinPayout: 500, payoutPeriodDays: 7 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    apiFetch("/api/affiliate/admin/settings").then(async r => {
      if (r.ok) setSettings(await r.json());
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/affiliate/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) toast({ title: "Settings saved" });
      else toast({ title: "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="h-48 bg-card rounded-xl animate-pulse" />;

  return (
    <div className="max-w-xl space-y-6">
      {/* Program toggle */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Settings className="w-4 h-4 text-primary" />Program Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Affiliate Program Enabled</p>
              <p className="text-xs text-muted-foreground">Allow users to apply and promote courses</p>
            </div>
            <Switch checked={settings.affiliateEnabled} onCheckedChange={v => setSettings(s => ({ ...s, affiliateEnabled: v }))} />
          </div>
        </div>
      </div>

      {/* Commission */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Percent className="w-4 h-4 text-primary" />Commission</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default Commission Rate (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={0} max={100}
                value={settings.commissionRate}
                onChange={e => setSettings(s => ({ ...s, commissionRate: parseInt(e.target.value) || 0 }))}
                className="bg-background border-border h-9 w-24 text-sm"
              />
              <span className="text-sm text-muted-foreground">% of sale amount</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-background border border-border rounded-lg p-3">
            Individual affiliates can have a custom commission rate set in the <strong>Overview</strong> tab. This is the default for all others.
          </p>
        </div>
      </div>

      {/* Cookie & Payout */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><BadgeIndianRupee className="w-4 h-4 text-primary" />Tracking & Payouts</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cookie Duration (days)</Label>
            <Input
              type="number" min={1} max={365}
              value={settings.affiliateCookieDays}
              onChange={e => setSettings(s => ({ ...s, affiliateCookieDays: parseInt(e.target.value) || 30 }))}
              className="bg-background border-border h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Referral attribution window</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Minimum Payout (₹)</Label>
            <Input
              type="number" min={1}
              value={settings.affiliateMinPayout}
              onChange={e => setSettings(s => ({ ...s, affiliateMinPayout: parseInt(e.target.value) || 500 }))}
              className="bg-background border-border h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Minimum withdrawal amount</p>
          </div>
        </div>
      </div>

      {/* Payout Period */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />Payout Schedule</h3>
        <p className="text-[11px] text-muted-foreground mb-4">How often affiliates can request or receive automatic payouts.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { label: "Every 3 Days", days: 3 },
            { label: "Every Week",   days: 7 },
            { label: "Every 2 Weeks", days: 14 },
            { label: "Every Month",  days: 30 },
          ].map(opt => (
            <button
              key={opt.days}
              onClick={() => setSettings(s => ({ ...s, payoutPeriodDays: opt.days }))}
              className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-all text-center ${
                settings.payoutPeriodDays === opt.days
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs text-muted-foreground">Custom period (days)</Label>
            <Input
              type="number" min={1} max={365}
              value={settings.payoutPeriodDays}
              onChange={e => setSettings(s => ({ ...s, payoutPeriodDays: parseInt(e.target.value) || 7 }))}
              className="bg-background border-border h-9 text-sm"
            />
          </div>
          <div className="pt-5 text-xs text-muted-foreground flex-shrink-0">
            = every <span className="text-foreground font-semibold">{settings.payoutPeriodDays}</span> day{settings.payoutPeriodDays !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="gap-1.5">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Settings
      </Button>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
const TABS = [
  { id: "overview",      label: "Overview",      icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: "applications",  label: "Applications",  icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "payouts",       label: "Payouts",        icon: <BadgeIndianRupee className="w-3.5 h-3.5" /> },
  { id: "kyc",          label: "KYC",            icon: <Shield className="w-3.5 h-3.5" /> },
  { id: "creatives",     label: "Creatives",      icon: <Image className="w-3.5 h-3.5" /> },
  { id: "settings",      label: "Settings",       icon: <Settings className="w-3.5 h-3.5" /> },
];

export default function AdminAffiliatesPage() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />Affiliate Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your entire affiliate program — approvals, commissions, payouts, KYC, creatives and settings.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 mb-6 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-background"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "overview"     && <OverviewTab />}
      {tab === "applications" && <ApplicationsTab />}
      {tab === "payouts"      && <PayoutsTab />}
      {tab === "kyc"          && <KycTab />}
      {tab === "creatives"    && <CreativesTab />}
      {tab === "settings"     && <SettingsTab />}
    </div>
  );
}
