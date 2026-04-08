import { useState } from "react";
import { useAdminListUsers, getAdminListUsersQueryKey, useBanUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data, isLoading } = useAdminListUsers({ search: debouncedSearch || undefined, role: role === "all" ? undefined : role, limit: 50, offset: 0 }, { query: { queryKey: getAdminListUsersQueryKey({ search: debouncedSearch, role }) } });
  const banUser = useBanUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSearch = (v: string) => { setSearch(v); setTimeout(() => setDebouncedSearch(v), 400); };

  const handleBan = (userId: number, banned: boolean) => {
    banUser.mutate({ userId, data: { banned } }, {
      onSuccess: () => { toast({ title: banned ? "User banned" : "User unbanned" }); queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey({}) }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const roleColors: Record<string, string> = { admin: "text-red-400 border-red-400/30 bg-red-400/10", student: "text-blue-400 border-blue-400/30 bg-blue-400/10", affiliate: "text-purple-400 border-purple-400/30 bg-purple-400/10" };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Users</h1><p className="text-muted-foreground">{data?.total ?? 0} total users</p></div>
      </div>
      <div className="flex gap-4 mb-6">
        <Input placeholder="Search users..." value={search} onChange={e => handleSearch(e.target.value)} className="max-w-sm bg-card border-border" />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-40 bg-card border-border"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="affiliate">Affiliate</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-card rounded animate-pulse" />)}</div> : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-card border-b border-border"><tr>{["Name", "Email", "Role", "Status", "Joined", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {(data?.users ?? []).map(u => (
                <tr key={u.id} className="hover:bg-card/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-sm">{u.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3"><Badge className={`text-xs ${roleColors[u.role] ?? ""}`}>{u.role}</Badge></td>
                  <td className="px-4 py-3"><Badge className={`text-xs ${u.isBanned ? "text-red-400 border-red-400/30 bg-red-400/10" : "text-green-400 border-green-400/30 bg-green-400/10"}`}>{u.isBanned ? "Banned" : "Active"}</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant={u.isBanned ? "outline" : "destructive"} className="text-xs h-7" onClick={() => handleBan(u.id, !u.isBanned)}>
                      {u.isBanned ? "Unban" : "Ban"}
                    </Button>
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
