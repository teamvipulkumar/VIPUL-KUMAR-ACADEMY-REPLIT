import { useAdminListAffiliates, getAdminListAffiliatesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminAffiliatesPage() {
  const { data: affiliates, isLoading } = useAdminListAffiliates({ query: { queryKey: getAdminListAffiliatesQueryKey() } });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Affiliates</h1>
        <p className="text-muted-foreground">Overview of all affiliate partners.</p>
      </div>
      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-card rounded animate-pulse" />)}</div> : !affiliates || affiliates.length === 0 ? (
        <Card className="bg-card border-border"><CardContent className="py-12 text-center text-muted-foreground">No affiliates with activity yet.</CardContent></Card>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-card border-b border-border"><tr>{["Name", "Email", "Code", "Clicks", "Conversions", "Earnings", "Pending"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {affiliates.map(a => (
                <tr key={a.id} className="hover:bg-card/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-sm">{a.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{a.email}</td>
                  <td className="px-4 py-3 text-sm font-mono">{a.referralCode}</td>
                  <td className="px-4 py-3 text-sm">{a.totalClicks}</td>
                  <td className="px-4 py-3 text-sm">{a.totalConversions}</td>
                  <td className="px-4 py-3 text-sm font-bold text-green-400">₹{a.totalEarnings.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-yellow-400">₹{a.pendingEarnings.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
