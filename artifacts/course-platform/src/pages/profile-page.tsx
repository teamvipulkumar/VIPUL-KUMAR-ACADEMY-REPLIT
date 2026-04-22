import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, Mail, ShieldCheck, Loader2, Check } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState((user as any)?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty =
    name.trim() !== (user?.name ?? "").trim() ||
    phone.trim() !== ((user as any)?.phone ?? "").trim();

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name cannot be empty", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Failed to update profile", variant: "destructive" });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({ title: "Profile updated!" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-2xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your personal information</p>
        </div>

        {/* Avatar + summary card */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-primary">
              {(user?.name ?? "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-lg text-foreground truncate">{user?.name}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-primary font-medium capitalize">{(user as any)?.role ?? "user"}</span>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest text-muted-foreground">Edit Details</h2>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="flex items-center gap-1.5 text-sm font-medium">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              Full Name
            </Label>
            <Input
              id="profile-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="bg-background border-border"
              onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Mail className="w-3.5 h-3.5" />
              Email Address
              <span className="text-[10px] ml-1 bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-normal">Read-only</span>
            </Label>
            <Input
              value={user?.email ?? ""}
              readOnly
              disabled
              className="bg-muted border-border text-muted-foreground cursor-not-allowed"
            />
          </div>

          {/* Mobile */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone" className="flex items-center gap-1.5 text-sm font-medium">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              Mobile Number
            </Label>
            <Input
              id="profile-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="bg-background border-border"
              type="tel"
              onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
            />
            <p className="text-[11px] text-muted-foreground">Used for GST invoices and support contact</p>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="gap-2 bg-primary hover:bg-primary/90 cursor-pointer"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
              ) : saved ? (
                <><Check className="w-4 h-4" />Saved!</>
              ) : (
                "Save Changes"
              )}
            </Button>
            {isDirty && !saving && (
              <button
                onClick={() => { setName(user?.name ?? ""); setPhone((user as any)?.phone ?? ""); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Discard
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
