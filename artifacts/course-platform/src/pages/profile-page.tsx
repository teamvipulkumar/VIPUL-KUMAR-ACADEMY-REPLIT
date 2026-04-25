import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, Mail, ShieldCheck, Loader2, Check, Camera, X } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState((user as any)?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string>((user as any)?.avatarUrl ?? "");
  const [avatarUploading, setAvatarUploading] = useState(false);

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

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image must be under 10 MB", variant: "destructive" });
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const uploadRes = await fetch(`${BASE_URL}/api/upload/image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload failed");
      }
      const { url } = await uploadRes.json();
      const fullUrl = `${BASE_URL}${url}`;

      const patchRes = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: fullUrl }),
      });
      if (!patchRes.ok) {
        const data = await patchRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save photo");
      }

      setAvatarUrl(fullUrl);
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profile photo updated!" });
    } catch (err: any) {
      toast({ title: err.message ?? "Upload failed", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: "" }),
      });
      if (!res.ok) throw new Error("Failed to remove photo");
      setAvatarUrl("");
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profile photo removed" });
    } catch (err: any) {
      toast({ title: err.message ?? "Failed to remove photo", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
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

          {/* Clickable avatar */}
          <div className="relative flex-shrink-0 group">
            <div
              className="w-20 h-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center cursor-pointer ring-2 ring-border group-hover:ring-primary/50 transition-all"
              onClick={() => !avatarUploading && fileInputRef.current?.click()}
            >
              {avatarUploading ? (
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile photo"
                  className="w-full h-full object-cover"
                  onError={() => setAvatarUrl("")}
                />
              ) : (
                <span className="text-3xl font-bold text-primary">
                  {(user?.name ?? "?").charAt(0).toUpperCase()}
                </span>
              )}

              {/* Hover overlay */}
              {!avatarUploading && (
                <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>

            {/* Remove button (shown when avatar exists) */}
            {avatarUrl && !avatarUploading && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleRemoveAvatar(); }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/80 transition-colors cursor-pointer z-10"
                title="Remove photo"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-lg text-foreground truncate">{user?.name}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-primary font-medium capitalize">{(user as any)?.role ?? "user"}</span>
            </div>
            <button
              type="button"
              onClick={() => !avatarUploading && fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="mt-2 text-xs text-primary hover:underline disabled:opacity-50 cursor-pointer"
            >
              {avatarUploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={e => handleAvatarFile(e.target.files?.[0])}
          />
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
