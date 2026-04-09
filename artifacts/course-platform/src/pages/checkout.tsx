import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useGetCourse, useValidateCoupon } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Lock, Check, Tag, CreditCard, ChevronLeft,
  BookOpen, Users, Clock, Award, Eye, EyeOff, PartyPopper, Copy,
  X, Smartphone, Wallet, AlertCircle, Loader2,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand",
  "West Bengal","Delhi","Jammu & Kashmir","Ladakh","Chandigarh","Puducherry",
];

type SuccessResult = {
  isNewUser: boolean;
  tempPassword?: string;
  user: { name: string; email: string };
  courseId: number;
  courseTitle: string;
};

// ── Stripe Card Number Formatter ─────────────────────────────────────────────
function fmtCard(v: string) { return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim(); }
function fmtExpiry(v: string) { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d; }

// ── Payment Gateway Simulation Modal ─────────────────────────────────────────
type PaymentModalProps = {
  gateway: "stripe" | "razorpay";
  amount: number;
  courseName: string;
  onClose: () => void;
  onPay: () => Promise<void>;
};

function PaymentModal({ gateway, amount, courseName, onClose, onPay }: PaymentModalProps) {
  const [tab, setTab] = useState<"upi" | "card" | "wallet">("upi");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [upi, setUpi] = useState("");
  const [wallet, setWallet] = useState("");
  const [step, setStep] = useState<"form" | "processing" | "verifying">("form");
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  const validateStripe = () => {
    const raw = card.number.replace(/\s/g, "");
    if (raw.length < 16) return "Enter a valid 16-digit card number";
    const [m, y] = card.expiry.split("/");
    const month = parseInt(m ?? "0"), year = 2000 + parseInt(y ?? "0");
    const now = new Date();
    if (!m || !y || month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return "Enter a valid expiry date";
    if (card.cvv.length < 3) return "Enter a valid CVV";
    if (!card.name.trim()) return "Enter the cardholder name";
    return "";
  };

  const validateRazorpay = () => {
    if (tab === "upi") {
      if (!upi.includes("@") || upi.length < 5) return "Enter a valid UPI ID (e.g., name@upi)";
    }
    if (tab === "card") {
      const raw = card.number.replace(/\s/g, "");
      if (raw.length < 16) return "Enter a valid card number";
      if (card.cvv.length < 3) return "Enter a valid CVV";
    }
    if (tab === "wallet" && !wallet) return "Select a wallet";
    return "";
  };

  const handlePay = async () => {
    setError("");
    const err = gateway === "stripe" ? validateStripe() : validateRazorpay();
    if (err) { setError(err); return; }

    setStep("processing");
    await new Promise(r => setTimeout(r, 1500));
    setStep("verifying");
    await new Promise(r => setTimeout(r, 1200));
    await onPay();
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="bg-[#0d1424] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`px-5 pt-5 pb-4 flex items-center justify-between ${gateway === "stripe" ? "bg-[#635BFF]/10 border-b border-[#635BFF]/20" : "bg-blue-500/10 border-b border-blue-500/20"}`}>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{gateway === "stripe" ? "💳" : "🇮🇳"}</span>
            <div>
              <p className="font-bold text-sm text-foreground">{gateway === "stripe" ? "Stripe Checkout" : "Razorpay"}</p>
              <p className="text-xs text-muted-foreground">{courseName}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg text-foreground">${amount.toFixed(2)}</p>
            <div className="flex items-center gap-1 text-[10px] text-green-400 justify-end">
              <Lock className="w-2.5 h-2.5" />Secure
            </div>
          </div>
        </div>

        {/* Processing overlay */}
        {(step === "processing" || step === "verifying") && (
          <div className="px-5 py-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
            <div>
              <p className="font-semibold text-foreground">{step === "processing" ? "Processing Payment..." : "Verifying with bank..."}</p>
              <p className="text-xs text-muted-foreground mt-1">Please do not close this window</p>
            </div>
            <div className="flex justify-center gap-1 pt-2">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}

        {/* Form */}
        {step === "form" && (
          <div className="p-5 space-y-4">
            {gateway === "stripe" ? (
              /* ── Stripe Card Form ── */
              <div className="space-y-3.5">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Card Number</Label>
                  <div className="relative">
                    <Input
                      placeholder="1234 5678 9012 3456"
                      value={card.number}
                      onChange={e => setCard(c => ({ ...c, number: fmtCard(e.target.value) }))}
                      className="bg-background border-border font-mono pr-10"
                      maxLength={19}
                    />
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Expiry (MM/YY)</Label>
                    <Input
                      placeholder="MM/YY"
                      value={card.expiry}
                      onChange={e => setCard(c => ({ ...c, expiry: fmtExpiry(e.target.value) }))}
                      className="bg-background border-border font-mono"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">CVV</Label>
                    <Input
                      placeholder="•••"
                      type="password"
                      value={card.cvv}
                      onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      className="bg-background border-border font-mono"
                      maxLength={4}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Name on Card</Label>
                  <Input
                    placeholder="John Doe"
                    value={card.name}
                    onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
                    className="bg-background border-border"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-center">Use any valid-looking test card (e.g. 4242 4242 4242 4242)</p>
              </div>
            ) : (
              /* ── Razorpay Form ── */
              <div className="space-y-3">
                {/* Tabs */}
                <div className="grid grid-cols-3 gap-1.5 bg-background rounded-lg p-1">
                  {(["upi", "card", "wallet"] as const).map(t => (
                    <button key={t} type="button" onClick={() => { setTab(t); setError(""); }}
                      className={`py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1 transition-colors ${tab === t ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
                      {t === "upi" && <Smartphone className="w-3 h-3" />}
                      {t === "card" && <CreditCard className="w-3 h-3" />}
                      {t === "wallet" && <Wallet className="w-3 h-3" />}
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>

                {tab === "upi" && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">UPI ID</Label>
                    <Input placeholder="yourname@upi" value={upi} onChange={e => setUpi(e.target.value)} className="bg-background border-border font-mono" />
                    <p className="text-[10px] text-muted-foreground mt-1">Enter any valid-looking UPI ID (e.g. test@upi)</p>
                  </div>
                )}

                {tab === "card" && (
                  <div className="space-y-2.5">
                    <Input placeholder="Card Number (16 digits)" value={card.number} onChange={e => setCard(c => ({ ...c, number: fmtCard(e.target.value) }))} className="bg-background border-border font-mono" maxLength={19} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="MM/YY" value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: fmtExpiry(e.target.value) }))} className="bg-background border-border font-mono" maxLength={5} />
                      <Input placeholder="CVV" type="password" value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))} className="bg-background border-border font-mono" maxLength={4} />
                    </div>
                  </div>
                )}

                {tab === "wallet" && (
                  <div className="grid grid-cols-3 gap-2">
                    {["Paytm","PhonePe","GPay","Amazon","BHIM","Freecharge"].map(w => (
                      <button key={w} type="button" onClick={() => setWallet(w)}
                        className={`py-2.5 rounded-lg border text-xs font-medium transition-colors ${wallet === w ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                        {w}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1">
              <Button onClick={handlePay} className="w-full bg-primary hover:bg-primary/90 gap-2 font-semibold">
                <Lock className="w-4 h-4" />Pay ${amount.toFixed(2)} Securely
              </Button>
              <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
                <X className="w-3 h-3" />Cancel
              </button>
            </div>

            <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-green-400" />SSL Encrypted</span>
              <span>·</span>
              <span>Simulated (no real charge)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ result, onContinue }: { result: SuccessResult; onContinue: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const copyPassword = () => {
    if (result.tempPassword) navigator.clipboard.writeText(result.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-6 animate-pulse">
          <PartyPopper className="w-9 h-9 text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">You're Enrolled!</h1>
        <p className="text-muted-foreground mb-6">
          Welcome to <span className="text-foreground font-semibold">"{result.courseTitle}"</span>.<br />
          {result.isNewUser ? "Your account has been created and you're ready to learn." : "You can start learning right away."}
        </p>

        {result.isNewUser && result.tempPassword && (
          <div className="bg-card border border-border rounded-xl p-5 mb-6 text-left">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />Your Account Credentials
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                <p className="text-sm font-mono bg-background rounded px-2.5 py-1.5 text-foreground border border-border">{result.user.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm font-mono bg-background rounded px-2.5 py-1.5 text-foreground border border-border tracking-widest">
                    {showPass ? result.tempPassword : "••••••••••"}
                  </p>
                  <button type="button" onClick={() => setShowPass(v => !v)} className="text-muted-foreground hover:text-foreground p-1.5">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={copyPassword} className="text-muted-foreground hover:text-foreground p-1.5">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-amber-400 mt-3 flex items-start gap-1.5">
              <span className="mt-0.5">⚠️</span>Save these credentials — you'll need them to log in next time. You can change your password in account settings.
            </p>
          </div>
        )}

        <Button onClick={onContinue} size="lg" className="w-full bg-primary hover:bg-primary/90 gap-2">
          <BookOpen className="w-4 h-4" />Start Learning Now
        </Button>
      </div>
    </div>
  );
}

// ── Main Checkout Page ────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const [, params] = useRoute("/checkout/:id");
  const courseId = parseInt(params?.id ?? "0");
  const [, navigate] = useLocation();
  const { user: authUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [gateway, setGateway] = useState<"stripe" | "razorpay">("stripe");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; type: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<SuccessResult | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [form, setForm] = useState({
    email: "",
    fullName: "",
    state: "",
    mobile: "",
  });

  const { data: course, isLoading } = useGetCourse(courseId, {
    query: { enabled: courseId > 0 }
  });

  const validateCoupon = useValidateCoupon();

  const price = parseFloat(String(course?.price ?? 0));
  const discountedPrice = appliedCoupon
    ? appliedCoupon.type === "percentage"
      ? price - (price * appliedCoupon.discount / 100)
      : Math.max(0, price - appliedCoupon.discount)
    : price;

  useEffect(() => {
    if (isAuthenticated && authUser) {
      setForm(f => ({
        ...f,
        email: (authUser as { email?: string }).email ?? "",
        fullName: (authUser as { name?: string }).name ?? "",
      }));
    }
  }, [isAuthenticated, authUser]);

  // Already enrolled: redirect to learn (only if not just purchased)
  useEffect(() => {
    if (!success && course?.isEnrolled) navigate(`/learn/${courseId}`);
  }, [course?.isEnrolled, success]);

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    const code = couponCode.trim().toUpperCase();
    validateCoupon.mutate({ data: { code, courseId } }, {
      onSuccess: (data) => {
        if (!data.valid) { toast({ title: "Invalid coupon", description: data.message, variant: "destructive" }); return; }
        setAppliedCoupon({ code, discount: data.discountValue ?? 0, type: data.discountType ?? "percentage" });
        toast({ title: "Coupon applied!", description: data.message });
      },
      onError: () => toast({ title: "Invalid coupon", variant: "destructive" }),
    });
  };

  const executePayment = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments/checkout/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          courseId,
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          state: form.state,
          mobile: form.mobile.trim(),
          gateway,
          couponCode: appliedCoupon?.code || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      setSuccess({
        isNewUser: data.isNewUser,
        tempPassword: data.tempPassword,
        user: data.user,
        courseId: data.courseId,
        courseTitle: data.courseTitle,
      });
    } catch (err: unknown) {
      toast({ title: "Checkout failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.fullName) {
      toast({ title: "Please fill in all required fields", variant: "destructive" }); return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      toast({ title: "Please enter a valid email address", variant: "destructive" }); return;
    }
    setShowPaymentModal(true);
  };

  if (success) {
    return <SuccessScreen result={success} onContinue={async () => { await queryClient.invalidateQueries(); navigate(`/learn/${success.courseId}`); }} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!course) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Course not found.</div>;
  }

  return (
    <>
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(`/courses/${courseId}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />Back to course
          </button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-green-400" />
            <span>Secure Checkout</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-10 items-start">
          {/* ── Left: Form ── */}
          <div className="lg:col-span-3">
            <h1 className="text-2xl font-bold text-foreground mb-1">Complete your purchase</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {isAuthenticated ? "Confirm your details and choose a payment method." : "Fill in your details below — we'll create your account automatically."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Account Info section */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
                  Account Information
                </h2>
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName">Full Name <span className="text-red-400">*</span></Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        value={form.fullName}
                        onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                        readOnly={isAuthenticated}
                        className={`bg-background border-border ${isAuthenticated ? "opacity-70 cursor-not-allowed" : ""}`}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email Address <span className="text-red-400">*</span></Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        readOnly={isAuthenticated}
                        className={`bg-background border-border ${isAuthenticated ? "opacity-70 cursor-not-allowed" : ""}`}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="mobile">Mobile Number</Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 border border-r-0 border-border bg-card rounded-l-md text-xs text-muted-foreground">+91</span>
                        <Input
                          id="mobile"
                          type="tel"
                          placeholder="9876543210"
                          value={form.mobile}
                          onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                          className="bg-background border-border rounded-l-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state">State</Label>
                      <select
                        id="state"
                        value={form.state}
                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                        className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Select state</option>
                        {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
                  Payment Method
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {(["stripe", "razorpay"] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGateway(g)}
                      className={`py-3.5 px-4 rounded-xl border-2 transition-all text-sm font-semibold flex flex-col items-center gap-1.5 ${
                        gateway === g
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-border/80"
                      }`}
                    >
                      <span className="text-xl">{g === "stripe" ? "💳" : "🇮🇳"}</span>
                      <span>{g === "stripe" ? "Stripe" : "Razorpay"}</span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {g === "stripe" ? "Cards · International" : "UPI · Cards · Wallets"}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-green-400" />
                  <span>256-bit SSL encryption · Simulated payment (no real charge)</span>
                </div>
              </div>

              {/* Coupon */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">3</span>
                  Coupon / Promo Code
                </h2>
                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleApplyCoupon())}
                      className="bg-background border-border font-mono"
                    />
                    <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={validateCoupon.isPending} className="border-border px-4">
                      {validateCoupon.isPending ? "..." : <Tag className="w-4 h-4" />}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <Check className="w-4 h-4" />
                      <span className="font-mono font-bold">{appliedCoupon.code}</span>
                      <span className="text-xs">
                        {appliedCoupon.type === "percentage" ? `${appliedCoupon.discount}% off` : `$${appliedCoupon.discount} off`}
                      </span>
                    </div>
                    <button type="button" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button type="submit" size="lg" disabled={processing} className="w-full bg-primary hover:bg-primary/90 text-base font-semibold gap-2 h-12">
                <CreditCard className="w-5 h-5" />
                {processing ? "Processing payment..." : `Pay $${discountedPrice.toFixed(2)} · Enroll Now`}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By completing this purchase, you agree to our Terms of Service.{" "}
                30-day money-back guarantee.
              </p>
            </form>
          </div>

          {/* ── Right: Order Summary ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Course card */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {course.thumbnailUrl && (
                <img src={course.thumbnailUrl} alt={course.title} className="w-full h-36 object-cover" />
              )}
              <div className="p-4">
                <Badge className="mb-2 text-xs bg-primary/10 text-primary border-primary/20">{course.category}</Badge>
                <h3 className="font-bold text-foreground leading-snug mb-3">{course.title}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-primary" />{course.enrollmentCount} students</span>
                  <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-primary" />{course.lessonCount} lessons</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" />{Math.round(course.durationMinutes / 60)}h content</span>
                  <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5 text-primary capitalize" />{course.level}</span>
                </div>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Original price</span>
                  <span>${price.toFixed(2)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-green-400">
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{appliedCoupon.code}</span>
                    <span>
                      -${(appliedCoupon.type === "percentage"
                        ? price * appliedCoupon.discount / 100
                        : Math.min(price, appliedCoupon.discount)
                      ).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground text-base">
                  <span>Total</span>
                  <span>${discountedPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Includes */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3">This course includes</h3>
              <div className="space-y-2">
                {[
                  "Full lifetime access",
                  "Access on all devices",
                  "Certificate of completion",
                  "30-day money-back guarantee",
                ].map(t => (
                  <div key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust */}
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground py-2">
              <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" />SSL Secure</span>
              <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" />Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    {showPaymentModal && (
      <PaymentModal
        gateway={gateway}
        amount={discountedPrice}
        courseName={course.title}
        onClose={() => setShowPaymentModal(false)}
        onPay={async () => {
          setShowPaymentModal(false);
          await executePayment();
        }}
      />
    )}
    </>
  );
}
