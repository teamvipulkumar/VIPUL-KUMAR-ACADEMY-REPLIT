import { useState, useEffect } from "react";
import { useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Chrome, Info } from "lucide-react";

export default function AdminSettingsPage() {
  const { data: settings } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const updateSettings = useUpdateAdminSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    siteName: "", siteDescription: "", currency: "INR",
    stripeEnabled: true, razorpayEnabled: false, emailNotificationsEnabled: true,
    commissionRate: 20,
  });

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
