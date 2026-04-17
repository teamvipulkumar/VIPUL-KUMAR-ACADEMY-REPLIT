import { useState, useEffect } from "react";
import { useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Chrome, Info, Construction, Check } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme-context";

const THEMES: { id: Theme; label: string; description: string; swatches: string[] }[] = [
  {
    id: "dark",
    label: "Dark",
    description: "Deep navy & electric blue",
    swatches: ["#0b1120", "#142043", "#3b5bdb", "#c8d8ff"],
  },
  {
    id: "light",
    label: "Light",
    description: "Clean white & blue",
    swatches: ["#f8fafc", "#e2e8f0", "#3b5bdb", "#1e293b"],
  },
  {
    id: "forest",
    label: "Forest",
    description: "Deep forest green",
    swatches: ["#091413", "#285A48", "#408A71", "#B0E4CC"],
  },
];

export default function AdminSettingsPage() {
  const { data: settings } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const updateSettings = useUpdateAdminSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [form, setForm] = useState({
    siteName: "", siteDescription: "", currency: "INR",
    stripeEnabled: true, razorpayEnabled: false, emailNotificationsEnabled: true,
    commissionRate: 20,
  });
  const [maintenanceForm, setMaintenanceForm] = useState({ maintenanceMode: false, maintenanceMessage: "" });
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  const [googleForm, setGoogleForm] = useState({ clientId: "", clientSecret: "", enabled: false });
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        siteName: settings.siteName, siteDescription: settings.siteDescription,
        currency: settings.currency, stripeEnabled: settings.stripeEnabled,
        razorpayEnabled: settings.razorpayEnabled, emailNotificationsEnabled: settings.emailNotificationsEnabled,
        commissionRate: settings.commissionRate,
      });
      setMaintenanceForm({
        maintenanceMode: (settings as Record<string, unknown>).maintenanceMode as boolean ?? false,
        maintenanceMessage: (settings as Record<string, unknown>).maintenanceMessage as string ?? "",
      });
      setGoogleForm({
        enabled: (settings as Record<string, unknown>).googleSignInEnabled as boolean ?? false,
        clientId: (settings as Record<string, unknown>).googleClientId as string ?? "",
        clientSecret: (settings as Record<string, unknown>).googleClientSecret as string ?? "",
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({ data: form }, {
      onSuccess: () => { toast({ title: "Settings saved!" }); queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() }); },
      onError: () => toast({ title: "Error saving settings", variant: "destructive" }),
    });
  };

  const handleSaveMaintenance = async () => {
    setMaintenanceSaving(true);
    updateSettings.mutate({
      data: {
        maintenanceMode: maintenanceForm.maintenanceMode,
        maintenanceMessage: maintenanceForm.maintenanceMessage,
      } as Parameters<typeof updateSettings.mutate>[0]["data"],
    }, {
      onSuccess: () => {
        toast({ title: maintenanceForm.maintenanceMode ? "Maintenance mode enabled" : "Maintenance mode disabled" });
        queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        setMaintenanceSaving(false);
      },
      onError: () => { toast({ title: "Error saving maintenance settings", variant: "destructive" }); setMaintenanceSaving(false); },
    });
  };

  const handleSaveGoogle = () => {
    updateSettings.mutate({
      data: {
        googleSignInEnabled: googleForm.enabled,
        googleClientId: googleForm.clientId,
        googleClientSecret: googleForm.clientSecret,
      } as Parameters<typeof updateSettings.mutate>[0]["data"],
    }, {
      onSuccess: () => {
        toast({ title: "Google Sign-In settings saved!" });
        queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["google-config"] });
      },
      onError: () => toast({ title: "Error saving Google settings", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground">Configure your platform.</p>
      </div>

      <div className="space-y-6">
        {/* Appearance / Theme */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Choose a colour theme for your platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map(t => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                      active
                        ? "border-primary shadow-md shadow-primary/20"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {/* Swatch preview */}
                    <div className="flex gap-1 mb-2.5 rounded-lg overflow-hidden h-8">
                      {t.swatches.map((c, i) => (
                        <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-foreground">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.description}</p>
                    {active && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* General */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm mb-1.5 block">Platform Name</Label>
              <Input value={form.siteName} onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))} className="bg-background" />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Description</Label>
              <textarea value={form.siteDescription} onChange={e => setForm(f => ({ ...f, siteDescription: e.target.value }))} className="w-full p-3 rounded-md bg-background border border-border text-sm resize-none h-20" />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Currency</Label>
              <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="bg-background w-32" />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Send emails for signups, purchases, etc.</p>
              </div>
              <Switch checked={form.emailNotificationsEnabled} onCheckedChange={v => setForm(f => ({ ...f, emailNotificationsEnabled: v }))} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>

        {/* Maintenance Mode */}
        <Card className={`border-2 ${maintenanceForm.maintenanceMode ? "bg-amber-500/5 border-amber-500/40" : "bg-card border-border"}`}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Construction className={`w-4 h-4 ${maintenanceForm.maintenanceMode ? "text-amber-400" : "text-muted-foreground"}`} />
              Maintenance Mode
              {maintenanceForm.maintenanceMode && (
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30">Active</span>
              )}
            </CardTitle>
            <CardDescription>When enabled, visitors see a maintenance page. Admins can still access the site.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">The website will be blocked for all non-admin users</p>
              </div>
              <Switch
                checked={maintenanceForm.maintenanceMode}
                onCheckedChange={v => setMaintenanceForm(f => ({ ...f, maintenanceMode: v }))}
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Maintenance Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={maintenanceForm.maintenanceMessage}
                onChange={e => setMaintenanceForm(f => ({ ...f, maintenanceMessage: e.target.value }))}
                placeholder="We're performing scheduled maintenance. We'll be back shortly!"
                className="bg-background border-border resize-none h-20 text-sm"
              />
            </div>
            {maintenanceForm.maintenanceMode && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <Construction className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Maintenance mode is <strong>ON</strong>. All visitors (except admins) will see the maintenance screen until you turn this off.</span>
              </div>
            )}
            <Button onClick={handleSaveMaintenance} disabled={maintenanceSaving} variant={maintenanceForm.maintenanceMode ? "default" : "outline"} className={`w-full border-border ${maintenanceForm.maintenanceMode ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}>
              {maintenanceSaving ? "Saving..." : maintenanceForm.maintenanceMode ? "Save & Keep Maintenance Active" : "Save Maintenance Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Social Login */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Chrome className="w-4 h-4 text-blue-400" />Social Login
            </CardTitle>
            <CardDescription>Allow users to sign in with their Google account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Google Sign-In</p>
                <p className="text-xs text-muted-foreground">Show "Continue with Google" on login &amp; signup pages</p>
              </div>
              <Switch checked={googleForm.enabled} onCheckedChange={v => setGoogleForm(f => ({ ...f, enabled: v }))} />
            </div>

            <div className={`space-y-4 transition-opacity ${googleForm.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <div>
                <Label className="text-sm mb-1.5 block">Google Client ID</Label>
                <Input
                  value={googleForm.clientId}
                  onChange={e => setGoogleForm(f => ({ ...f, clientId: e.target.value }))}
                  placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                  className="bg-background font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Google Client Secret</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={googleForm.clientSecret}
                    onChange={e => setGoogleForm(f => ({ ...f, clientSecret: e.target.value }))}
                    placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="bg-background font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Get your credentials from the <strong>Google Cloud Console</strong> → APIs &amp; Services → Credentials. Set the authorised redirect URI to <code className="bg-blue-500/20 px-1 rounded">/api/auth/google/callback</code>.</span>
              </div>
            </div>

            <Button onClick={handleSaveGoogle} disabled={updateSettings.isPending} variant="outline" className="w-full border-border">
              {updateSettings.isPending ? "Saving..." : "Save Google Settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
