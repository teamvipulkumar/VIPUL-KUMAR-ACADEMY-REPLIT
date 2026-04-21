import { useState, useEffect } from "react";
import { useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Check, ExternalLink, Globe, Zap, AlertTriangle } from "lucide-react";

export default function AdminFacebookPixelPage() {
  const { data: settings } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const updateSettings = useUpdateAdminSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({ enabled: false, pixelId: "", baseCode: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: (settings as Record<string, unknown>).facebookPixelEnabled as boolean ?? false,
        pixelId: (settings as Record<string, unknown>).facebookPixelId as string ?? "",
        baseCode: (settings as Record<string, unknown>).facebookPixelBaseCode as string ?? "",
      });
    }
  }, [settings]);

  const handleSave = () => {
    setSaving(true);
    updateSettings.mutate({
      data: {
        facebookPixelEnabled: form.enabled,
        facebookPixelId: form.pixelId,
        facebookPixelBaseCode: form.baseCode,
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

  const testEventsUrl = form.pixelId
    ? `https://www.facebook.com/events_manager2/list/pixel/${form.pixelId}/test_events`
    : "https://business.facebook.com/events_manager2";

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Facebook Pixel</h1>
        <p className="text-muted-foreground">Browser-based tracking — all events fire directly in the visitor's browser.</p>
      </div>

      <div className="space-y-6">

        {/* Config card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <CardTitle className="text-base">Pixel Configuration</CardTitle>
            </div>
            <CardDescription>
              Enable the pixel and paste your Pixel ID and base code from Meta Events Manager.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Facebook Pixel</p>
                <p className="text-xs text-muted-foreground">Activates pixel injection on every page</p>
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

            <div>
              <Label className="text-sm mb-1.5 block">
                Pixel Base Code
                <span className="ml-2 text-muted-foreground font-normal text-xs">(paste from Meta Events Manager)</span>
              </Label>
              <Textarea
                value={form.baseCode}
                onChange={e => setForm(f => ({ ...f, baseCode: e.target.value }))}
                placeholder={`<!-- Meta Pixel Code -->\n<script>\n!function(f,b,e,v,n,t,s)...\n</script>\n<!-- End Meta Pixel Code -->`}
                className="bg-background font-mono text-xs min-h-[180px] resize-y"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Copy from Events Manager → your Pixel → Overview → Install Pixel → Copy Code. If left empty, the platform auto-injects using the Pixel ID above.
              </p>
            </div>

            <Button type="button" onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Pixel Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Traffic permissions — root cause fix */}
        <Card className="border-red-500/50 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <CardTitle className="text-base text-red-300">Fix: Traffic Permission Settings (Events Blocked)</CardTitle>
            </div>
            <CardDescription className="text-red-400/80">
              If you see <span className="font-mono text-xs bg-red-500/10 px-1 rounded">Pixel is unavailable due to traffic permission settings</span> in your browser console, Meta is blocking all pixel events from your domain. This must be fixed in Meta Events Manager.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 space-y-2 text-xs text-red-200">
              <p className="font-semibold text-red-100">How to fix — remove domain restrictions:</p>
              <ol className="space-y-2 list-none">
                {[
                  { step: "Open Meta Events Manager", link: { label: "business.facebook.com/events_manager", url: "https://business.facebook.com/events_manager2" } },
                  { step: "Click on your Pixel → go to the Settings tab", link: null },
                  { step: "Scroll to the \"Traffic\" or \"Domain Restrictions\" section", link: null },
                  { step: "Remove all domain restrictions — OR add your website domain to the allowed list", link: null },
                  { step: "Save changes. Events will start flowing immediately.", link: null },
                ].map(({ step, link }, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-red-500/30 text-red-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>
                      {step}
                      {link && (
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          className="ml-1 text-red-300 underline underline-offset-2 hover:text-red-100">
                          {link.label}
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-red-500/30 text-red-300 hover:bg-red-500/10"
              onClick={() => window.open(
                form.pixelId
                  ? `https://www.facebook.com/events_manager2/list/pixel/${form.pixelId}/settings`
                  : "https://business.facebook.com/events_manager2",
                "_blank"
              )}
            >
              <ExternalLink className="w-4 h-4" />
              Open Pixel Settings in Meta Events Manager
            </Button>
            <p className="text-xs text-muted-foreground/60 text-center">
              Meta reference: <a href="https://www.facebook.com/business/help/572690630080597" target="_blank" rel="noopener noreferrer" className="underline underline-offset-1 hover:text-foreground">facebook.com/business/help/572690630080597</a>
            </p>
          </CardContent>
        </Card>

        {/* Test Events card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <CardTitle className="text-base">Test Events</CardTitle>
            </div>
            <CardDescription>
              After saving, use Meta's Test Events tool to confirm events fire correctly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              {[
                "Save your settings above and make sure the toggle is ON",
                "Click the button below — it opens the Test Events tab in Meta Events Manager",
                "Select Website as the marketing channel",
                "Enter your live site URL and click Test Events",
                "Browse the site — PageView, InitiateCheckout, Purchase etc. appear live",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => window.open(testEventsUrl, "_blank")}
            >
              <ExternalLink className="w-4 h-4" />
              Open Test Events in Meta Events Manager
            </Button>
          </CardContent>
        </Card>

        {/* Events tracked */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Events Tracked Automatically</CardTitle>
            <CardDescription>All events fire in the visitor's browser — no extra setup needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {[
                { event: "PageView", trigger: "Every page / route change" },
                { event: "ViewContent", trigger: "Course detail page — includes course name & price" },
                { event: "Lead", trigger: "Optin form submission" },
                { event: "InitiateCheckout", trigger: "Checkout page load" },
                { event: "Purchase", trigger: "Successful payment — includes value & currency" },
              ].map(({ event, trigger }) => (
                <div key={event} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold font-mono text-foreground">{event}</p>
                    <p className="text-xs text-muted-foreground">{trigger}</p>
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
