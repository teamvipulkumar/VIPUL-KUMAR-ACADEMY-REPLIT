import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, Eye, EyeOff, ChevronDown, ChevronUp,
  Zap, AlertCircle, Loader2, TestTube2, Globe, Landmark,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Gateway = {
  name: string;
  displayName: string;
  keyLabel: string;
  secretLabel: string;
  supportedCountries: string;
  id: number | null;
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  isActive: boolean;
  isTestMode: boolean;
  isConfigured: boolean;
};

type GatewayForm = {
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  isActive: boolean;
  isTestMode: boolean;
};

const GATEWAY_META: Record<string, { icon: string; logo?: string; imgClass?: string; color: string; bg: string; border: string; description: string; docsUrl: string; webhookNote: string }> = {
  stripe: {
    icon: "S",
    logo: "stripe-logo.png",
    imgClass: "w-full h-full object-cover",
    color: "text-[#635BFF]",
    bg: "bg-white",
    border: "border-[#635BFF]/30",
    description: "Accept cards, wallets & 135+ currencies globally. Best for international students.",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    webhookNote: "Get from Stripe Dashboard → Developers → Webhooks",
  },
  razorpay: {
    icon: "R",
    logo: "razorpay-logo.png",
    color: "text-blue-400",
    bg: "bg-white",
    border: "border-blue-400/30",
    description: "UPI, NetBanking, Cards & Wallets. Most popular for Indian customers.",
    docsUrl: "https://dashboard.razorpay.com/app/keys",
    webhookNote: "Get from Razorpay Dashboard → Settings → Webhooks",
  },
  cashfree: {
    icon: "CF",
    logo: "cashfree-logo.png",
    color: "text-green-400",
    bg: "bg-white",
    border: "border-green-400/30",
    description: "Instant settlements, UPI & Cards. Preferred by startups and growing businesses.",
    docsUrl: "https://merchant.cashfree.com/merchants/apikey",
    webhookNote: "Get from Cashfree Dashboard → Developers → Webhooks",
  },
  paytm: {
    icon: "P",
    logo: "paytm-logo.png",
    color: "text-sky-400",
    bg: "bg-white",
    border: "border-sky-400/30",
    description: "India's largest payment network. Accept Paytm Wallet, UPI & Cards.",
    docsUrl: "https://business.paytm.com/account/settings",
    webhookNote: "Configure webhook at Paytm Business Dashboard",
  },
  payu: {
    icon: "U",
    logo: "payu-logo.png",
    color: "text-orange-400",
    bg: "bg-white",
    border: "border-orange-400/30",
    description: "Reliable payment gateway with EMI options, UPI & all major cards.",
    docsUrl: "https://onboarding.payu.in/app/details",
    webhookNote: "Configure webhook/IPN URL at PayU Dashboard",
  },
};

function GatewayCard({ gw, onSave, onRemove, onTest }: {
  gw: Gateway;
  onSave: (name: string, form: GatewayForm) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
  onTest: (name: string) => Promise<void>;
}) {
  const meta = GATEWAY_META[gw.name] ?? { icon: "💰", color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", description: "", docsUrl: "#", webhookNote: "" };
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<GatewayForm>({
    apiKey: gw.apiKey,
    secretKey: gw.secretKey,
    webhookSecret: gw.webhookSecret,
    isActive: gw.isActive,
    isTestMode: gw.isTestMode,
  });
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isMasked = (v: string) => v.length > 0 && /^•+$/.test(v);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(gw.name, form); setExpanded(false); } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try { await onTest(gw.name); } finally { setTesting(false); }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${gw.displayName} configuration? This will disable real payments for this gateway.`)) return;
    setRemoving(true);
    try { await onRemove(gw.name); } finally { setRemoving(false); }
  };

  const handleToggleActive = async () => {
    const newActive = !form.isActive;
    setForm(f => ({ ...f, isActive: newActive }));
    setSaving(true);
    try { await onSave(gw.name, { ...form, isActive: newActive }); } finally { setSaving(false); }
  };

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${gw.isConfigured && gw.isActive ? meta.border : "border-border"}`}>
      {/* Header */}
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`w-11 h-11 rounded-xl ${meta.bg} flex items-center justify-center text-xl flex-shrink-0 overflow-hidden`}>
            {meta.logo
              ? <img src={`${import.meta.env.BASE_URL}${meta.logo}`} alt={gw.displayName} className="w-full h-full object-contain p-1 rounded-tl-[0px] rounded-tr-[0px] rounded-br-[0px] rounded-bl-[0px] pl-[4px] pr-[4px] pt-[4px] pb-[4px]" />
              : meta.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground">{gw.displayName}</h3>
              {gw.isConfigured && gw.isActive ? (
                <Badge className="text-xs text-green-400 border-green-400/30 bg-green-400/10 gap-1">
                  <CheckCircle2 className="w-3 h-3" />Active
                </Badge>
              ) : gw.isConfigured ? (
                <Badge className="text-xs text-amber-400 border-amber-400/30 bg-amber-400/10 gap-1">
                  <AlertCircle className="w-3 h-3" />Configured · Inactive
                </Badge>
              ) : (
                <Badge className="text-xs text-muted-foreground border-border bg-transparent gap-1">
                  <XCircle className="w-3 h-3" />Not Configured
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border gap-0.5">
                <Globe className="w-2.5 h-2.5" />{gw.supportedCountries}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{meta.description}</p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {gw.isConfigured && (
            <button
              onClick={handleToggleActive}
              disabled={saving}
              title={form.isActive ? "Disable gateway" : "Enable gateway"}
              className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${form.isActive ? "bg-green-500" : "bg-muted"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          )}
          <Button variant="ghost" size="sm" className="px-2 h-8" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-border p-5 bg-background/30 space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-400/5 border border-amber-400/20">
            <TestTube2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-amber-300">
                {form.isTestMode ? "Test Mode (sandbox credentials)" : "Live Mode (real transactions)"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {form.isTestMode ? "No real money will be charged. Use test credentials from your gateway dashboard." : "Real transactions will be processed. Use production API keys."}
              </p>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, isTestMode: !f.isTestMode }))}
              className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${form.isTestMode ? "bg-amber-500" : "bg-primary"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isTestMode ? "translate-x-0.5" : "translate-x-4"}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* API Key */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center justify-between">
                {gw.keyLabel}
                <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-[10px]">Get key →</a>
              </Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder={`Enter ${gw.keyLabel.toLowerCase()}`}
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  onFocus={e => { if (isMasked(e.target.value)) setForm(f => ({ ...f, apiKey: "" })); }}
                  className="bg-card border-border pr-9 font-mono text-xs"
                />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKey(v => !v)}>
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Secret Key */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{gw.secretLabel}</Label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  placeholder={`Enter ${gw.secretLabel.toLowerCase()}`}
                  value={form.secretKey}
                  onChange={e => setForm(f => ({ ...f, secretKey: e.target.value }))}
                  onFocus={e => { if (isMasked(e.target.value)) setForm(f => ({ ...f, secretKey: "" })); }}
                  className={`bg-card pr-9 font-mono text-xs ${!isMasked(form.secretKey) && form.secretKey && form.apiKey && form.secretKey === form.apiKey ? "border-red-500 focus-visible:ring-red-500" : "border-border"}`}
                />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => {
                  if (!showSecret && isMasked(form.secretKey)) setForm(f => ({ ...f, secretKey: "" }));
                  setShowSecret(v => !v);
                }}>
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {isMasked(form.secretKey) && (
                <p className="text-[10px] text-muted-foreground/70">Key saved securely. Click the field to replace it with a new value.</p>
              )}
              {!isMasked(form.secretKey) && form.secretKey === "" && (
                <p className="text-[10px] text-amber-400">Field cleared — paste your {gw.secretLabel.toLowerCase()} to update it, or leave blank to keep the saved key.</p>
              )}
              {!isMasked(form.secretKey) && form.secretKey && form.apiKey && form.secretKey === form.apiKey && (
                <p className="text-[10px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {gw.secretLabel} must be different from {gw.keyLabel}
                </p>
              )}
            </div>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Webhook Secret <span className="text-[10px] opacity-60">(optional)</span>
            </Label>
            <div className="relative">
              <Input
                type={showWebhook ? "text" : "password"}
                placeholder="Enter webhook signing secret"
                value={form.webhookSecret}
                onChange={e => setForm(f => ({ ...f, webhookSecret: e.target.value }))}
                onFocus={e => { if (isMasked(e.target.value)) setForm(f => ({ ...f, webhookSecret: "" })); }}
                className="bg-card border-border pr-9 font-mono text-xs"
              />
              <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => {
                if (!showWebhook && isMasked(form.webhookSecret)) setForm(f => ({ ...f, webhookSecret: "" }));
                setShowWebhook(v => !v);
              }}>
                {showWebhook ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">{meta.webhookNote}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving || (!isMasked(form.secretKey) && !!form.secretKey && !!form.apiKey && form.secretKey === form.apiKey)} size="sm" className="bg-primary gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
            {gw.isConfigured && (
              <Button onClick={handleTest} disabled={testing} variant="outline" size="sm" className="border-border gap-1.5">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-yellow-400" />}
                {testing ? "Testing..." : "Test Connection"}
              </Button>
            )}
            {gw.isConfigured && (
              <Button onClick={handleRemove} disabled={removing} variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-400/10 gap-1.5 ml-auto">
                {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPaymentGatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchGateways = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/payment-gateways`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      setGateways(await res.json());
    } catch {
      toast({ title: "Failed to load payment gateways", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGateways(); }, []);

  const handleSave = async (name: string, form: GatewayForm) => {
    const res = await fetch(`${API_BASE}/api/admin/payment-gateways/${name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { toast({ title: "Save failed", description: data.error, variant: "destructive" }); return; }
    toast({ title: "Configuration saved", description: `${name} settings updated.` });
    await fetchGateways();
  };

  const handleRemove = async (name: string) => {
    const res = await fetch(`${API_BASE}/api/admin/payment-gateways/${name}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { toast({ title: "Remove failed", variant: "destructive" }); return; }
    toast({ title: "Gateway removed" });
    await fetchGateways();
  };

  const handleTest = async (name: string) => {
    const res = await fetch(`${API_BASE}/api/admin/payment-gateways/${name}/test`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Connection test failed", description: data.error, variant: "destructive" });
    } else {
      toast({ title: "Connection successful!", description: data.message });
    }
  };

  const activeCount = gateways.filter(g => g.isActive).length;
  const configuredCount = gateways.filter(g => g.isConfigured).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Landmark className="w-6 h-6 text-primary" />Payment Gateways
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure real payment processors so students can pay for courses. Keys are stored securely.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Available Gateways", value: 5, color: "text-foreground" },
          { label: "Configured", value: configuredCount, color: "text-amber-400" },
          { label: "Active", value: activeCount, color: "text-green-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="mb-5 p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-foreground font-medium">How it works: </span>
          Add your gateway API keys below. Enable the gateway(s) you want to accept. The checkout page will automatically show all active gateways to students. You can run in <span className="text-amber-400">Test Mode</span> first to verify everything works before going live.
        </div>
      </div>

      {/* Gateway cards */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {gateways.map(gw => (
            <GatewayCard
              key={gw.name}
              gw={gw}
              onSave={handleSave}
              onRemove={handleRemove}
              onTest={handleTest}
            />
          ))}
        </div>
      )}

      {/* Security note */}
      <div className="mt-6 p-4 rounded-xl bg-card border border-border">
        <h3 className="text-xs font-semibold text-foreground mb-2">🔒 Security Notes</h3>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>API keys are stored encrypted in your database — never exposed to students.</li>
          <li>Always use Test Mode first to verify integration before accepting real payments.</li>
          <li>Set up webhook URLs in each gateway's dashboard to handle payment confirmations.</li>
          <li>Rotate your secret keys periodically for better security.</li>
        </ul>
      </div>
    </div>
  );
}
