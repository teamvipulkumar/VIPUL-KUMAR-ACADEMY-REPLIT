import { useState } from "react";
import {
  useAdminListUsers, getAdminListUsersQueryKey,
  useAdminGetUser, getAdminGetUserQueryKey,
  useAdminUpdateUser, useBanUser,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, Search, Eye, Pencil, Trash2, ShieldCheck,
  GraduationCap, Share2, Mail, Calendar, BookOpen, BadgeIndianRupee,
  MoreHorizontal, CheckCircle, XCircle, Lock
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type User = {
  id: number; name: string; email: string; role: string;
  isBanned: boolean; createdAt: string; avatarUrl?: string | null; referralCode?: string | null;
  phone?: string | null;
};

const roleColors: Record<string, string> = {
  admin: "text-red-400 border-red-400/30 bg-red-400/10",
  student: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  affiliate: "text-purple-400 border-purple-400/30 bg-purple-400/10",
};
const roleIcons: Record<string, React.ElementType> = {
  admin: ShieldCheck, student: GraduationCap, affiliate: Share2,
};

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-9 h-9 text-sm";
  const colors = ["bg-blue-600", "bg-purple-600", "bg-green-600", "bg-orange-600", "bg-pink-600", "bg-teal-600"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Add User Dialog ───────────────────────────────────────────────────────────
function AddUserDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create user");
      toast({ title: "User created", description: `${form.name} has been added.` });
      onSuccess();
      onClose();
      setForm({ name: "", email: "", password: "", role: "student" });
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0d1424] border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" />Add New User</DialogTitle>
          <DialogDescription>Create a new user account manually.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="add-name">Full Name</Label>
            <Input id="add-name" placeholder="John Doe" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required className="bg-card border-border" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-email">Email Address</Label>
            <Input id="add-email" type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required className="bg-card border-border" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-password">Password</Label>
            <Input id="add-password" type="password" placeholder="Minimum 6 characters" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6} className="bg-card border-border" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-role">Role</Label>
            <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
              <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="affiliate">Affiliate</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/10">Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-primary">
              {loading ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit User Dialog ──────────────────────────────────────────────────────────
function EditUserDialog({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, role: user.role, password: "", phone: user.phone ?? "" });
  const updateUser = useAdminUpdateUser();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role,
          phone: form.phone,
          ...(form.password ? { password: form.password } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update user");
      toast({ title: "User updated", description: `${form.name}'s profile has been saved.` });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0d1424] border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Edit User</DialogTitle>
          <DialogDescription>Update {user.name}'s account details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required className="bg-card border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required className="bg-card border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
              <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="affiliate">Affiliate</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mobile Number</Label>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              className="bg-card border-border"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Lock className="w-3 h-3" />New Password <span className="text-muted-foreground text-xs">(leave blank to keep current)</span></Label>
            <Input type="password" placeholder="Enter new password to reset..." value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="bg-card border-border" />
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/10">Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-primary">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── View Profile Dialog ───────────────────────────────────────────────────────
function ViewProfileDialog({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data: user, isLoading } = useAdminGetUser(userId, {
    query: { queryKey: getAdminGetUserQueryKey(userId) }
  });

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg bg-[#0d1424] border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye className="w-4 h-4 text-primary" />User Profile</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">Loading profile...</div>
        ) : user ? (
          <div className="space-y-5 mt-1">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 bg-card/50 rounded-xl border border-border">
              <Avatar name={user.name} size="lg" />
              <div>
                <p className="font-bold text-lg text-foreground">{user.name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{user.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={`text-xs ${roleColors[user.role] ?? ""}`}>{user.role}</Badge>
                  <Badge className={`text-xs ${user.isBanned ? "text-red-400 border-red-400/30 bg-red-400/10" : "text-green-400 border-green-400/30 bg-green-400/10"}`}>
                    {user.isBanned ? "Banned" : "Active"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Courses", value: (user as { enrollmentCount?: number }).enrollmentCount ?? 0, icon: BookOpen, color: "text-blue-400" },
                { label: "Total Spent", value: `₹${((user as { totalSpent?: number }).totalSpent ?? 0).toFixed(0)}`, icon: BadgeIndianRupee, color: "text-green-400" },
                { label: "Affiliate Earnings", value: `₹${((user as { affiliateEarnings?: number }).affiliateEarnings ?? 0).toFixed(0)}`, icon: Share2, color: "text-purple-400" },
              ].map(stat => (
                <div key={stat.label} className="p-3 bg-card/50 rounded-xl border border-border text-center">
                  <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
                  <p className="text-base font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Meta */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Joined</span>
                <span className="text-foreground font-medium">{new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              {user.referralCode && (
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" />Referral Code</span>
                  <code className="bg-card px-2 py-0.5 rounded text-xs font-mono text-primary">{user.referralCode}</code>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">User ID</span>
                <span className="text-muted-foreground font-mono text-xs">#{user.id}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">User not found.</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/10">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Confirmation ───────────────────────────────────────────────────────
function DeleteDialog({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${user.id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Delete failed"); }
      toast({ title: "User deleted", description: `${user.name} has been removed.` });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm bg-[#0d1424] border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400"><Trash2 className="w-4 h-4" />Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete <strong className="text-foreground">{user.name}</strong>? This action cannot be undone and will remove all their data.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose} className="border-white/10">Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting..." : "Delete User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useAdminListUsers(
    { search: debouncedSearch || undefined, role: role === "all" ? undefined : role, limit: 100, offset: 0 },
    { query: { queryKey: getAdminListUsersQueryKey({ search: debouncedSearch, role }) } }
  );

  const banUser = useBanUser();

  const handleSearch = (v: string) => {
    setSearch(v);
    setTimeout(() => setDebouncedSearch(v), 400);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey({}) });

  const handleBan = (userId: number, banned: boolean, name: string) => {
    banUser.mutate({ userId, data: { banned } }, {
      onSuccess: () => { toast({ title: banned ? `${name} banned` : `${name} unbanned` }); refresh(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  // Client-side status filter
  const users = (data?.users ?? []).filter(u => {
    if (status === "active") return !u.isBanned;
    if (status === "banned") return u.isBanned;
    return true;
  });

  const roleCounts = {
    total: data?.total ?? 0,
    admin: (data?.users ?? []).filter(u => u.role === "admin").length,
    student: (data?.users ?? []).filter(u => u.role === "student").length,
    affiliate: (data?.users ?? []).filter(u => u.role === "affiliate").length,
  };

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{roleCounts.total} total users</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-primary hover:bg-primary/90 gap-2 self-start sm:self-auto">
          <UserPlus className="w-4 h-4" />Add User
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Users", value: roleCounts.total, color: "text-foreground" },
          { label: "Admins", value: roleCounts.admin, color: "text-red-400" },
          { label: "Students", value: roleCounts.student, color: "text-blue-400" },
          { label: "Affiliates", value: roleCounts.affiliate, color: "text-purple-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-full sm:w-36 bg-card border-border"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="affiliate">Affiliate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-36 bg-card border-border"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No users found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-card border-b border-border">
              <tr>
                {["User", "Role", "Status", "Joined", "Actions"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => {
                const RoleIcon = roleIcons[u.role] ?? GraduationCap;
                return (
                  <tr key={u.id} className="hover:bg-card/40 transition-colors group">
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="w-3 h-3 flex-shrink-0" />{u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <Badge className={`text-xs gap-1 ${roleColors[u.role] ?? ""}`}>
                        <RoleIcon className="w-3 h-3" />{u.role}
                      </Badge>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      {u.isBanned ? (
                        <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3.5 h-3.5" />Banned</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="w-3.5 h-3.5" />Active</span>
                      )}
                    </td>
                    {/* Joined */}
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5"
                          onClick={() => setViewingUser(u)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => setEditingUser(u)}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:bg-white/5">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 bg-[#0d1424] border-white/10">
                            <DropdownMenuItem
                              onClick={() => handleBan(u.id, !u.isBanned, u.name)}
                              className={u.isBanned ? "text-green-400 focus:text-green-400 focus:bg-green-500/10" : "text-orange-400 focus:text-orange-400 focus:bg-orange-500/10"}
                            >
                              {u.isBanned ? <CheckCircle className="w-3.5 h-3.5 mr-2" /> : <XCircle className="w-3.5 h-3.5 mr-2" />}
                              {u.isBanned ? "Unban User" : "Ban User"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingUser(u)}
                              className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialogs */}
      <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} onSuccess={refresh} />
      {viewingUser && <ViewProfileDialog userId={viewingUser.id} onClose={() => setViewingUser(null)} />}
      {editingUser && <EditUserDialog user={editingUser} onClose={() => setEditingUser(null)} onSuccess={refresh} />}
      {deletingUser && <DeleteDialog user={deletingUser} onClose={() => setDeletingUser(null)} onSuccess={refresh} />}
    </div>
  );
}
