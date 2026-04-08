import { useState, useEffect } from "react";
import { useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettingsPage() {
  const { data: settings } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const updateSettings = useUpdateAdminSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ siteName: "", siteDescription: "", commissionRate: 20, currency: "USD", stripeEnabled: true, razorpayEnabled: false, emailNotificationsEnabled: true });

  useEffect(() => {
    if (settings) setForm({ siteName: settings.siteName, siteDescription: settings.siteDescription, commissionRate: settings.commissionRate, currency: settings.currency, stripeEnabled: settings.stripeEnabled, razorpayEnabled: settings.razorpayEnabled, emailNotificationsEnabled: settings.emailNotificationsEnabled });
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({ data: form }, {
      onSuccess: () => { toast({ title: "Settings saved!" }); queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() }); },
      onError: () => toast({ title: "Error saving settings", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6"><h1 className="text-2xl font-bold">Platform Settings</h1><p className="text-muted-foreground">Configure your platform.</p></div>

      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label className="text-sm mb-1.5 block">Platform Name</Label><Input value={form.siteName} onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))} className="bg-background" /></div>
            <div><Label className="text-sm mb-1.5 block">Description</Label><textarea value={form.siteDescription} onChange={e => setForm(f => ({ ...f, siteDescription: e.target.value }))} className="w-full p-3 rounded-md bg-background border border-border text-sm resize-none h-20" /></div>
            <div><Label className="text-sm mb-1.5 block">Currency</Label><Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="bg-background w-32" /></div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">Affiliate Commission</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Input type="number" value={form.commissionRate} onChange={e => setForm(f => ({ ...f, commissionRate: parseFloat(e.target.value) || 0 }))} className="bg-background w-24" min="0" max="100" />
              <span className="text-muted-foreground">% commission on each sale</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">Payment Gateways</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium">Stripe</p><p className="text-xs text-muted-foreground">International payments</p></div>
              <Switch checked={form.stripeEnabled} onCheckedChange={v => setForm(f => ({ ...f, stripeEnabled: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium">Razorpay</p><p className="text-xs text-muted-foreground">India payments</p></div>
              <Switch checked={form.razorpayEnabled} onCheckedChange={v => setForm(f => ({ ...f, razorpayEnabled: v }))} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium">Email Notifications</p><p className="text-xs text-muted-foreground">Send emails for signups, purchases, etc.</p></div>
              <Switch checked={form.emailNotificationsEnabled} onCheckedChange={v => setForm(f => ({ ...f, emailNotificationsEnabled: v }))} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
