import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, Clock, AlertCircle, Users, Loader2,
  Search, ChevronDown, ChevronUp, MessageSquare, ShieldCheck
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...opts });
  return res;
}

type App = {
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

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending",  cls: "text-amber-400 border-amber-400/30 bg-amber-400/10",  icon: <Clock className="w-3 h-3" /> },
  approved: { label: "Approved", cls: "text-green-400 border-green-400/30 bg-green-400/10", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: "Rejected", cls: "text-red-400 border-red-400/30 bg-red-400/10",       icon: <XCircle className="w-3 h-3" /> },
};

function AppCard({ app, onAction }: { app: App; onAction: () => void }) {
  const [expanded, setExpanded] = useState(app.status === "pending");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const { toast } = useToast();
  const meta = STATUS_META[app.status];

  const approve = async () => {
    setLoading("approve");
    try {
      const res = await apiFetch(`/api/affiliate/admin/applications/${app.id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Application approved", description: `${app.fullName} is now an affiliate.` });
      onAction();
    } catch { toast({ title: "Failed to approve", variant: "destructive" }); }
    finally { setLoading(null); }
  };

  const reject = async () => {
    if (!note.trim()) { toast({ title: "Admin note is required to reject", variant: "destructive" }); return; }
    setLoading("reject");
    try {
      const res = await apiFetch(`/api/affiliate/admin/applications/${app.id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: note }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Application rejected" });
      onAction();
    } catch { toast({ title: "Failed to reject", variant: "destructive" }); }
    finally { setLoading(null); }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
          {app.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground">{app.fullName}</p>
            <Badge className={`text-[10px] gap-0.5 ${meta.cls}`}>{meta.icon}{meta.label}</Badge>
            {app.userRole === "affiliate" && (
              <Badge className="text-[10px] gap-0.5 text-blue-400 border-blue-400/30 bg-blue-400/10">
                <ShieldCheck className="w-3 h-3" />Affiliate
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{app.email} · Applied {new Date(app.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground flex-shrink-0 cursor-pointer">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-border p-4 bg-background/30 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />Promotion Plan
            </p>
            <p className="text-sm text-foreground leading-relaxed bg-background border border-border rounded-lg p-3">{app.promoteDescription}</p>
          </div>

          {app.adminNote && (
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
              <p className="text-xs font-medium text-red-400 mb-1">Previous Admin Note:</p>
              <p className="text-sm text-muted-foreground">{app.adminNote}</p>
            </div>
          )}

          {app.status === "pending" && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Admin Note <span className="text-red-400">* required if rejecting</span>
                </Label>
                <Textarea
                  placeholder="Add a note (required for rejection, optional for approval)..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  className="bg-background border-border resize-none text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={approve}
                  disabled={loading !== null}
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 text-white gap-1.5"
                >
                  {loading === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Approve
                </Button>
                <Button
                  onClick={reject}
                  disabled={loading !== null}
                  size="sm"
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
                >
                  {loading === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Reject
                </Button>
              </div>
            </div>
          )}

          {app.status !== "pending" && app.reviewedAt && (
            <p className="text-xs text-muted-foreground">
              Reviewed {new Date(app.reviewedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAffiliateApplicationsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/affiliate/admin/applications");
      if (!res.ok) throw new Error("Failed");
      setApps(await res.json());
    } catch { toast({ title: "Failed to load applications", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = apps.filter(a => {
    const matchFilter = filter === "all" || a.status === filter;
    const matchSearch = !search || a.fullName.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    all: apps.length,
    pending: apps.filter(a => a.status === "pending").length,
    approved: apps.filter(a => a.status === "approved").length,
    rejected: apps.filter(a => a.status === "rejected").length,
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />Affiliate Applications
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage affiliate partner applications.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { key: "all", label: "Total", color: "text-foreground" },
          { key: "pending", label: "Pending", color: "text-amber-400" },
          { key: "approved", label: "Approved", color: "text-green-400" },
          { key: "rejected", label: "Rejected", color: "text-red-400" },
        ].map(s => (
          <div key={s.key} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{counts[s.key as keyof typeof counts]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-8 bg-card border-border h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                filter === f ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground mb-1">No applications found</p>
          <p className="text-sm text-muted-foreground">
            {search || filter !== "all" ? "Try changing the filters." : "No one has applied to the affiliate program yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => <AppCard key={app.id} app={app} onAction={load} />)}
        </div>
      )}
    </div>
  );
}
