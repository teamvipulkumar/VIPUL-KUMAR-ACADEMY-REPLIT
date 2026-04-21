import { useState, useEffect } from "react";
import { useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Check, ExternalLink, Globe, Zap } from "lucide-react";

export default function AdminFacebookPixelPage() {
  const { data: settings } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const updateSettings = useUpdateAdminSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({ enabled: false, pixelId: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: (settings as Record<string, unknown>).facebookPixelEnabled as boolean ?? false,
        pixelId: (settings as Record<string, unknown>).facebookPixelId as string ?? "",
      });
    }
  }, [settings]);

  const handleSave = () => {
    setSaving(true);
    updateSettings.mutate({
      data: {
        facebookPixelEnabled: form.enabled,
        facebookPixelId: form.pixelId,
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

  const testEventsUrl = `https://www.facebook.com/events_manager2/list/pixel/${form.pixelId}/test_events`;

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Facebook Pixel</h1>
        <p className="text-muted-foreground">Browser-based tracking — events fire directly in the visitor's browser via the Meta pixel script.</p>
      </div>

      <div className="space-y-6">

        {/* Config card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <CardTitle className="text-base">Pixel Configuration</CardTitle>
            </div>
            <CardDescription>Enter your Pixel ID from Facebook Events Manager. No server-side token needed — all events run in the browser.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Facebook Pixel</p>
                <p className="text-xs text-muted-foreground">Injects the Meta pixel script on every page load</p>
              </div>
              <Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} />
            </div>

            <div>
              <Label className="text-sm mb-1.5 block">Pixel ID</Label>
              <Input
                value={form.pixelId}
                onChange={e => setForm(f => ({ ...f, pixelId: e.target.value }))}
                placeholder="e.g. 1234567890123456"
                className="bg-background font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Found in Events Manager → Data Sources → your Pixel → Settings tab.
              </p>
            </div>

            <Button type="button" onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Pixel Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Test Events card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <CardTitle className="text-base">Test Events with Meta</CardTitle>
            </div>
            <CardDescription>
              Use Meta's URL-based Test Events tool to verify all events are firing correctly before running ads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-2 text-xs text-amber-200">
              <p className="font-semibold text-amber-100">How to test:</p>
              <ol className="space-y-1.5 list-none">
                {[
                  "Save your Pixel ID above and make sure the toggle is ON",
                  "Click \"Open Test Events\" below — it opens Meta Events Manager",
                  "Go to the Test Events tab, select Website as the channel",
                  "Enter your site URL and click \"Test Events\"",
                  "Browse your site, add to cart, complete a purchase — events appear live",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500/30 text-amber-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-amber-500/30 text-amber-300 hover:bg-amber-500/10 gap-2"
              disabled={!form.pixelId}
              onClick={() => window.open(testEventsUrl, "_blank")}
            >
              <ExternalLink className="w-4 h-4" />
              Open Test Events in Meta Events Manager
            </Button>
            {!form.pixelId && (
              <p className="text-xs text-muted-foreground text-center">Enter and save your Pixel ID first to enable this button</p>
            )}
          </CardContent>
        </Card>

        {/* Events tracked */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Events Tracked Automatically</CardTitle>
            <CardDescription>All events fire in the visitor's browser — no server configuration needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {[
                { event: "PageView", trigger: "Every page / route change", note: "Fires on every navigation automatically" },
                { event: "ViewContent", trigger: "Course detail page", note: "content_type: product, includes course name & price" },
                { event: "Lead", trigger: "Optin form submission", note: "Fires when a visitor submits a lead capture form" },
                { event: "InitiateCheckout", trigger: "Checkout page load", note: "Fires when the checkout page opens" },
                { event: "Purchase", trigger: "Successful payment", note: "Includes value & currency — fires for all payment gateways" },
              ].map(({ event, trigger, note }) => (
                <div key={event} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold font-mono text-foreground">{event}</p>
                    <p className="text-xs text-muted-foreground">{trigger}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
