import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, CheckCircle2, Clock, Lock, Upload, X, FileImage,
  AlertCircle, Loader2,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface KycData {
  kyc: {
    panName: string | null;
    panNumber: string | null;
    panFrontUrl: string | null;
    idProofUrl: string | null;
    addressProofUrl: string | null;
    status: "pending" | "approved" | "rejected" | null;
    adminNote: string | null;
    reviewedAt: string | null;
    locked: boolean;
    submitted: boolean;
  };
  bank: {
    accountHolderName: string | null;
    accountNumber: string | null;
    ifscCode: string | null;
    bankName: string | null;
    upiId: string | null;
  };
}

async function fetchKyc(): Promise<KycData> {
  const res = await fetch(`${API_BASE}/api/creator/kyc`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function saveKyc(payload: Partial<KycData>): Promise<void> {
  const res = await fetch(`${API_BASE}/api/creator/kyc`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Save failed");
  }
}

export default function CreatorKycPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["creator-kyc"], queryFn: fetchKyc });
  const [bankForm, setBankForm] = useState<KycData["bank"] | null>(null);

  useEffect(() => { if (data) setBankForm(data.bank); }, [data]);

  const bankMut = useMutation({
    mutationFn: (bank: KycData["bank"]) => saveKyc({ bank: bank as any }),
    onSuccess: () => {
      toast({ title: "Bank details saved" });
      qc.invalidateQueries({ queryKey: ["creator-kyc"] });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  function setBank<K extends keyof KycData["bank"]>(field: K, value: KycData["bank"][K]) {
    setBankForm(prev => prev ? { ...prev, [field]: value } : prev);
  }

  if (isLoading || !data || !bankForm) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">KYC &amp; Bank Details</h1>
        <p className="text-sm text-muted-foreground">
          Submit your PAN details for verification. Once submitted, your KYC fields are locked until admin reviews them.
        </p>
      </div>

      {/* KYC section — affiliate-style 3-state UI */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">KYC Verification</h2>
        <p className="text-xs text-muted-foreground mb-3">Submit identity documents to enable payouts.</p>
        <KycSection
          kyc={data.kyc}
          onSaved={() => qc.invalidateQueries({ queryKey: ["creator-kyc"] })}
        />
      </div>

      {/* Bank Account — always editable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="holder">Account Holder Name</Label>
            <Input id="holder" value={bankForm.accountHolderName ?? ""} onChange={e => setBank("accountHolderName", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="accno">Account Number</Label>
              <Input id="accno" value={bankForm.accountNumber ?? ""} onChange={e => setBank("accountNumber", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ifsc">IFSC Code</Label>
              <Input id="ifsc" value={bankForm.ifscCode ?? ""} onChange={e => setBank("ifscCode", e.target.value.toUpperCase())} className="uppercase" />
            </div>
          </div>
          <div>
            <Label htmlFor="bank">Bank Name</Label>
            <Input id="bank" value={bankForm.bankName ?? ""} onChange={e => setBank("bankName", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="upi">UPI ID (optional)</Label>
            <Input id="upi" value={bankForm.upiId ?? ""} onChange={e => setBank("upiId", e.target.value)} placeholder="yourname@bankupi" />
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => bankMut.mutate(bankForm!)} disabled={bankMut.isPending} data-testid="button-save-bank">
              {bankMut.isPending ? "Saving…" : "Save Bank Details"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── KYC section — mirrors affiliate KYC tab UX ─── */
function KycSection({ kyc, onSaved }: { kyc: KycData["kyc"]; onSaved: () => void }) {
  const { toast } = useToast();
  const [panName, setPanName] = useState(kyc.panName ?? "");
  const [panNumber, setPanNumber] = useState(kyc.panNumber ?? "");
  const [panPhotoUrl, setPanPhotoUrl] = useState(kyc.panFrontUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sync local form state when server state changes (after admin review).
  useEffect(() => {
    setPanName(kyc.panName ?? "");
    setPanNumber(kyc.panNumber ?? "");
    setPanPhotoUrl(kyc.panFrontUrl ?? "");
  }, [kyc.panName, kyc.panNumber, kyc.panFrontUrl, kyc.status]);

  const handlePanPhoto = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setUploadError("Please select an image file (JPEG, PNG, WebP)."); return; }
    if (file.size > 1 * 1024 * 1024) { setUploadError("PAN photo must be smaller than 1 MB."); return; }
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`${API_BASE}/api/upload/image`, {
        method: "POST", credentials: "include", body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPanPhotoUrl(data.url);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  const save = async () => {
    if (!panName.trim()) { toast({ title: "Name as per PAN is required", variant: "destructive" }); return; }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber.trim().toUpperCase())) {
      toast({ title: "Invalid PAN", description: "Format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).", variant: "destructive" });
      return;
    }
    if (!panPhotoUrl) { toast({ title: "Please upload your PAN front photo", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/creator/kyc`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kyc: {
            panName: panName.trim(),
            panNumber: panNumber.trim().toUpperCase(),
            panFrontUrl: panPhotoUrl,
          },
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Failed");
      }
      toast({ title: "KYC submitted!", description: "Under review by admin." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Failed to submit KYC", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  /* ── "Pending" state — under review ── */
  if (kyc.status === "pending") {
    return (
      <div className="max-w-lg space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">KYC Under Review</h3>
            <p className="text-sm text-muted-foreground mt-1">Your documents have been submitted successfully and are being reviewed by our team.</p>
          </div>
          <div className="p-3 bg-amber-400/5 border border-amber-400/20 rounded-xl text-left space-y-2">
            <p className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />Estimated review time: up to 24 hours
            </p>
            <p className="text-xs text-muted-foreground">You'll be notified once your KYC is approved or if any action is required.</p>
          </div>
          <SubmittedDetails kyc={kyc} label="Submitted Details" />
        </div>
      </div>
    );
  }

  /* ── "Approved" state ── */
  if (kyc.status === "approved") {
    return (
      <div className="max-w-lg space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">KYC Verified</h3>
            <p className="text-sm text-muted-foreground mt-1">Your identity has been successfully verified. You're fully activated as a creator.</p>
          </div>
          <SubmittedDetails kyc={kyc} label="Verified Details" />
        </div>
      </div>
    );
  }

  /* ── Form (first submit OR resubmit after rejection) ── */
  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">KYC Verification</h3>
          {kyc.status === "rejected" ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-400/30 bg-red-400/10 text-red-400 font-medium uppercase tracking-wide">Rejected</span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-background text-muted-foreground font-medium uppercase tracking-wide">Not Submitted</span>
          )}
        </div>
        {kyc.status === "rejected" && kyc.adminNote && (
          <div className="mb-4 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
            <p className="text-xs font-medium text-red-400 mb-1">Admin Note:</p>
            <p className="text-sm text-muted-foreground">{kyc.adminNote}</p>
          </div>
        )}
        <div className="space-y-4">
          {/* Field 1 — Name as Per PAN */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name as Per PAN <span className="text-red-400">*</span></Label>
            <Input
              value={panName}
              onChange={e => setPanName(e.target.value)}
              placeholder="Enter your name exactly as on PAN card"
              className="bg-background border-border"
              data-testid="input-pan-name"
            />
          </div>

          {/* Field 2 — PAN Number */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">PAN Number <span className="text-red-400">*</span></Label>
            <Input
              value={panNumber}
              onChange={e => setPanNumber(e.target.value.toUpperCase())}
              placeholder="e.g. ABCDE1234F"
              maxLength={10}
              className="bg-background border-border font-mono uppercase tracking-widest"
              data-testid="input-pan-number"
            />
          </div>

          {/* Field 3 — PAN Front Photo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">PAN Front Photo <span className="text-red-400">*</span> <span className="text-muted-foreground/60">(Max 1 MB)</span></Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => handlePanPhoto(e.target.files?.[0])}
            />
            {panPhotoUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <img src={panPhotoUrl} alt="PAN front photo" className="w-full h-40 object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-white text-sm font-medium bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <Upload className="w-3.5 h-3.5" /> Replace Photo
                  </div>
                </div>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setPanPhotoUrl(""); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer"
                data-testid="button-upload-pan"
              >
                {uploading ? (
                  <><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="text-xs text-primary">Uploading…</span></>
                ) : (
                  <><FileImage className="w-6 h-6" /><span className="text-xs">Click to upload PAN front photo</span><span className="text-[11px] text-muted-foreground/60">JPG, PNG, WebP · Max 1 MB</span></>
                )}
              </button>
            )}
            {uploadError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" />{uploadError}</p>
            )}
          </div>

          <div className="p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg">
            <p className="text-xs text-amber-300 flex items-center gap-1.5"><Lock className="w-3 h-3" />Stored securely · used only for KYC & TDS purposes.</p>
          </div>
          <Button onClick={save} disabled={saving || uploading} className="w-full bg-primary gap-2" data-testid="button-submit-kyc">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {saving ? "Submitting…" : kyc.status === "rejected" ? "Resubmit KYC" : "Submit KYC"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Submitted/Verified details card (shared by pending + approved states) ─── */
function SubmittedDetails({ kyc, label }: { kyc: KycData["kyc"]; label: string }) {
  return (
    <div className="text-left space-y-2 pt-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="bg-background border border-border rounded-xl p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Name as Per PAN</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{kyc.panName ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">PAN Number</p>
            <p className="text-sm font-mono font-medium text-foreground mt-0.5 tracking-widest">{kyc.panNumber ?? "—"}</p>
          </div>
        </div>
        {kyc.panFrontUrl && (
          <div>
            <p className="text-[11px] text-muted-foreground">PAN Front Photo</p>
            <img src={kyc.panFrontUrl} alt="PAN" className="mt-1.5 w-full max-h-40 object-cover rounded-lg border border-border" />
          </div>
        )}
      </div>
    </div>
  );
}
