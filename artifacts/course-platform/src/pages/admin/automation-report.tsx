import { useState, useEffect, useCallback, Fragment } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { ChevronLeft, BarChart2, Mail, Activity, Loader2, Search, RefreshCw, Trash2, ChevronRight, ChevronDown, Eye, X, Info, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Line, ComposedChart } from "recharts";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API_BASE}${path}`, { credentials: "include", ...opts });
}

type Tab = "chart" | "step" | "emails";

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    running: { color: "text-blue-400", bg: "bg-blue-500/10", label: "running" },
    completed: { color: "text-green-400", bg: "bg-green-500/10", label: "completed" },
    failed: { color: "text-red-400", bg: "bg-red-500/10", label: "failed" },
    pending: { color: "text-amber-400", bg: "bg-amber-500/10", label: "pending" },
    skipped: { color: "text-muted-foreground", bg: "bg-muted/40", label: "skipped" },
  };
  const m = map[status] ?? { color: "text-muted-foreground", bg: "bg-muted/40", label: status };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md ${m.bg} ${m.color} font-medium`}>
      {m.label}
    </span>
  );
}

export default function AutomationReportPage() {
  const [, params] = useRoute("/admin/crm/automation/:id/report");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const funnelId = params?.id ? parseInt(params.id) : null;

  const [tab, setTab] = useState<Tab>("chart");
  const [stepReport, setStepReport] = useState<any | null>(null);
  const [emailReport, setEmailReport] = useState<any | null>(null);
  const [emailPreview, setEmailPreview] = useState<string | null>(null);

  // Individual Reporting table state
  const [executions, setExecutions] = useState<any[]>([]);
  const [executionsTotal, setExecutionsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "completed" | "failed">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [stepDetails, setStepDetails] = useState<Map<number, any[]>>(new Map());

  const [reportLoading, setReportLoading] = useState(false);

  const loadReports = useCallback(async () => {
    if (!funnelId) return;
    setReportLoading(true);
    try {
      const [stepRes, emailRes] = await Promise.all([
        apiFetch(`/api/admin/crm/funnels/${funnelId}/step-report`).then(r => r.json()),
        apiFetch(`/api/admin/crm/funnels/${funnelId}/report`).then(r => r.json()),
      ]);
      setStepReport(stepRes);
      setEmailReport(emailRes);
    } catch {
      toast({ title: "Failed to load report", variant: "destructive" });
    }
    setReportLoading(false);
  }, [funnelId, toast]);

  const loadExecutions = useCallback(async () => {
    if (!funnelId) return;
    setExecutionsLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: statusFilter,
        search,
      });
      const res = await apiFetch(`/api/admin/crm/funnels/${funnelId}/executions?${qs}`).then(r => r.json());
      setExecutions(res.rows ?? []);
      setExecutionsTotal(res.total ?? 0);
    } catch {
      toast({ title: "Failed to load executions", variant: "destructive" });
    }
    setExecutionsLoading(false);
  }, [funnelId, page, limit, statusFilter, search, toast]);

  useEffect(() => { loadReports(); }, [loadReports]);
  useEffect(() => { loadExecutions(); }, [loadExecutions]);

  const toggleExpand = async (executionId: number) => {
    const next = new Set(expanded);
    if (next.has(executionId)) {
      next.delete(executionId);
      setExpanded(next);
      return;
    }
    next.add(executionId);
    setExpanded(next);
    if (!stepDetails.has(executionId)) {
      try {
        const res = await apiFetch(`/api/admin/crm/funnels/${funnelId}/executions/${executionId}`).then(r => r.json());
        const newMap = new Map(stepDetails);
        newMap.set(executionId, res.steps ?? []);
        setStepDetails(newMap);
      } catch {
        toast({ title: "Failed to load steps", variant: "destructive" });
      }
    }
  };

  const deleteExecution = async (executionId: number) => {
    if (!confirm("Delete this execution record? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/admin/crm/funnels/${funnelId}/executions/${executionId}`, { method: "DELETE" });
      toast({ title: "Execution deleted" });
      loadExecutions();
      loadReports();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  if (!funnelId) {
    return <div className="p-8 text-muted-foreground">Invalid funnel id</div>;
  }

  const funnel = stepReport?.funnel ?? emailReport?.funnel;
  const totalPages = Math.max(1, Math.ceil(executionsTotal / limit));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href="/admin/crm" className="hover:text-foreground cursor-pointer flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />Automation Funnels
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium truncate max-w-[260px]">
            {funnel?.name ?? "Loading..."}
          </span>
          <ChevronRight className="w-3 h-3" />
          <span>Subscribers</span>
        </div>
        <button
          onClick={() => { loadReports(); loadExecutions(); }}
          disabled={reportLoading || executionsLoading}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 cursor-pointer disabled:opacity-50"
        >
          {reportLoading || executionsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-center border-b border-border">
        <div className="flex items-center gap-1">
          {[
            { id: "chart" as Tab, label: "Chart Report", icon: BarChart2 },
            { id: "step" as Tab, label: "Step Report", icon: Activity },
            { id: "emails" as Tab, label: "Emails Analytics", icon: Mail },
          ].map(t => {
            const I = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <I className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {tab === "chart" && <ChartReportPanel report={stepReport} loading={reportLoading} />}
      {tab === "step" && <StepReportPanel report={stepReport} loading={reportLoading} />}
      {tab === "emails" && <EmailsAnalyticsPanel report={emailReport} loading={reportLoading} onPreview={setEmailPreview} />}

      {/* Individual Reporting */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Individual Reporting</h3>
            {executionsTotal > 0 && (
              <span className="text-xs text-muted-foreground">({executionsTotal} total)</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-background cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <form onSubmit={submitSearch} className="flex items-center gap-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search by name or email"
                  className="h-8 pl-7 pr-2 text-xs w-56"
                />
              </div>
            </form>
          </div>
        </div>

        {executionsLoading && executions.length === 0 ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…
          </div>
        ) : executions.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No executions yet. When a contact triggers this automation, they will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left">Contact</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Latest Action</th>
                  <th className="px-3 py-2 text-left">Next Step</th>
                  <th className="px-3 py-2 text-left">Last Executed At</th>
                  <th className="px-3 py-2 text-left">Created At</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {executions.map(row => {
                  const isOpen = expanded.has(row.id);
                  const steps = stepDetails.get(row.id) ?? [];
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-3 align-top">
                          <button onClick={() => toggleExpand(row.id)} className="cursor-pointer text-muted-foreground hover:text-foreground">
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                              {(row.userName ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground truncate max-w-[180px]">{row.userName ?? "Unknown"}</div>
                              <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{row.userEmail ?? ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top"><StatusBadge status={row.status} /></td>
                        <td className="px-3 py-3 align-top text-foreground">
                          {row.latestActionLabel ? (
                            <span className="truncate max-w-[180px] inline-block">{row.latestActionLabel}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {row.nextStepLabel ? (
                            <span className="text-foreground truncate max-w-[180px] inline-block">{row.nextStepLabel}</span>
                          ) : (
                            <span className="inline-flex items-center text-green-400" title="Completed">
                              <CheckCircle2 className="w-4 h-4" />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground text-xs">{timeAgo(row.lastExecutedAt)}</td>
                        <td className="px-3 py-3 align-top text-muted-foreground text-xs">{timeAgo(row.startedAt)}</td>
                        <td className="px-3 py-3 align-top text-right">
                          <button
                            onClick={() => deleteExecution(row.id)}
                            className="inline-flex items-center justify-center p-1.5 rounded-md text-red-400 hover:bg-red-500/10 cursor-pointer"
                            title="Delete execution"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-border bg-muted/10">
                          <td className="px-3 py-3"></td>
                          <td colSpan={7} className="px-3 py-3">
                            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                              <Info className="w-3 h-3" />Step-by-step execution timeline
                            </div>
                            {steps.length === 0 ? (
                              <div className="text-xs text-muted-foreground py-2">Loading steps…</div>
                            ) : (
                              <div className="space-y-1.5">
                                {steps.map((s: any) => (
                                  <div key={s.id} className="flex items-center gap-2 text-xs">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                      s.status === "completed" ? "bg-green-500" :
                                      s.status === "failed" ? "bg-red-500" :
                                      s.status === "skipped" ? "bg-muted-foreground" : "bg-blue-500"
                                    }`} />
                                    <span className="text-foreground font-medium">{s.label}</span>
                                    <StatusBadge status={s.status} />
                                    {s.executedAt && (
                                      <span className="text-muted-foreground">{timeAgo(s.executedAt)}</span>
                                    )}
                                    {s.errorMessage && (
                                      <span className="text-red-400 truncate max-w-[300px]" title={s.errorMessage}>
                                        — {s.errorMessage}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {executionsTotal > 0 && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between flex-wrap gap-3 text-xs text-muted-foreground">
            <div>
              Total {executionsTotal} • Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }}
                className="px-2 py-1 rounded-md border border-border bg-background cursor-pointer"
              >
                <option value={10}>10/page</option>
                <option value={25}>25/page</option>
                <option value={50}>50/page</option>
                <option value={100}>100/page</option>
              </select>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-md border border-border hover:bg-muted/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-md border border-border hover:bg-muted/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email preview overlay */}
      {emailPreview !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Email Preview</h3>
              <button onClick={() => setEmailPreview(null)} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {emailPreview ? (
                <iframe srcDoc={emailPreview} sandbox="" className="w-full min-h-[480px] rounded-lg border border-border bg-white" title="email-preview" />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Email body not available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Chart Report Tab: bar chart per step with completion % ─── */
function ChartReportPanel({ report, loading }: { report: any; loading: boolean }) {
  if (loading && !report) {
    return <div className="py-16 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading chart…</div>;
  }
  const steps: any[] = report?.steps ?? [];
  const totalExecutions = report?.totalExecutions ?? 0;

  if (steps.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No steps configured for this funnel.</div>;
  }

  if (totalExecutions === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground bg-card border border-border rounded-2xl">
        <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
        No contacts have entered this funnel yet.
        <div className="text-xs mt-1">Once contacts trigger this automation, you'll see step-by-step completion rates here.</div>
      </div>
    );
  }

  const data = steps.map(s => ({
    name: `${s.label}\n${s.completionRate}%`,
    label: s.label,
    contacts: s.entered,
    completionRate: s.completionRate,
    completed: s.completed,
  }));

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-center gap-6 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-teal-600" />
          <span className="text-muted-foreground">Contacts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-blue-400" />
          <span className="text-muted-foreground">Completion %</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={70}
          />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(value: any, name: any) => name === "completionRate" ? [`${value}%`, "Completion"] : [value, "Contacts"]}
          />
          <Bar yAxisId="left" dataKey="contacts" fill="hsl(178, 60%, 30%)" radius={[4, 4, 0, 0]} barSize={60}>
            {data.map((_, i) => (
              <Cell key={i} fill="hsl(178, 60%, 30%)" />
            ))}
          </Bar>
          <Line yAxisId="right" type="monotone" dataKey="completionRate" stroke="hsl(210, 90%, 60%)" strokeWidth={2} dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {steps.map(s => (
          <div key={s.stepId} className="text-xs">
            <div className="text-foreground font-medium truncate">{s.label}</div>
            <div className="text-muted-foreground">{s.completionRate}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Step Report Tab: table with per-step counts ─── */
function StepReportPanel({ report, loading }: { report: any; loading: boolean }) {
  if (loading && !report) {
    return <div className="py-16 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…</div>;
  }
  const steps: any[] = report?.steps ?? [];
  if (steps.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No steps configured.</div>;
  }
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-3 border-b border-border text-sm">
        <span className="font-semibold text-foreground">Step-by-step breakdown</span>
        <span className="text-muted-foreground"> · {report?.totalExecutions ?? 0} total executions</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Step</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-right">Entered</th>
              <th className="px-4 py-2 text-right">Completed</th>
              <th className="px-4 py-2 text-right">Failed</th>
              <th className="px-4 py-2 text-right">Pending</th>
              <th className="px-4 py-2 text-right">Completion %</th>
            </tr>
          </thead>
          <tbody>
            {steps.map(s => (
              <tr key={s.stepId} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 text-muted-foreground">{s.stepOrder + 1}</td>
                <td className="px-4 py-3 text-foreground font-medium">{s.label}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{s.actionType}</td>
                <td className="px-4 py-3 text-right text-foreground">{s.entered}</td>
                <td className="px-4 py-3 text-right text-green-400">{s.completed}</td>
                <td className="px-4 py-3 text-right text-red-400">{s.failed}</td>
                <td className="px-4 py-3 text-right text-amber-400">{s.pending}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">{s.completionRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Emails Analytics Tab: email-specific stats ─── */
function EmailsAnalyticsPanel({ report, loading, onPreview }: { report: any; loading: boolean; onPreview: (html: string) => void }) {
  if (loading && !report) {
    return <div className="py-16 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…</div>;
  }
  const stats = report?.stats;
  const daily: any[] = report?.daily ?? [];
  const recent: any[] = report?.recent ?? [];

  if (!stats || stats.total === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl py-12 text-center text-sm text-muted-foreground">
        <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
        No emails sent by this funnel yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Sent" value={stats.total} icon={<Mail className="w-4 h-4 text-blue-400" />} />
        <StatCard label="Delivered" value={stats.sent} icon={<CheckCircle2 className="w-4 h-4 text-green-400" />} color="text-green-400" />
        <StatCard label="Failed" value={stats.failed} icon={<XCircle className="w-4 h-4 text-red-400" />} color="text-red-400" />
        <StatCard label="Success Rate" value={`${stats.successRate}%`} icon={<Activity className="w-4 h-4 text-purple-400" />} color="text-purple-400" />
      </div>

      {/* Time-based stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Today" value={stats.today} icon={<Clock className="w-4 h-4 text-amber-400" />} />
        <StatCard label="Last 7 Days" value={stats.last7} icon={<Clock className="w-4 h-4 text-amber-400" />} />
        <StatCard label="Last 30 Days" value={stats.last30} icon={<Clock className="w-4 h-4 text-amber-400" />} />
        <StatCard label="Unique Recipients" value={stats.uniqueRecipients} icon={<Users className="w-4 h-4 text-pink-400" />} />
      </div>

      {/* Daily chart */}
      {daily.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h4 className="text-sm font-semibold mb-3">Last 7 Days</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="sent" stackId="a" fill="hsl(142, 70%, 45%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="failed" stackId="a" fill="hsl(0, 70%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent activity */}
      {recent.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold">Recent Activity (last 25)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Recipient</th>
                  <th className="px-3 py-2 text-left">Subject</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-right">Preview</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r: any) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="text-foreground font-medium truncate max-w-[160px]">{r.userName ?? "—"}</div>
                      <div className="text-muted-foreground truncate max-w-[160px]">{r.email}</div>
                    </td>
                    <td className="px-3 py-2 text-foreground truncate max-w-[260px]">{r.subject}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status === "sent" ? "completed" : "failed"} /></td>
                    <td className="px-3 py-2 text-muted-foreground">{timeAgo(r.sentAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => onPreview(r.htmlBody ?? "")}
                        className="inline-flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                        title="Preview email"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report?.note && (
        <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 px-1">
          <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />{report.note}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: any; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`text-xl font-bold ${color ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
