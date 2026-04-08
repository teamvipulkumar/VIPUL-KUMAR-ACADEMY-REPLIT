import { useAdminListPayouts, getAdminListPayoutsQueryKey, useApprovePayout, useRejectPayout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle } from "lucide-react";

export default function AdminPayoutsPage() {
  const { data: payouts, isLoading } = useAdminListPayouts({ query: { queryKey: getAdminListPayoutsQueryKey() } });
  const approvePayout = useApprovePayout();
  const rejectPayout = useRejectPayout();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleApprove = (id: number) => {
    approvePayout.mutate({ payoutId: id }, {
      onSuccess: () => { toast({ title: "Payout approved" }); queryClient.invalidateQueries({ queryKey: getAdminListPayoutsQueryKey() }); },
    });
  };

  const handleReject = (id: number) => {
    rejectPayout.mutate({ payoutId: id, data: { reason: "Does not meet requirements" } }, {
      onSuccess: () => { toast({ title: "Payout rejected" }); queryClient.invalidateQueries({ queryKey: getAdminListPayoutsQueryKey() }); },
    });
  };

  const statusColors: Record<string, string> = { pending: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10", approved: "text-green-400 border-green-400/30 bg-green-400/10", rejected: "text-red-400 border-red-400/30 bg-red-400/10" };

  return (
    <div className="p-6">
      <div className="mb-6"><h1 className="text-2xl font-bold">Payout Requests</h1><p className="text-muted-foreground">Review and approve affiliate payouts.</p></div>
      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded animate-pulse" />)}</div> : !payouts || payouts.length === 0 ? (
        <Card className="bg-card border-border"><CardContent className="py-12 text-center text-muted-foreground">No payout requests.</CardContent></Card>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-card border-b border-border"><tr>{["Affiliate", "Amount", "Method", "Details", "Status", "Requested", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {payouts.map(p => (
                <tr key={p.id} className="hover:bg-card/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-sm">{p.userName}</td>
                  <td className="px-4 py-3 text-sm font-bold">${p.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{p.paymentMethod}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{p.paymentDetails}</td>
                  <td className="px-4 py-3"><Badge className={`text-xs ${statusColors[p.status] ?? ""}`}>{p.status}</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(p.requestedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {p.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-400" onClick={() => handleApprove(p.id)}><CheckCircle className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => handleReject(p.id)}><XCircle className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
