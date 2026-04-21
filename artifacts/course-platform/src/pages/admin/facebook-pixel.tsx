import { useState, useEffect } from "react";
import { useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Check, Info } from "lucide-react";

export default function AdminFacebookPixelPage() {
  const { data: settings } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const updateSettings = useUpdateAdminSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({ enabled: false, pixelId: "", accessToken: "" });
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: (settings as Record<string, unknown>).facebookPixelEnabled as boolean ?? false,
        pixelId: (settings as Record<string, unknown>).facebookPixelId as string ?? "",
        accessToken: (settings as Record<string, unknown>).facebookAccessToken as string ?? "",
      });
    }
  }, [settings]);

  const handleSave = () => {
    setSaving(true);
    updateSettings.mutate({
      data: {
        facebookPixelEnabled: form.enabled,
        facebookPixelId: form.pixelId,
        facebookAccessToken: form.accessToken,
      } as Parameters<typeof updateSettings.mutate>[0]["data"],
    }, {
      onSuccess: () => {
        toast({ title: "Facebook Pixel settings saved!" });
        queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        setSaving(false);
      },
      onError: () => {
        toast({ title: "Error saving Pixel settings", variant: "destructive" });
        setSaving(false);
      },
    });
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Facebook Pixel</h1>
        <p className="text-muted-foreground">Track ad performance and conversions for ROAS optimisation.</p>
      </div>

      <div className="space-y-6">
        {/* Enable toggle */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Pixel Configuration</CardTitle>
            <CardDescription>Enter your Pixel ID from Facebook Events Manager to start tracking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Facebook Pixel</p>
                <p className="text-xs text-muted-foreground">Inject the pixel script across all pages</p>
              </div>
              <Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} />
            </div>

            <div className={`space-y-4 transition-opacity ${form.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <div>
                <Label className="text-sm mb-1.5 block">Pixel ID</Label>
                <Input
                  value={form.pixelId}
                  onChange={e => setForm(f => ({ ...f, pixelId: e.target.value }))}
                  placeholder="e.g. 1234567890123456"
                  className="bg-background font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Found in your Facebook Events Manager → Data Sources → Pixel settings.
                </p>
              </div>

              <div>
                <Label className="text-sm mb-1.5 block">
                  Conversions API Access Token
                  <span className="ml-2 text-muted-foreground font-normal text-xs">(optional — for server-side tracking)</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={form.accessToken}
                    onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))}
                    placeholder="EAAxxxxxxxxxxxxxxxx..."
                    className="bg-background font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate in Events Manager → Settings → Conversions API → Generate Access Token.
                </p>
              </div>
            </div>

            <Button type="button" onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Pixel Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Events info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              Events Tracked Automatically
            </CardTitle>
            <CardDescription>These events fire on their respective pages without any extra setup.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { event: "PageView", where: "Every page navigation", detail: "Fires automatically on every route change" },
                { event: "ViewContent", where: "Course detail page", detail: "Includes course name, price and currency" },
                { event: "Lead", where: "Optin form submission", detail: "Fires when a user submits the lead capture form" },
                { event: "InitiateCheckout", where: "Checkout page open", detail: "Includes course ID and currency" },
                { event: "Purchase", where: "Successful payment", detail: "Includes value, currency and course name — fires for all gateways" },
              ].map(({ event, where, detail }) => (
                <div key={event} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground font-mono">{event}</p>
                    <p className="text-xs text-muted-foreground">{where}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Setup guide */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">How to Get Your Pixel ID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {[
              "Go to Facebook Business Manager (business.facebook.com)",
              "Navigate to Events Manager → Data Sources",
              "Select your Pixel (or create one if you don't have it)",
              "Copy the Pixel ID shown at the top of the page",
              "Paste it in the Pixel ID field above and enable the toggle",
              "Click Save Pixel Settings",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
