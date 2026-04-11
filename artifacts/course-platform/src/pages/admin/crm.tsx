import { useState, useEffect, useCallback } from "react";
import { Mail, Send, FileText, Users, BarChart2, Plus, Trash2, Edit2, Check, X, Info, RefreshCw, Eye, Zap, Server, TestTube, CheckCircle2, AlertCircle, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { EmailBlockBuilder } from "@/components/email-block-builder";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API_BASE}${path}`, { credentials: "include", ...opts });
}

type Tab = "dashboard" | "campaigns" | "automation" | "templates" | "subscribers" | "smtp";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <BarChart2 className="w-4 h-4" /> },
  { id: "campaigns", label: "Campaigns", icon: <Send className="w-4 h-4" /> },
  { id: "automation", label: "Automation", icon: <Zap className="w-4 h-4" /> },
  { id: "templates", label: "Templates", icon: <FileText className="w-4 h-4" /> },
  { id: "subscribers", label: "Subscribers", icon: <Users className="w-4 h-4" /> },
  { id: "smtp", label: "SMTP", icon: <Server className="w-4 h-4" /> },
];

const EVENT_META: Record<string, { label: string; description: string; badge: string }> = {
  welcome:              { label: "Welcome Email",          description: "Fires when a new user registers",              badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  purchase:             { label: "Purchase Confirmation",  description: "Fires after a successful payment",             badge: "bg-green-500/10 text-green-400 border-green-500/20" },
  refund:               { label: "Refund Notification",    description: "Fires when a payment is refunded",             badge: "bg-red-500/10 text-red-400 border-red-500/20" },
  forgot_password:      { label: "Password Reset",         description: "Fires when user requests password reset",      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  completion:           { label: "Course Completion",      description: "Fires when a student completes a course",      badge: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  affiliate_commission: { label: "Affiliate Commission",   description: "Fires when affiliate earns a commission",      badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
};

const DEFAULT_TEMPLATES: Record<string, { subject: string; html: string }> = {
  welcome: {
    subject: "Welcome to VK Academy, {{name}}! 🎉",
    html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0f1e;color:#e2e8f0;padding:32px;border-radius:12px;">
  <h1 style="color:#2563eb;margin-bottom:8px;">Welcome, {{name}}! 👋</h1>
  <p style="color:#94a3b8;">You've successfully joined <strong style="color:#e2e8f0;">VK Academy</strong> — your learning journey starts now.</p>
  <p style="color:#94a3b8;">Explore our courses and take the first step towards your goals.</p>
  <a href="{{site_url}}/courses" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Browse Courses</a>
  <p style="color:#475569;font-size:12px;margin-top:24px;">© VK Academy</p>
</div>`,
  },
  purchase: {
    subject: "Payment Confirmed — {{course_name}} 🎓",
    html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0f1e;color:#e2e8f0;padding:32px;border-radius:12px;">
  <h1 style="color:#22c55e;">✅ Payment Confirmed!</h1>
  <p>Hi <strong>{{name}}</strong>, your payment of <strong>₹{{amount}}</strong> for <strong>{{course_name}}</strong> was successful.</p>
  <a href="{{site_url}}/my-courses" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#22c55e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Start Learning</a>
  <p style="color:#475569;font-size:12px;margin-top:24px;">© VK Academy</p>
</div>`,
  },
  refund: {
    subject: "Refund Processed — {{course_name}}",
    html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0f1e;color:#e2e8f0;padding:32px;border-radius:12px;">
  <h1 style="color:#f59e0b;">Refund Processed</h1>
  <p>Hi <strong>{{name}}</strong>, your refund of <strong>₹{{amount}}</strong> for <strong>{{course_name}}</strong> has been processed.</p>
  <p style="color:#94a3b8;">Please allow 5–7 business days for the amount to reflect in your account.</p>
  <p style="color:#475569;font-size:12px;margin-top:24px;">© VK Academy</p>
</div>`,
  },
  forgot_password: {
    subject: "Reset Your VK Academy Password",
    html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0f1e;color:#e2e8f0;padding:32px;border-radius:12px;">
  <h1 style="color:#2563eb;">Password Reset Request</h1>
  <p>Hi <strong>{{name}}</strong>, click below to reset your password. This link expires in 1 hour.</p>
  <a href="{{reset_link}}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a>
  <p style="color:#64748b;font-size:12px;margin-top:16px;">If you did not request this, ignore this email.</p>
  <p style="color:#475569;font-size:12px;margin-top:24px;">© VK Academy</p>
</div>`,
  },
  completion: {
    subject: "🎓 Congratulations! You completed {{course_name}}",
    html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0f1e;color:#e2e8f0;padding:32px;border-radius:12px;">
  <h1 style="color:#a855f7;">🎉 Course Complete!</h1>
  <p>Hi <strong>{{name}}</strong>, you've successfully completed <strong>{{course_name}}</strong>. Amazing work!</p>
  <a href="{{site_url}}/courses" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#a855f7;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Explore More Courses</a>
  <p style="color:#475569;font-size:12px;margin-top:24px;">© VK Academy</p>
</div>`,
  },
  affiliate_commission: {
    subject: "💰 Commission Earned — ₹{{amount}}",
    html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0f1e;color:#e2e8f0;padding:32px;border-radius:12px;">
  <h1 style="color:#22c55e;">💰 Commission Credited!</h1>
  <p>Hi <strong>{{name}}</strong>, you've earned a commission of <strong>₹{{amount}}</strong>.</p>
  <a href="{{site_url}}/affiliate" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#22c55e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Dashboard</a>
  <p style="color:#475569;font-size:12px;margin-top:24px;">© VK Academy</p>
</div>`,
  },
};

/* ── Stat card ── */
function Stat({ label, value, sub, icon, color = "text-foreground" }: { label: string; value: any; sub?: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Main CRM Page ── */
export default function AdminCrmPage() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-48 flex-shrink-0 border-r border-border bg-card flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm text-foreground">CRM & Email</p>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-left transition-colors ${tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile tabs */}
        <div className="lg:hidden flex overflow-x-auto border-b border-border bg-card px-4 gap-1 py-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6">
          {tab === "dashboard" && <DashboardTab />}
          {tab === "campaigns" && <CampaignsTab />}
          {tab === "automation" && <AutomationTab />}
          {tab === "templates" && <TemplatesTab />}
          {tab === "subscribers" && <SubscribersTab />}
          {tab === "smtp" && <SmtpTab />}
        </div>
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════ DASHBOARD ══════════════════════════════════════════════ */
function DashboardTab() {
  const [stats, setStats] = useState<any>(null);
  const [sends, setSends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, l] = await Promise.all([
      apiFetch("/api/admin/crm/stats").then(r => r.json()),
      apiFetch("/api/admin/crm/sends?limit=20").then(r => r.json()),
    ]);
    setStats(s); setSends(l);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-foreground">CRM Dashboard</h2><p className="text-sm text-muted-foreground mt-0.5">Email delivery overview</p></div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Total Subscribers" value={stats?.totalSubscribers ?? 0} icon={<Users className="w-4 h-4 text-blue-400" />} color="text-blue-400" />
            <Stat label="Sent This Month" value={stats?.sentThisMonth ?? 0} icon={<Send className="w-4 h-4 text-green-400" />} color="text-green-400" />
            <Stat label="Campaigns Sent" value={stats?.campaignsSent ?? 0} icon={<BarChart2 className="w-4 h-4 text-purple-400" />} color="text-purple-400" />
            <Stat label="Automation Fired" value={stats?.automationEmailsFired ?? 0} icon={<Zap className="w-4 h-4 text-amber-400" />} color="text-amber-400" />
          </div>

          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${stats?.smtpConnected ? "bg-green-500/5 border-green-500/20 text-green-400" : "bg-red-500/5 border-red-500/20 text-red-400"}`}>
            {stats?.smtpConnected ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {stats?.smtpConnected ? "SMTP is connected and active" : "SMTP is not configured — emails won't be sent. Go to the SMTP tab to set it up."}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Recent Email Sends</h3>
              <span className="text-xs text-muted-foreground">Last 20</span>
            </div>
            {sends.length === 0 ? (
              <div className="py-12 text-center"><Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No emails sent yet</p></div>
            ) : (
              <div className="divide-y divide-border">
                {sends.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === "sent" ? "bg-green-400" : "bg-red-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{s.subject}</p>
                      <p className="text-xs text-muted-foreground">{s.email} · {s.type}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{new Date(s.sentAt).toLocaleDateString("en-IN")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════ SMTP ══════════════════════════════════════════════ */
function SmtpTab() {
  const { toast } = useToast();
  const [smtp, setSmtp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [form, setForm] = useState({ host: "", port: "587", secure: false, username: "", password: "", fromName: "VK Academy", fromEmail: "", isActive: false });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch("/api/admin/crm/smtp");
    if (res.ok) {
      const data = await res.json();
      if (data) {
        setSmtp(data);
        setForm(f => ({ ...f, host: data.host, port: String(data.port), secure: data.secure, username: data.username, fromName: data.fromName, fromEmail: data.fromEmail, isActive: data.isActive, password: "" }));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const res = await apiFetch("/api/admin/crm/smtp", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, port: parseInt(form.port) || 587 }),
    });
    if (res.ok) {
      const data = await res.json();
      setSmtp(data);
      toast({ title: "SMTP settings saved!" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: err.error ?? "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  };

  const sendTest = async () => {
    if (!testEmail) { toast({ title: "Enter a recipient email", variant: "destructive" }); return; }
    setTesting(true);
    const res = await apiFetch("/api/admin/crm/smtp/test", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) toast({ title: "Test email sent!", description: `Check ${testEmail}` });
    else toast({ title: data.error ?? "Test failed", variant: "destructive" });
    setTesting(false);
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const PRESETS: { label: string; host: string; port: string; secure: boolean }[] = [
    { label: "Brevo", host: "smtp-relay.brevo.com", port: "587", secure: false },
    { label: "Gmail", host: "smtp.gmail.com", port: "587", secure: false },
    { label: "Outlook", host: "smtp.office365.com", port: "587", secure: false },
    { label: "SendGrid", host: "smtp.sendgrid.net", port: "587", secure: false },
    { label: "Mailgun", host: "smtp.mailgun.org", port: "587", secure: false },
    { label: "Zoho", host: "smtp.zoho.com", port: "587", secure: false },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div><h2 className="text-xl font-bold text-foreground">SMTP Configuration</h2><p className="text-sm text-muted-foreground mt-0.5">Connect your email provider to send all platform emails.</p></div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (
        <>
          {/* Status banner */}
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${smtp?.isActive ? "bg-green-500/5 border-green-500/20 text-green-400" : "bg-amber-500/5 border-amber-500/20 text-amber-400"}`}>
            {smtp?.isActive ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {smtp?.isActive ? "SMTP is active — emails are being sent" : "SMTP is not active. Enable it after saving your settings."}
          </div>

          {/* Provider presets */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => setForm(f => ({ ...f, host: p.host, port: p.port, secure: p.secure }))}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">SMTP Host</Label>
                <Input value={form.host} onChange={e => set("host", e.target.value)} placeholder="smtp.gmail.com" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Port</Label>
                <Input value={form.port} onChange={e => set("port", e.target.value)} placeholder="587" className="bg-background border-border" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Username / Email</Label>
                <Input value={form.username} onChange={e => set("username", e.target.value)} placeholder="you@gmail.com" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Password / App Password{smtp?.passwordSet && " (leave blank to keep)"}</Label>
                <Input type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder={smtp?.passwordSet ? "••••••••" : "Enter password"} className="bg-background border-border" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From Name</Label>
                <Input value={form.fromName} onChange={e => set("fromName", e.target.value)} placeholder="VK Academy" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From Email</Label>
                <Input value={form.fromEmail} onChange={e => set("fromEmail", e.target.value)} placeholder="noreply@vkacademy.com" className="bg-background border-border" />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Use SSL/TLS (port 465)</p>
                <p className="text-xs text-muted-foreground">Enable for port 465 — keep off for 587 (STARTTLS)</p>
              </div>
              <Switch checked={form.secure} onCheckedChange={v => set("secure", v)} />
            </div>
            <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Activate SMTP</p>
                <p className="text-xs text-muted-foreground">When disabled, no emails will be sent from the platform</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={v => set("isActive", v)} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full bg-primary gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving…" : "Save SMTP Settings"}
            </Button>
          </div>

          {/* Test send */}
          {smtp && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><TestTube className="w-4 h-4 text-primary" />Send Test Email</h3>
              <div className="flex gap-2">
                <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" className="bg-background border-border flex-1" />
                <Button onClick={sendTest} disabled={testing} variant="outline" className="gap-1.5 flex-shrink-0">
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="w-3 h-3" />Uses your saved SMTP settings to send a test email</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════ TEMPLATES ══════════════════════════════════════════════ */
function TemplatesTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [previewing, setPreviewing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", type: "custom", subject: "", htmlBody: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch("/api/admin/crm/templates");
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing("new");
    setForm({ name: "", type: "custom", subject: "", htmlBody: "", isActive: true });
  };
  const openEdit = (t: any) => {
    setEditing(t.id);
    setForm({ name: t.name, type: t.type, subject: t.subject, htmlBody: t.htmlBody, isActive: t.isActive });
  };
  const applyDefault = (type: string) => {
    const d = DEFAULT_TEMPLATES[type];
    if (d) setForm(f => ({ ...f, subject: d.subject, htmlBody: d.html }));
  };

  const seedDefaults = async () => {
    setSeeding(true);
    const res = await apiFetch("/api/admin/crm/templates/seed-defaults", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.created === 0) {
        toast({ title: "Already up to date", description: "All default templates already exist." });
      } else {
        toast({ title: `${data.created} template${data.created > 1 ? "s" : ""} created!`, description: "Default templates for all events are ready." });
        load();
      }
    } else {
      toast({ title: "Failed to seed templates", variant: "destructive" });
    }
    setSeeding(false);
  };

  const save = async () => {
    if (!form.name || !form.subject || !form.htmlBody) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    setSaving(true);
    const url = editing === "new" ? "/api/admin/crm/templates" : `/api/admin/crm/templates/${editing}`;
    const method = editing === "new" ? "POST" : "PUT";
    const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      toast({ title: editing === "new" ? "Template created!" : "Template saved!" });
      setEditing(null); load();
    } else {
      const e = await res.json().catch(() => ({}));
      toast({ title: e.error ?? "Failed", variant: "destructive" });
    }
    setSaving(false);
  };

  const del = async (id: number) => {
    setDeleting(id);
    await apiFetch(`/api/admin/crm/templates/${id}`, { method: "DELETE" });
    toast({ title: "Template deleted" });
    load(); setDeleting(null);
  };

  const sendTest = async () => {
    if (!testEmail) { toast({ title: "Enter a recipient email", variant: "destructive" }); return; }
    if (!form.subject) { toast({ title: "Add a subject line first", variant: "destructive" }); return; }
    if (!form.htmlBody) { toast({ title: "Email body is empty", variant: "destructive" }); return; }
    setTestSending(true);
    const res = await apiFetch("/api/admin/crm/templates/test-send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmail, subject: form.subject, htmlBody: form.htmlBody }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) toast({ title: "Test email sent!", description: `Check ${testEmail} — subject: [TEST] ${form.subject}` });
    else toast({ title: data.error ?? "Failed to send", variant: "destructive" });
    setTestSending(false);
  };

  if (editing !== null) {
    return (
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
          <h2 className="text-xl font-bold text-foreground">{editing === "new" ? "New Template" : "Edit Template"}</h2>
        </div>

        {/* Meta fields */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Template Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Welcome Email" className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <select value={form.type} onChange={e => { setForm(f => ({ ...f, type: e.target.value })); applyDefault(e.target.value); }}
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground">
                <option value="custom">Custom</option>
                <option value="welcome">Welcome</option>
                <option value="purchase">Purchase Confirmation</option>
                <option value="refund">Refund</option>
                <option value="forgot_password">Forgot Password</option>
                <option value="completion">Course Completion</option>
                <option value="affiliate_commission">Affiliate Commission</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject Line</Label>
              <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Welcome to VK Academy, {{name}}!" className="bg-background border-border" />
            </div>
          </div>
          <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-lg">
            <p className="text-xs text-blue-400 flex items-center gap-1.5 flex-wrap"><Info className="w-3 h-3 flex-shrink-0" />Variables: <code className="font-mono bg-blue-500/10 px-1 rounded">{"{{name}}"}</code> <code className="font-mono bg-blue-500/10 px-1 rounded">{"{{email}}"}</code> <code className="font-mono bg-blue-500/10 px-1 rounded">{"{{amount}}"}</code> <code className="font-mono bg-blue-500/10 px-1 rounded">{"{{course_name}}"}</code> <code className="font-mono bg-blue-500/10 px-1 rounded">{"{{reset_link}}"}</code></p>
          </div>
        </div>

        {/* Block email builder */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Email Body</Label>
          <EmailBlockBuilder
            value={form.htmlBody}
            onChange={html => setForm(f => ({ ...f, htmlBody: html }))}
          />
        </div>

        {/* Send Test Email */}
        <div className="bg-card border border-amber-500/20 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TestTube className="w-4 h-4 text-amber-400" />
            Send Test Email
            <span className="text-[10px] font-normal text-muted-foreground ml-1">— sends the current template as-is (before saving)</span>
          </h3>
          <div className="flex gap-2">
            <Input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="your@email.com"
              type="email"
              className="bg-background border-border flex-1"
              onKeyDown={e => { if (e.key === "Enter") sendTest(); }}
            />
            <Button onClick={sendTest} disabled={testSending} variant="outline" className="gap-1.5 flex-shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-400">
              {testSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {testSending ? "Sending…" : "Send Test"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="w-3 h-3 flex-shrink-0" />
            The test email is sent with subject prefixed <code className="font-mono bg-muted px-1 rounded">[TEST]</code> — you don't need to save first
          </p>
        </div>

        {/* Footer actions */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-foreground">Active</p>
            <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="bg-primary gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Template"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold text-foreground">Email Templates</h2><p className="text-sm text-muted-foreground mt-0.5">Reusable HTML email templates for campaigns and automation.</p></div>
        <div className="flex items-center gap-2">
          <Button onClick={seedDefaults} disabled={seeding} variant="outline" size="sm" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
            {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Seed Defaults
          </Button>
          <Button onClick={openNew} size="sm" className="bg-primary gap-1.5"><Plus className="w-4 h-4" />New Template</Button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        : templates.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl py-20 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">No templates yet</p>
            <p className="text-sm text-muted-foreground mb-4">Seed all 6 default event templates in one click, or create your own.</p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={seedDefaults} disabled={seeding} size="sm" className="bg-primary gap-1.5">
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {seeding ? "Creating…" : "Seed Default Templates"}
              </Button>
              <Button onClick={openNew} variant="outline" size="sm" className="gap-1.5"><Plus className="w-4 h-4" />Create Manually</Button>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <div key={t.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{t.subject}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] capitalize flex-shrink-0 ${t.isActive ? "text-green-400 border-green-400/30" : "text-muted-foreground"}`}>
                    {t.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <Badge variant="outline" className="text-[10px] w-fit border-border text-muted-foreground capitalize">{t.type.replace("_", " ")}</Badge>
                <div className="flex gap-2 mt-auto">
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => openEdit(t)}><Edit2 className="w-3 h-3" />Edit</Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => setPreviewing(t.htmlBody)}><Eye className="w-3 h-3" />Preview</Button>
                  <Button variant="outline" size="sm" className="text-red-400 hover:text-red-400 border-red-500/20 hover:bg-red-500/5" disabled={deleting === t.id} onClick={() => del(t.id)}>
                    {deleting === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Email Preview</h3>
              <button onClick={() => setPreviewing(null)}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <iframe srcDoc={previewing} className="w-full min-h-[480px] rounded-lg border border-border bg-white" title="preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════ AUTOMATION ══════════════════════════════════════════════ */
function AutomationTab() {
  const { toast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, t] = await Promise.all([
      apiFetch("/api/admin/crm/automation").then(res => res.json()),
      apiFetch("/api/admin/crm/templates").then(res => res.json()),
    ]);
    setRules(r); setTemplates(t.filter((t: any) => t.isActive));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = async (event: string, patch: Partial<{ templateId: number | null; isEnabled: boolean; delayMinutes: number }>) => {
    setSaving(event);
    setRules(prev => prev.map(r => r.event === event ? { ...r, ...patch } : r));
    const rule = rules.find(r => r.event === event);
    const merged = { ...rule, ...patch };
    const res = await apiFetch(`/api/admin/crm/automation/${event}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: merged.templateId, isEnabled: merged.isEnabled, delayMinutes: merged.delayMinutes }),
    });
    if (res.ok) toast({ title: "Automation updated" });
    else toast({ title: "Failed to update", variant: "destructive" });
    setSaving(null);
  };

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-bold text-foreground">Email Automation</h2><p className="text-sm text-muted-foreground mt-0.5">Toggle event-triggered emails and assign templates to each trigger.</p></div>

      <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl">
        <p className="text-xs text-blue-400 flex items-center gap-1.5"><Info className="w-3 h-3 flex-shrink-0" />Automation uses your active SMTP settings. Make sure SMTP is configured and enabled before turning on automations.</p>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (
        <div className="space-y-3">
          {rules.map(rule => {
            const meta = EVENT_META[rule.event];
            return (
              <div key={rule.event} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] border ${meta.badge}`}>{rule.event.replace("_", " ")}</Badge>
                      <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {saving === rule.event && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    <Switch checked={rule.isEnabled} onCheckedChange={v => update(rule.event, { isEnabled: v })} />
                  </div>
                </div>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email Template</Label>
                    <select value={rule.templateId ?? ""} onChange={e => update(rule.event, { templateId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground">
                      <option value="">— No template selected —</option>
                      {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Delay (minutes after event)</Label>
                    <Input type="number" min={0} value={rule.delayMinutes} onChange={e => setRules(prev => prev.map(r => r.event === rule.event ? { ...r, delayMinutes: parseInt(e.target.value) || 0 } : r))}
                      onBlur={e => update(rule.event, { delayMinutes: parseInt(e.target.value) || 0 })}
                      className="bg-background border-border h-9" />
                  </div>
                </div>
                {rule.isEnabled && !rule.templateId && (
                  <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-2"><AlertCircle className="w-3 h-3" />No template assigned — automation is on but won't send</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════ CAMPAIGNS ══════════════════════════════════════════════ */
function CampaignsTab() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", subject: "", templateId: "", htmlBody: "", recipientFilter: "all" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, t] = await Promise.all([
      apiFetch("/api/admin/crm/campaigns").then(r => r.json()),
      apiFetch("/api/admin/crm/templates").then(r => r.json()),
    ]);
    setCampaigns(c); setTemplates(t.filter((t: any) => t.isActive));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadTemplate = (tid: string) => {
    const t = templates.find((t: any) => String(t.id) === tid);
    if (t) setForm(f => ({ ...f, templateId: tid, subject: t.subject, htmlBody: t.htmlBody }));
    else setForm(f => ({ ...f, templateId: tid }));
  };

  const create = async () => {
    if (!form.name || !form.subject || !form.htmlBody) { toast({ title: "Fill all required fields", variant: "destructive" }); return; }
    setSaving(true);
    const res = await apiFetch("/api/admin/crm/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, templateId: form.templateId ? parseInt(form.templateId) : null }),
    });
    if (res.ok) {
      toast({ title: "Campaign created!" });
      setCreating(false); setForm({ name: "", subject: "", templateId: "", htmlBody: "", recipientFilter: "all" }); load();
    } else {
      const e = await res.json().catch(() => ({}));
      toast({ title: e.error ?? "Failed", variant: "destructive" });
    }
    setSaving(false);
  };

  const sendCampaign = async (id: number) => {
    setSending(id);
    const res = await apiFetch(`/api/admin/crm/campaigns/${id}/send`, { method: "POST" });
    if (res.ok) toast({ title: "Campaign is sending!", description: "Emails are being delivered in the background." });
    else {
      const e = await res.json().catch(() => ({}));
      toast({ title: e.error ?? "Failed to send", variant: "destructive" });
    }
    setSending(null); setTimeout(load, 2000);
  };

  const del = async (id: number) => {
    setDeleting(id);
    await apiFetch(`/api/admin/crm/campaigns/${id}`, { method: "DELETE" });
    toast({ title: "Campaign deleted" }); load(); setDeleting(null);
  };

  const statusColor: Record<string, string> = {
    draft: "text-muted-foreground border-border",
    sending: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    sent: "text-green-400 border-green-400/30 bg-green-400/10",
    failed: "text-red-400 border-red-400/30 bg-red-400/10",
  };

  if (creating) {
    return (
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          <h2 className="text-xl font-bold text-foreground">New Campaign</h2>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Campaign Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Monthly Newsletter — April" className="bg-background border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Load from Template (optional)</Label>
            <select value={form.templateId} onChange={e => loadTemplate(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground">
              <option value="">— Write from scratch —</option>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Subject Line</Label>
            <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Big news from VK Academy 🚀" className="bg-background border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Recipients</Label>
            <select value={form.recipientFilter} onChange={e => setForm(f => ({ ...f, recipientFilter: e.target.value }))}
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground">
              <option value="all">All users</option>
              <option value="enrolled">Enrolled students only</option>
              <option value="not_enrolled">Users who haven't purchased any course</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">HTML Body</Label>
              {form.htmlBody && <button onClick={() => setPreviewing(form.htmlBody)} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"><Eye className="w-3 h-3" />Preview</button>}
            </div>
            <Textarea value={form.htmlBody} onChange={e => setForm(f => ({ ...f, htmlBody: e.target.value }))}
              className="bg-background border-border font-mono text-xs min-h-[240px] resize-y" placeholder="<div>Your email HTML here…</div>" />
          </div>
          <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-lg">
            <p className="text-xs text-blue-400 flex items-center gap-1.5"><Info className="w-3 h-3 flex-shrink-0" />Use <code className="font-mono bg-blue-500/10 px-1 rounded">{"{{name}}"}</code> and <code className="font-mono bg-blue-500/10 px-1 rounded">{"{{email}}"}</code> as variables in the body.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={create} disabled={saving} className="flex-1 bg-primary gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? "Creating…" : "Create Campaign"}
            </Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
        {previewing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Preview</h3>
                <button onClick={() => setPreviewing(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                <iframe srcDoc={previewing} className="w-full min-h-[480px] rounded-lg border border-border bg-white" title="preview" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-foreground">Campaigns</h2><p className="text-sm text-muted-foreground mt-0.5">Send email blasts to your entire user base or targeted segments.</p></div>
        <Button onClick={() => setCreating(true)} size="sm" className="bg-primary gap-1.5"><Plus className="w-4 h-4" />New Campaign</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        : campaigns.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl py-20 text-center">
            <Send className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first campaign to send a bulk email.</p>
            <Button onClick={() => setCreating(true)} size="sm" className="bg-primary gap-1.5"><Plus className="w-4 h-4" />Create Campaign</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm text-foreground truncate">{c.name}</p>
                      <Badge variant="outline" className={`text-[10px] capitalize flex-shrink-0 ${statusColor[c.status]}`}>{c.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.subject}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span>Recipients: <span className="text-foreground font-medium">{c.recipientCount}</span></span>
                      {c.sentCount > 0 && <span>Sent: <span className="text-green-400 font-medium">{c.sentCount}</span></span>}
                      {c.failedCount > 0 && <span>Failed: <span className="text-red-400 font-medium">{c.failedCount}</span></span>}
                      {c.sentAt && <span>Sent on {new Date(c.sentAt).toLocaleDateString("en-IN")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.htmlBody && <button onClick={() => setPreviewing(c.htmlBody)} className="text-muted-foreground hover:text-foreground transition-colors"><Eye className="w-4 h-4" /></button>}
                    {c.status === "draft" && (
                      <Button size="sm" className="bg-primary gap-1 text-xs" disabled={sending === c.id} onClick={() => sendCampaign(c.id)}>
                        {sending === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Send
                      </Button>
                    )}
                    {c.status === "draft" && (
                      <button onClick={() => del(c.id)} disabled={deleting === c.id} className="text-muted-foreground hover:text-red-400 transition-colors">
                        {deleting === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Campaign Preview</h3>
              <button onClick={() => setPreviewing(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <iframe srcDoc={previewing} className="w-full min-h-[480px] rounded-lg border border-border bg-white" title="preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════ SUBSCRIBERS ══════════════════════════════════════════════ */
function SubscribersTab() {
  const [subs, setSubs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 30;

  const load = useCallback(async (q = "", p = 0) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(p * limit) });
    if (q) params.set("search", q);
    const res = await apiFetch(`/api/admin/crm/subscribers?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSubs(data.users); setTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(search, page); }, [load, search, page]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold text-foreground">Subscribers</h2><p className="text-sm text-muted-foreground mt-0.5">All registered users — <span className="text-foreground font-medium">{total}</span> total</p></div>
        <Input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search by name or email…" className="bg-card border-border max-w-xs" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-4 px-4 py-2.5 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Name</span><span>Email</span><span>Role</span><span>Joined</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : subs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No subscribers found</div>
        ) : (
          <div className="divide-y divide-border">
            {subs.map(s => (
              <div key={s.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-4 items-center px-4 py-3">
                <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                <Badge variant="outline" className={`text-[10px] capitalize ${s.role === "admin" ? "text-red-400 border-red-400/30" : s.role === "affiliate" ? "text-purple-400 border-purple-400/30" : "text-muted-foreground border-border"}`}>{s.role}</Badge>
                <span className="text-[11px] text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {total > limit && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
