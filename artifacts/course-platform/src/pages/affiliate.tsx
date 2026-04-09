import { useState } from "react";
import { useGetAffiliateDashboard, getGetAffiliateDashboardQueryKey, useListReferrals, getListReferralsQueryKey, useRequestPayout } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, DollarSign, Users, MousePointerClick, Copy, Check } from "lucide-react";

export default function AffiliatePage() {
  const { data: dashboard } = useGetAffiliateDashboard({ query: { queryKey: getGetAffiliateDashboardQueryKey() } });
  const { data: referrals } = useListReferrals({ query: { queryKey: getListReferralsQueryKey() } });
  const requestPayout = useRequestPayout();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payoutAmount, setPayoutAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PayPal");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    if (dashboard?.referralLink) {
      navigator.clipboard.writeText(dashboard.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePayoutRequest = () => {
    if (!payoutAmount || !paymentDetails) { toast({ title: "Error", description: "Fill all payout fields", variant: "destructive" }); return; }
    requestPayout.mutate({ data: { amount: parseFloat(payoutAmount), paymentMethod, paymentDetails } }, {
      onSuccess: () => { toast({ title: "Payout requested!", description: "Admin will process it soon." }); setPayoutAmount(""); setPaymentDetails(""); },
      onError: () => toast({ title: "Error", description: "Could not request payout", variant: "destructive" }),
    });
  };

  const statusColors: Record<string, string> = {
    click: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    signup: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    purchase: "text-green-400 border-green-400/30 bg-green-400/10"
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-10 max-w-5xl">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Affiliate Dashboard</h1>
        <p className="text-muted-foreground text-sm md:text-base mb-6 md:mb-8">Earn {dashboard?.commissionRate ?? 20}% commission on every referral sale.</p>

        {/* Stats — 3 cols on sm+, stacked on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <Card className="bg-card border-border">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3 mb-1"><MousePointerClick className="w-4 h-4 text-blue-400" /><span className="text-sm text-muted-foreground">Total Clicks</span></div>
              <div className="text-2xl md:text-3xl font-bold">{dashboard?.totalClicks ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3 mb-1"><Users className="w-4 h-4 text-yellow-400" /><span className="text-sm text-muted-foreground">Conversions</span></div>
              <div className="text-2xl md:text-3xl font-bold">{dashboard?.totalConversions ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3 mb-1"><DollarSign className="w-4 h-4 text-green-400" /><span className="text-sm text-muted-foreground">Total Earnings</span></div>
              <div className="text-2xl md:text-3xl font-bold">₹{(dashboard?.totalEarnings ?? 0).toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-8">
          {/* Referral link */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3"><CardTitle className="text-sm md:text-base">Your Referral Link</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={dashboard?.referralLink ?? ""} readOnly className="bg-background text-xs md:text-sm font-mono min-w-0" />
                <Button variant="outline" onClick={copyLink} className="flex-shrink-0 gap-1.5">
                  {copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Code: <span className="font-mono font-bold">{dashboard?.referralCode}</span></p>
              <div className="mt-4 p-3 rounded-lg bg-background border border-border space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pending</span><span className="text-yellow-400 font-bold">₹{(dashboard?.pendingEarnings ?? 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid Out</span><span className="text-green-400 font-bold">₹{(dashboard?.paidEarnings ?? 0).toFixed(2)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Payout */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3"><CardTitle className="text-sm md:text-base">Request Payout</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Amount (INR)" type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} className="bg-background" />
              <Input placeholder="Payment method (PayPal, Bank, etc.)" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="bg-background" />
              <Input placeholder="Payment details (email, account, etc.)" value={paymentDetails} onChange={e => setPaymentDetails(e.target.value)} className="bg-background" />
              <Button onClick={handlePayoutRequest} className="w-full" disabled={requestPayout.isPending}>Request Payout</Button>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Referral History</h2>
        {!referrals || referrals.length === 0 ? (
          <Card className="bg-card border-border"><CardContent className="py-12 text-center text-muted-foreground text-sm">No referrals yet. Share your link!</CardContent></Card>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-card border-b border-border">
                  <tr>{["User", "Status", "Commission", "Date"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {referrals.map(r => (
                    <tr key={r.id} className="hover:bg-card/50 transition-colors">
                      <td className="px-4 py-3 text-sm">{r.referredUserName}</td>
                      <td className="px-4 py-3"><Badge className={`text-xs ${statusColors[r.status] ?? ""}`}>{r.status}</Badge></td>
                      <td className="px-4 py-3 text-sm font-medium">{r.commission ? `₹${r.commission.toFixed(2)}` : "-"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {referrals.map(r => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium text-sm">{r.referredUserName}</span>
                    <Badge className={`text-xs ${statusColors[r.status] ?? ""}`}>{r.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                    <span className="font-semibold text-foreground">{r.commission ? `₹${r.commission.toFixed(2)}` : "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
