import { useState, useEffect } from "react";
import { useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Check, ExternalLink, Globe, Zap, Copy, Code2, AlertTriangle } from "lucide-react";

export default function AdminFacebookPixelPage() {
  const { data: settings } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const updateSettings = useUpdateAdminSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({ enabled: false, pixelId: "" });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const baseCode = form.pixelId
    ? `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${form.pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${form.pixelId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`
    : "";

  const handleCopy = async () => {
    if (!baseCode) return;
    await navigator.clipboard.writeText(baseCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <CardDescription>Enter your Pixel ID — events are injected automatically on every page.</CardDescription>
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

        {/* Base Code card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-green-400" />
                <CardTitle className="text-base">Pixel Base Code</CardTitle>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!form.pixelId}
                onClick={handleCopy}
                className="gap-1.5 text-xs h-7"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <CardDescription>
              This is the standard Meta pixel base code auto-injected by this platform. You can also paste it manually into any custom HTML if needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {form.pixelId ? (
              <pre className="bg-background border border-border rounded-lg p-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed font-mono select-all">
                {baseCode}
              </pre>
            ) : (
              <div className="bg-background border border-border rounded-lg p-4 text-xs text-muted-foreground text-center">
                Enter your Pixel ID above to generate the base code.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Domain allowlist warning */}
        <Card className="bg-card border-border border-amber-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <CardTitle className="text-base text-amber-300">Important: Add Your Domain in Meta</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              For pixel events to fire (and to pass Meta's Test Events check), your website domain must be verified and allowed in Meta Business Manager.
            </p>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-1.5 text-amber-200">
              <p className="font-semibold">Steps to allow your domain:</p>
              <ol className="space-y-1 list-none">
                {[
                  "Go to Meta Business Manager (business.facebook.com)",
                  "Navigate to Business Settings → Brand Safety → Domains",
                  "Click Add → enter your website domain (e.g. yourdomain.com)",
                  "Verify ownership using the DNS TXT record method",
                  "Once verified, pixel events will pass without restrictions",
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500/30 text-amber-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
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
              Use Meta's Test Events tool to confirm events are firing from your browser in real time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              {[
                "Make sure your domain is verified in Meta Business Manager (see above)",
                "Click the button below to open the Test Events tab directly",
                "Select Website as the channel",
                "Enter your live site URL and click Test Events",
                "Browse the site — PageView, ViewContent, Purchase etc. appear live",
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
            <CardDescription>All 5 events fire in the visitor's browser — no server configuration needed.</CardDescription>
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
