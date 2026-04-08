import { useGetPaymentHistory, getGetPaymentHistoryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

export default function PaymentsPage() {
  const { data: payments, isLoading } = useGetPaymentHistory({ query: { queryKey: getGetPaymentHistoryQueryKey() } });

  const statusColors: Record<string, string> = {
    completed: "text-green-400 border-green-400/30 bg-green-400/10",
    pending: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    failed: "text-red-400 border-red-400/30 bg-red-400/10",
    refunded: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Payment History</h1>
        <p className="text-muted-foreground mb-8">All your transactions in one place.</p>

        {isLoading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />)}</div>
        ) : !payments || payments.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No payments yet</h2>
              <p className="text-muted-foreground">Payments will appear here after you enroll in a course.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-card border-b border-border">
                <tr>{["Course", "Amount", "Gateway", "Status", "Date"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-card/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{p.course?.title ?? `Course #${p.courseId}`}</td>
                    <td className="px-4 py-3 text-sm font-bold">${p.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{p.gateway}</td>
                    <td className="px-4 py-3"><Badge className={`text-xs ${statusColors[p.status] ?? ""}`}>{p.status}</Badge></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
