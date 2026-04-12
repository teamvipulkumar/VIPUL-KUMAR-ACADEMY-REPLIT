import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  BadgeIndianRupee, Users, MousePointerClick, Copy, Check, TrendingUp,
  Clock, CheckCircle2, XCircle, AlertCircle, Link2, Image, FileText,
  ShieldCheck, Wallet, Zap, Building2, RefreshCw, Download, Plus,
  Trash2, Eye, EyeOff, Send, ChevronRight, Activity, Target,
  Calendar, Star, Lock, Loader2, Menu, X, ExternalLink, Share2,
  ArrowUpRight, TrendingDown, Banknote, Info
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...opts });
  return res;
}

type Tab = "earnings" | "sales" | "links" | "clicks" | "creatives" | "kyc" | "payouts" | "pixel" | "bank";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "earnings",   label: "Dashboard",      icon: <BadgeIndianRupee className="w-4 h-4" /> },
  { id: "sales",      label: "Sales",          icon: <FileText className="w-4 h-4" /> },
  { id: "links",      label: "Affiliate Links", icon: <Link2 className="w-4 h-4" /> },
  { id: "clicks",     label: "Clicks",         icon: <MousePointerClick className="w-4 h-4" /> },
  { id: "creatives",  label: "Creatives",      icon: <Image className="w-4 h-4" /> },
  { id: "kyc",        label: "KYC",            icon: <ShieldCheck className="w-4 h-4" /> },
  { id: "payouts",    label: "Payouts",        icon: <Wallet className="w-4 h-4" /> },
  { id: "pixel",      label: "Pixel",          icon: <Zap className="w-4 h-4" /> },
  { id: "bank",       label: "Bank",           icon: <Building2 className="w-4 h-4" /> },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  "text-amber-400 border-amber-400/30 bg-amber-400/10",
    approved: "text-green-400 border-green-400/30 bg-green-400/10",
    rejected: "text-red-400 border-red-400/30 bg-red-400/10",
  };
  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-3 h-3" />,
    approved: <CheckCircle2 className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
  };
  return (
    <Badge className={`text-xs gap-1 capitalize ${map[status] ?? ""}`}>
      {icons[status]}{status}
    </Badge>
  );
}

/* ─── Apply Form ─── */
function ApplyForm({ user, onSubmitted }: { user: any; onSubmitted: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ fullName: user?.name ?? "", email: user?.email ?? "", promoteDescription: "" });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!agreed) { toast({ title: "Please agree to the terms", variant: "destructive" }); return; }
    if (!form.promoteDescription.trim()) { toast({ title: "Please describe how you'll promote", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await apiFetch("/api/affiliate/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast({ title: "Application submitted!", description: "We'll review your application soon." });
      onSubmitted();
    } catch (e: any) {
      toast({ title: "Failed to submit", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">Become an Affiliate</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Earn commissions by promoting our courses. Fill in your details and our team will review your application.
          </p>
        </div>

        {/* Perks */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: <BadgeIndianRupee className="w-4 h-4 text-green-400" />, label: "Up to 30%", sub: "Commission" },
            { icon: <Activity className="w-4 h-4 text-blue-400" />, label: "Real-time", sub: "Analytics" },
            { icon: <Wallet className="w-4 h-4 text-amber-400" />, label: "Fast", sub: "Payouts" },
          ].map(p => (
            <div key={p.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="flex justify-center mb-1">{p.icon}</div>
              <p className="text-sm font-bold text-foreground">{p.label}</p>
              <p className="text-[10px] text-muted-foreground">{p.sub}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={form.email} readOnly className="bg-background border-border opacity-70" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">How will you promote our courses?</Label>
            <Textarea
              placeholder="Describe your audience, channels (YouTube, blog, Instagram, etc.), and how you plan to promote..."
              value={form.promoteDescription}
              onChange={e => setForm(f => ({ ...f, promoteDescription: e.target.value }))}
              rows={4}
              className="bg-background border-border resize-none"
            />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 accent-primary w-4 h-4"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I agree to the <span className="text-primary underline cursor-pointer">Affiliate Terms & Conditions</span>, including promoting ethically and not engaging in fraudulent activity.
            </span>
          </label>
          <Button onClick={handleSubmit} disabled={loading} className="w-full bg-primary hover:bg-primary/90 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? "Submitting…" : "Submit Application"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Status Views ─── */
function PendingView() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Application Under Review</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Your affiliate application has been submitted and is being reviewed by our team. We'll notify you via email once a decision is made.
        </p>
        <Badge className="text-sm gap-1 text-amber-400 border-amber-400/30 bg-amber-400/10 px-3 py-1">
          <Clock className="w-3.5 h-3.5" />Pending Review
        </Badge>
      </div>
    </div>
  );
}

function RejectedView({ note }: { note?: string | null }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Application Rejected</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Unfortunately your application was not approved at this time.
        </p>
        {note && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-left mb-4">
            <p className="text-xs font-semibold text-red-400 mb-1">Reason from admin:</p>
            <p className="text-sm text-muted-foreground">{note}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Contact support if you believe this is a mistake.</p>
      </div>
    </div>
  );
}

/* ─── Reusable page section header ─── */
function TabHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ─── Stat card ─── */
function StatCard2({ label, value, color, sub }: { icon?: React.ReactNode; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center text-center gap-1">
      <p className="text-muted-foreground text-[14px] font-bold">{label}</p>
      <p className="text-[#05df72] text-[24px] font-bold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
    </div>
  );
}

/* ─── Full Dashboard ─── */
function AffiliateDashboard({ user }: { user: any }) {
  const [tab, setTab] = useState<Tab>("earnings");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [clicks, setClicks] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [kyc, setKyc] = useState<any>(null);
  const [bank, setBank] = useState<any>(null);
  const [pixel, setPixel] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [chartDays, setChartDays] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const { toast } = useToast();

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setRefreshing(true);
    const [d, c, s, p, cr, k, b, px] = await Promise.all([
      apiFetch("/api/affiliate/dashboard").then(r => r.json()),
      apiFetch("/api/affiliate/clicks").then(r => r.json()),
      apiFetch("/api/affiliate/sales").then(r => r.json()),
      apiFetch("/api/affiliate/payouts").then(r => r.json()),
      apiFetch("/api/affiliate/creatives").then(r => r.json()),
      apiFetch("/api/affiliate/kyc").then(r => r.ok ? r.json() : null),
      apiFetch("/api/affiliate/bank").then(r => r.ok ? r.json() : null),
      apiFetch("/api/affiliate/pixel").then(r => r.ok ? r.json() : null),
    ]);
    setDashboard(d); setClicks(c); setSales(Array.isArray(s) ? s : []);
    setPayouts(Array.isArray(p) ? p : []);
    setCreatives(Array.isArray(cr) ? cr : []); setKyc(k); setBank(b); setPixel(px);
    setLoading(false);
    setRefreshing(false);
  };

  const copyLink = () => {
    if (dashboard?.referralLink) {
      navigator.clipboard.writeText(dashboard.referralLink);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  const navClick = (id: Tab) => { setTab(id); setSidebarOpen(false); };

  const SidebarContent = () => (
    <>
      <div className="px-5 py-5 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-xs font-extrabold text-primary uppercase tracking-widest">VK ACADEMY</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Affiliate Panel</p>
        </div>
        <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => navClick(t.id)}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all text-left ${
              tab === t.id
                ? "bg-primary/10 text-primary border-r-2 border-r-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-border space-y-2">
        <div className="flex items-center gap-2 px-1 mb-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Link href="/">
          <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full px-1 py-1">
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />Back to Site
          </button>
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed top-16 inset-x-0 bottom-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {/* Sidebar — fixed on desktop, slide-over on mobile */}
      <aside className={`
        fixed lg:sticky top-16 h-[calc(100vh-4rem)] z-50 lg:z-auto
        w-56 flex-shrink-0 bg-card border-r border-border flex flex-col overflow-hidden
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <SidebarContent />
      </aside>
      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-4 sm:px-6 py-6">
          {/* Mobile: inline breadcrumb row (no second header) */}
          <div className="lg:hidden flex items-center gap-2 mb-5">
            <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0">
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground">Affiliate</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-medium text-foreground capitalize">{TABS.find(t => t.id === tab)?.label}</span>
          </div>

          {/* ── Earnings Tab ── */}
          {tab === "earnings" && loading && (
            <div className="space-y-6 animate-pulse">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="h-7 w-48 bg-white/[0.06] rounded-lg" />
                  <div className="h-4 w-64 bg-white/[0.04] rounded-lg" />
                </div>
                <div className="h-8 w-24 bg-white/[0.06] rounded-lg flex-shrink-0" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-3.5 w-16 bg-white/[0.06] rounded" />
                      <div className="h-8 w-8 bg-white/[0.06] rounded-xl" />
                    </div>
                    <div className="h-7 w-24 bg-white/[0.06] rounded-lg" />
                  </div>
                ))}
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-28 bg-white/[0.06] rounded" />
                  <div className="h-7 w-20 bg-white/[0.06] rounded-lg" />
                </div>
                <div className="h-[200px] bg-white/[0.03] rounded-xl" />
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-border">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="text-center px-3 py-5 space-y-2 flex flex-col items-center">
                      <div className="h-5 w-20 bg-white/[0.06] rounded" />
                      <div className="h-3 w-16 bg-white/[0.04] rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "earnings" && !loading && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-foreground">Hello, {user?.name?.split(" ")[0] ?? "there"} 👋</h2>
                  <p className="text-sm text-muted-foreground mt-1">Welcome back to your affiliate dashboard.</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0" onClick={loadDashboard} disabled={refreshing}>
                  <RefreshCw className={`w-3.5 h-3.5 transition-transform ${refreshing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
                </Button>
              </div>

              {/* Overview stats */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                {[
                  { label: "Today", value: `₹${(dashboard?.todayEarnings ?? 0).toLocaleString("en-IN")}`, icon: <BadgeIndianRupee className="w-4 h-4 text-green-400" />, color: "text-green-400" },
                  { label: "Yesterday", value: `₹${(dashboard?.yesterdayEarnings ?? 0).toLocaleString("en-IN")}`, icon: <Calendar className="w-4 h-4 text-blue-400" />, color: "text-blue-400" },
                  { label: "Last 7 Days", value: `₹${(dashboard?.last7Earnings ?? 0).toLocaleString("en-IN")}`, icon: <TrendingUp className="w-4 h-4 text-purple-400" />, color: "text-purple-400" },
                  { label: "Last 30 Days", value: `₹${(dashboard?.last30Earnings ?? 0).toLocaleString("en-IN")}`, icon: <Activity className="w-4 h-4 text-amber-400" />, color: "text-amber-400" },
                ].map(s => <StatCard2 key={s.label} {...s} />)}
              </div>

              {/* Daily chart */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Daily Earnings</h3>
                  <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5">
                    {([7, 30] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setChartDays(d)}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                          chartDays === d
                            ? "bg-primary text-white"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={chartDays === 30 && isDesktop ? 240 : 200}>
                  <BarChart
                    data={(dashboard?.dailyChart ?? []).slice(-chartDays)}
                    margin={{ top: 5, right: 5, bottom: chartDays === 30 && isDesktop ? 40 : 5, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#6b7280" }}
                      tickFormatter={v => `${v.substring(8)}-${v.substring(5, 7)}`}
                      interval={chartDays === 7 ? 0 : isDesktop ? 0 : 3}
                      angle={chartDays === 30 && isDesktop ? -45 : 0}
                      textAnchor={chartDays === 30 && isDesktop ? "end" : "middle"}
                      height={chartDays === 30 && isDesktop ? 50 : 30}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={v => `₹${v}`} width={50} />
                    <Tooltip
                      contentStyle={{ background: "#0d1424", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => [`₹${Number(v).toFixed(2)}`, "Earnings"]}
                      labelFormatter={(v: string) => `${v.substring(8)}-${v.substring(5, 7)}-${v.substring(0, 4)}`}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    />
                    <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} name="Earnings" maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary strip */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-border">
                  {[
                    { label: "Total Earned", value: `₹${(dashboard?.totalEarnings ?? 0).toLocaleString("en-IN")}`, color: "text-foreground", icon: <Banknote className="w-3.5 h-3.5" /> },
                    { label: "Pending Payout", value: `₹${(dashboard?.pendingEarnings ?? 0).toLocaleString("en-IN")}`, color: "text-amber-400", icon: <Clock className="w-3.5 h-3.5" /> },
                    { label: "Total Paid", value: `₹${(dashboard?.paidEarnings ?? 0).toLocaleString("en-IN")}`, color: "text-green-400", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                  ].map(s => (
                    <div key={s.label} className="text-center px-3 py-4">
                      <div className={`flex items-center justify-center gap-1 ${s.color} mb-1`}>{s.icon}</div>
                      <p className={`text-base sm:text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Sales Tab ── */}
          {tab === "sales" && (
            <div className="space-y-5">
              <TabHeader title="My Sales" subtitle="All successful purchases made through your referral link." />

              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-foreground">{sales.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Sales</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 cursor-default">
                  <p className="text-xl font-bold text-blue-400">₹{sales.reduce((s, r) => s + (r.saleAmount ?? 0), 0).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Revenue</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-green-400">₹{sales.reduce((s, r) => s + r.commission, 0).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Commission</p>
                </div>
              </div>

              {/* Sales table */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {sales.length === 0 ? (
                  <div className="py-20 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-semibold text-foreground mb-1">No sales yet</p>
                    <p className="text-sm text-muted-foreground">Share your affiliate link to start earning commissions.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-background/50">
                          <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">#</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Course</th>
                          <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Sale Amount</th>
                          <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Commission</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Date & Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sales.map((sale, i) => {
                          const dt = new Date(sale.createdAt);
                          return (
                            <tr key={sale.id}>
                              <td className="px-5 py-3.5 text-xs text-muted-foreground">{i + 1}</td>
                              <td className="px-5 py-3.5">
                                <span className="font-medium text-foreground text-sm">{sale.courseTitle}</span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                {sale.saleAmount != null
                                  ? <span className="font-semibold text-foreground">₹{Number(sale.saleAmount).toLocaleString("en-IN")}</span>
                                  : <span className="text-muted-foreground text-xs">—</span>
                                }
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <span className="font-bold text-green-400">₹{sale.commission.toLocaleString("en-IN")}</span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div>
                                  <p className="text-sm text-foreground">{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                                  <p className="text-[11px] text-muted-foreground">{dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</p>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Links Tab ── */}
          {tab === "links" && (
            <div className="space-y-4 max-w-2xl">
              <TabHeader title="My Affiliate Links" subtitle="Share your unique link to earn commissions on every sale." />

              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Your affiliate ID</Label>
                  <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <p className="font-mono font-extrabold text-primary text-2xl tracking-widest flex-1">{dashboard?.referralCode ?? "–"}</p>
                    <Badge className="text-[10px] text-green-400 border-green-400/30 bg-green-400/10 gap-1"><CheckCircle2 className="w-3 h-3" />Active</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Affiliate link</Label>
                  <div className="flex gap-2">
                    <Input value={dashboard?.referralLink ?? ""} readOnly className="bg-background font-mono text-xs min-w-0" />
                    <Button variant="outline" onClick={copyLink} className={`gap-1.5 flex-shrink-0 ${copied ? "border-green-500/30 text-green-400" : ""}`}>
                      {copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                    </Button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
                  <p className="text-xs text-blue-400 flex items-center gap-1.5"><Info className="w-3 h-3 flex-shrink-0" />You earn <span className="font-bold">{dashboard?.commissionRate ?? "–"}%</span> commission on every successful purchase through your link.</p>
                </div>
              </div>

              <CustomLinkGenerator referralCode={dashboard?.referralCode ?? ""} />
            </div>
          )}

          {/* ── Clicks Tab ── */}
          {tab === "clicks" && (
            <div className="space-y-6">
              <TabHeader title="Click Analytics" subtitle="Track traffic and conversions from your referral links." />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard2 icon={<MousePointerClick className="w-4 h-4 text-blue-400" />} label="Total Clicks" value={clicks?.total ?? 0} color="text-blue-400" />
                <StatCard2 icon={<Users className="w-4 h-4 text-purple-400" />} label="Unique Visitors" value={clicks?.unique ?? 0} color="text-purple-400" />
                <StatCard2 icon={<CheckCircle2 className="w-4 h-4 text-green-400" />} label="Conversions" value={clicks?.conversions ?? 0} color="text-green-400"
                  sub={clicks?.total > 0 ? `${((clicks.conversions / clicks.total) * 100).toFixed(1)}% conversion rate` : undefined} />
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Daily Analytics — Last 30 Days</h3>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Clicks</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />Unique</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Conv.</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={clicks?.dailyChart ?? []} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={v => v.substring(5)} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <Tooltip contentStyle={{ background: "#0d1424", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="clicks" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Clicks" />
                    <Bar dataKey="unique" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Unique" />
                    <Bar dataKey="conversions" fill="#22c55e" radius={[3, 3, 0, 0]} name="Conv." />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Creatives Tab ── */}
          {tab === "creatives" && (
            <div>
              <TabHeader title="Marketing Creatives" subtitle="Download banners, copy, and assets to promote your affiliate link." />
              <CreativesTab creatives={creatives} />
            </div>
          )}

          {/* ── KYC Tab ── */}
          {tab === "kyc" && (
            <div>
              <TabHeader title="KYC Verification" subtitle="Submit identity documents to enable payouts." />
              <KycTab kyc={kyc} onSaved={k => setKyc(k)} />
            </div>
          )}

          {/* ── Payouts Tab ── */}
          {tab === "payouts" && (
            <div>
              <TabHeader title="Payouts" subtitle="Request withdrawals and view your payout history." />
              <PayoutsTab dashboard={dashboard} payouts={payouts} onRequested={loadDashboard} />
            </div>
          )}

          {/* ── Pixel Tab ── */}
          {tab === "pixel" && (
            <div>
              <TabHeader title="Tracking Pixel" subtitle="Connect your Facebook Pixel to track conversions from your referrals." />
              <PixelTab pixel={pixel} onSaved={p => setPixel(p)} />
            </div>
          )}

          {/* ── Bank Tab ── */}
          {tab === "bank" && (
            <div>
              <TabHeader title="Bank Account" subtitle="Add your bank details to receive payout transfers." />
              <BankTab bank={bank} onSaved={b => setBank(b)} />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

/* ─── Custom Link Generator ─── */
function CustomLinkGenerator({ referralCode }: { referralCode: string }) {
  const [inputUrl, setInputUrl] = useState("");
  const [copiedGenerated, setCopiedGenerated] = useState(false);
  const siteOrigin = window.location.origin;

  const isValidSiteUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.origin === siteOrigin;
    } catch {
      return false;
    }
  };

  const buildAffiliateUrl = (url: string) => {
    if (!url.trim() || !referralCode) return "";
    try {
      const parsed = new URL(url.trim());
      parsed.searchParams.set("ref", referralCode);
      return parsed.toString();
    } catch {
      return "";
    }
  };

  const generatedUrl = buildAffiliateUrl(inputUrl);
  const isValid = inputUrl.trim() === "" || isValidSiteUrl(inputUrl.trim());

  const copyGenerated = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopiedGenerated(true);
    setTimeout(() => setCopiedGenerated(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-0.5">Custom Affiliate Link Generator</h3>
        <p className="text-xs text-muted-foreground">Paste any page URL from this site — get your personalised affiliate link instantly.</p>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Paste a site URL</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              placeholder={`${siteOrigin}/courses/1`}
              className={`bg-background border-border pl-9 font-mono text-xs ${!isValid ? "border-red-500/50 focus-visible:ring-red-500/30" : ""}`}
            />
          </div>
        </div>
        {!isValid && (
          <p className="text-[11px] text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />URL must be from this site ({siteOrigin})
          </p>
        )}
      </div>

      {/* Generated link output */}
      {generatedUrl && isValid && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Your affiliate link</Label>
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl p-3">
            <ExternalLink className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-xs font-mono text-primary flex-1 truncate">{generatedUrl}</span>
            <button
              onClick={copyGenerated}
              className={`flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                copiedGenerated
                  ? "bg-green-500/15 text-green-400 border border-green-500/20"
                  : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
              }`}
            >
              {copiedGenerated ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

/* ─── Creatives Tab ─── */
function CreativesTab({ creatives }: { creatives: any[] }) {
  const [copied, setCopied] = useState<number | null>(null);
  const copy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };
  if (creatives.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl py-20 text-center">
        <Image className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold text-foreground mb-1">No creatives yet</p>
        <p className="text-sm text-muted-foreground">The admin hasn't uploaded any promotional materials yet.</p>
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {creatives.map(c => (
        <div key={c.id} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="text-[10px] capitalize border-border text-muted-foreground">{c.type}</Badge>
            <h4 className="font-medium text-sm text-foreground truncate flex-1">{c.title}</h4>
          </div>
          {c.url && (
            <img src={c.url} alt={c.title} className="w-full h-28 object-contain rounded-lg bg-background border border-border mb-3" />
          )}
          {c.content && (
            <p className="text-xs text-muted-foreground bg-background border border-border rounded-lg p-2.5 mb-3 line-clamp-3">{c.content}</p>
          )}
          {c.description && <p className="text-xs text-muted-foreground mb-3">{c.description}</p>}
          <div className="flex gap-2">
            {c.url && (
              <a href={c.url} download className="flex-1">
                <Button variant="outline" size="sm" className="w-full gap-1.5 border-border text-xs">
                  <Download className="w-3 h-3" />Download
                </Button>
              </a>
            )}
            {c.content && (
              <Button variant="outline" size="sm" className="flex-1 gap-1.5 border-border text-xs" onClick={() => copy(c.content, c.id)}>
                {copied === c.id ? <><Check className="w-3 h-3 text-green-400" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── KYC Tab ─── */
function KycTab({ kyc, onSaved }: { kyc: any; onSaved: (k: any) => void }) {
  const { toast } = useToast();
  const [idName, setIdName] = useState(kyc?.idProofName ?? "");
  const [addrName, setAddrName] = useState(kyc?.addressProofName ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!idName || !addrName) { toast({ title: "Both fields required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/api/affiliate/kyc", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idProofName: idName, addressProofName: addrName }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      onSaved(data);
      toast({ title: "KYC submitted!", description: "Under review by admin." });
    } catch { toast({ title: "Failed to submit KYC", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">KYC Verification</h3>
          {kyc && <StatusBadge status={kyc.status} />}
        </div>
        {kyc?.adminNote && (
          <div className="mb-4 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
            <p className="text-xs font-medium text-red-400 mb-1">Admin Note:</p>
            <p className="text-sm text-muted-foreground">{kyc.adminNote}</p>
          </div>
        )}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ID Proof (Aadhar / PAN / Passport)</Label>
            <Input value={idName} onChange={e => setIdName(e.target.value)} placeholder="e.g. Aadhar Card - XXXX XXXX XXXX 1234" className="bg-background border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Address Proof</Label>
            <Input value={addrName} onChange={e => setAddrName(e.target.value)} placeholder="e.g. Electricity bill - Jan 2025" className="bg-background border-border" />
          </div>
          <div className="p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg">
            <p className="text-xs text-amber-300 flex items-center gap-1.5"><Lock className="w-3 h-3" />Your documents are stored securely and only visible to admins.</p>
          </div>
          <Button onClick={save} disabled={saving} className="w-full bg-primary gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {saving ? "Submitting…" : kyc ? "Resubmit KYC" : "Submit KYC"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Payouts Tab ─── */
function PayoutsTab({ dashboard, payouts, onRequested }: { dashboard: any; payouts: any[]; onRequested: () => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const request = async () => {
    if (!amount || !details) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    if (parseFloat(amount) > (dashboard?.pendingEarnings ?? 0)) {
      toast({ title: "Amount exceeds withdrawable balance", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/affiliate/payout-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(amount), paymentMethod: method, paymentDetails: details }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Payout requested!", description: "Admin will process it soon." });
      setAmount(""); setDetails("");
      onRequested();
    } catch { toast({ title: "Failed to request payout", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const statusMap: Record<string, string> = {
    pending: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    approved: "text-green-400 border-green-400/30 bg-green-400/10",
    rejected: "text-red-400 border-red-400/30 bg-red-400/10",
  };

  return (
    <div className="space-y-5">
      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Earned", value: dashboard?.totalEarnings ?? 0, color: "text-foreground" },
          { label: "Withdrawable", value: dashboard?.pendingEarnings ?? 0, color: "text-amber-400" },
          { label: "Paid Out", value: dashboard?.paidEarnings ?? 0, color: "text-green-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={`text-xl font-bold ${s.color}`}>₹{Number(s.value).toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Request form */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Request Withdrawal</h3>
          <Input type="number" placeholder={`Amount (max ₹${(dashboard?.pendingEarnings ?? 0).toLocaleString("en-IN")})`}
            value={amount} onChange={e => setAmount(e.target.value)} className="bg-background border-border" />
          <Input placeholder="Payment method (Bank, UPI, etc.)" value={method}
            onChange={e => setMethod(e.target.value)} className="bg-background border-border" />
          <Input placeholder="Account / UPI details" value={details}
            onChange={e => setDetails(e.target.value)} className="bg-background border-border" />
          <Button onClick={request} disabled={saving} className="w-full bg-primary gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {saving ? "Processing…" : "Request Payout"}
          </Button>
        </div>

        {/* Payout history */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Payout History</h3>
          </div>
          {payouts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No payouts yet.</div>
          ) : (
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
              {payouts.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                    <p className="text-[11px] text-muted-foreground">{p.paymentMethod} · {new Date(p.requestedAt).toLocaleDateString("en-IN")}</p>
                  </div>
                  <Badge className={`text-[10px] capitalize ${statusMap[p.status] ?? ""}`}>{p.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Pixel Tab ─── */
function PixelTab({ pixel, onSaved }: { pixel: any; onSaved: (p: any) => void }) {
  const { toast } = useToast();
  const [pixelId, setPixelId] = useState(pixel?.facebookPixelId ?? "");
  const [trackPV, setTrackPV] = useState(pixel?.trackPageView ?? true);
  const [trackP, setTrackP] = useState(pixel?.trackPurchase ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/affiliate/pixel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facebookPixelId: pixelId || null, trackPageView: trackPV, trackPurchase: trackP }),
      });
      if (!res.ok) throw new Error("Failed");
      onSaved(await res.json());
      toast({ title: "Pixel settings saved!" });
    } catch { toast({ title: "Failed to save pixel", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Facebook Pixel Setup</h3>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Facebook Pixel ID</Label>
          <Input value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder="e.g. 123456789012345" className="bg-background border-border font-mono" />
          <p className="text-[11px] text-muted-foreground">Find your Pixel ID in Facebook Events Manager.</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Track Events</Label>
          {[
            { label: "Page View", checked: trackPV, onChange: setTrackPV },
            { label: "Purchase", checked: trackP, onChange: setTrackP },
          ].map(e => (
            <label key={e.label} className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={e.checked} onChange={ev => e.onChange(ev.target.checked)} className="accent-primary w-4 h-4" />
              <span className="text-sm text-foreground">{e.label}</span>
            </label>
          ))}
        </div>
        <Button onClick={save} disabled={saving} className="w-full bg-primary gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Pixel Settings"}
        </Button>
      </div>

      {pixelId && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-2">Preview Code Snippet</p>
          <pre className="text-[10px] text-muted-foreground bg-background rounded-lg p-3 overflow-x-auto border border-border whitespace-pre-wrap">{`<!-- Facebook Pixel -->
<script>
!function(f,b,e,v,n,t,s){...}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
${trackPV ? "fbq('track', 'PageView');" : ""}
${trackP ? "fbq('track', 'Purchase', {value: amount, currency: 'INR'});" : ""}
</script>`}</pre>
        </div>
      )}
    </div>
  );
}

/* ─── Bank Tab ─── */
function BankTab({ bank, onSaved }: { bank: any; onSaved: (b: any) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    accountHolderName: bank?.accountHolderName ?? "",
    accountNumber: bank?.accountNumber ?? "",
    ifscCode: bank?.ifscCode ?? "",
    bankName: bank?.bankName ?? "",
  });
  const [showAcc, setShowAcc] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.accountHolderName || !form.accountNumber || !form.ifscCode || !form.bankName) {
      toast({ title: "All fields are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/affiliate/bank", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      onSaved(await res.json());
      toast({ title: "Bank details saved!" });
    } catch { toast({ title: "Failed to save bank details", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Bank Account Details</h3>
          {bank && <Badge className="text-[10px] text-green-400 border-green-400/30 bg-green-400/10 gap-1"><CheckCircle2 className="w-3 h-3" />Saved</Badge>}
        </div>

        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-primary" />Bank details are encrypted and only used for processing payouts.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Account Holder Name</Label>
            <Input value={form.accountHolderName} onChange={e => setForm(f => ({ ...f, accountHolderName: e.target.value }))}
              placeholder="As per bank records" className="bg-background border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Account Number</Label>
            <div className="relative">
              <Input type={showAcc ? "text" : "password"} value={form.accountNumber}
                onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                placeholder="Enter account number" className="bg-background border-border pr-9 font-mono" />
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowAcc(v => !v)}>
                {showAcc ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">IFSC Code</Label>
              <Input value={form.ifscCode} onChange={e => setForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                placeholder="e.g. HDFC0001234" className="bg-background border-border font-mono uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bank Name</Label>
              <Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                placeholder="e.g. HDFC Bank" className="bg-background border-border" />
            </div>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full bg-primary gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
          {saving ? "Saving…" : bank ? "Update Bank Details" : "Save Bank Details"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function AffiliatePage() {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<"loading" | "no-app" | "pending" | "rejected" | "approved">("loading");
  const [appNote, setAppNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    if ((user as any)?.role === "affiliate" || (user as any)?.role === "admin") {
      setStatus("approved"); return;
    }
    apiFetch("/api/affiliate/application")
      .then(async r => {
        if (r.status === 404) { setStatus("no-app"); return; }
        const app = await r.json();
        if (app.status === "approved") { setStatus("approved"); }
        else if (app.status === "rejected") { setStatus("rejected"); setAppNote(app.adminNote ?? null); }
        else { setStatus("pending"); }
      })
      .catch(() => setStatus("no-app"));
  }, [isAuthenticated, user]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "no-app") return <ApplyForm user={user} onSubmitted={() => setStatus("pending")} />;
  if (status === "pending") return <PendingView />;
  if (status === "rejected") return <RejectedView note={appNote} />;
  return <AffiliateDashboard user={user} />;
}
