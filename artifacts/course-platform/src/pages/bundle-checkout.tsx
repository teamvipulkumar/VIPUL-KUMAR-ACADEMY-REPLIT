import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { SiteFooter } from "@/components/layout/app-layout";
import { getStoredRef } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, Check, Package, ChevronLeft, BookOpen, CreditCard,
  Smartphone, Wallet, AlertCircle, X, Shield,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type BundleCourse = { id: number; title: string; price: number; thumbnailUrl: string | null; category: string; level: string };
type Bundle = {
  id: number; name: string; slug: string; description: string | null;
  thumbnailUrl: string | null; price: number; compareAtPrice: number | null;
  isActive: boolean; courses: BundleCourse[];
};
type ActiveGateway = { id: number; name: string; displayName: string; apiKey: string; isTestMode: boolean };

const GATEWAY_META: Record<string, { label: string; tagline: string }> = {
  stripe: { label: "Stripe", tagline: "Cards · International" },
  razorpay: { label: "Razorpay", tagline: "UPI · Cards · Wallets" },
  cashfree: { label: "Cashfree", tagline: "UPI · Cards · Instant" },
  paytm: { label: "Paytm", tagline: "Paytm Wallet · UPI · Cards" },
  payu: { label: "PayU", tagline: "UPI · Cards · EMI" },
};

function fmtCard(v: string) { return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim(); }
function fmtExpiry(v: string) { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d; }

type SuccessState = { bundleName: string; enrolledCount: number };

export default function BundleCheckoutPage() {
  const [, params] = useRoute("/bundles/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const bundleId = params ? parseInt(params.id) : NaN;

  const [selectedGateway, setSelectedGateway] = useState<ActiveGateway | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  // Payment form
  const [tab, setTab] = useState<"upi" | "card" | "wallet">("upi");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [upi, setUpi] = useState("");
  const [wallet, setWallet] = useState("");
  const [payStep, setPayStep] = useState<"form" | "processing" | "verifying">("form");
  const [payError, setPayError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  const { data: bundle, isLoading } = useQuery<Bundle>({
    queryKey: ["bundle", bundleId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/bundles/${bundleId}`);
      if (!res.ok) throw new Error("Bundle not found");
      return res.json();
    },
    enabled: !isNaN(bundleId),
  });

  const { data: gateways } = useQuery<ActiveGateway[]>({
    queryKey: ["active-gateways"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/payments/gateways/active`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (gateways && gateways.length > 0 && !selectedGateway) {
      setSelectedGateway(gateways[0]);
    }
  }, [gateways]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Package className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-xl font-bold mb-2">Sign in to purchase</h2>
        <p className="text-muted-foreground mb-6">You need to be signed in to buy a bundle.</p>
        <Link href={`/login?redirect=/bundles/${bundleId}`}>
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold mb-2">Bundle not found</h2>
        <Link href="/courses"><Button variant="outline" className="mt-4">Browse Courses</Button></Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center mb-6">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Enrollment Confirmed! 🎉</h1>
          <p className="text-muted-foreground mb-1">You now have access to all courses in</p>
          <p className="text-primary font-semibold text-lg mb-6">"{success.bundleName}"</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/my-courses"><Button>Go to My Courses</Button></Link>
            <Link href="/courses"><Button variant="outline">Browse More</Button></Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const individualTotal = bundle.courses.reduce((s, c) => s + c.price, 0);
  const savings = bundle.compareAtPrice ? bundle.compareAtPrice - bundle.price : individualTotal - bundle.price;
  const isStripe = selectedGateway?.name === "stripe";

  const validateAndPay = () => {
    setPayError("");
    if (isStripe) {
      const raw = card.number.replace(/\s/g, "");
      if (raw.length < 16) { setPayError("Enter a valid 16-digit card number"); return; }
      if (card.cvv.length < 3) { setPayError("Enter a valid CVV"); return; }
      if (!card.name.trim()) { setPayError("Enter the cardholder name"); return; }
    } else {
      if (tab === "upi" && (!upi.includes("@") || upi.length < 5)) { setPayError("Enter a valid UPI ID"); return; }
      if (tab === "card" && card.number.replace(/\s/g, "").length < 16) { setPayError("Enter a valid card number"); return; }
      if (tab === "wallet" && !wallet) { setPayError("Select a wallet"); return; }
    }
    executePay();
  };

  const executePay = async () => {
    if (!selectedGateway || !bundle) return;
    setPayStep("processing");
    await new Promise(r => setTimeout(r, 1500));
    setPayStep("verifying");
    await new Promise(r => setTimeout(r, 1200));
    try {
      const affiliateRef = getStoredRef();
      const checkoutRes = await fetch(`${API_BASE}/api/bundles/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bundleId: bundle.id, gateway: selectedGateway.name, affiliateRef }),
      });
      if (!checkoutRes.ok) throw new Error("Checkout failed");
      const { sessionId } = await checkoutRes.json();

      const verifyRes = await fetch(`${API_BASE}/api/bundles/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      });
      if (!verifyRes.ok) throw new Error("Verification failed");
      const { bundleName, enrolledCourses } = await verifyRes.json();
      setPayModalOpen(false);
      setSuccess({ bundleName, enrolledCount: enrolledCourses.length });
    } catch {
      setPayStep("form");
      setPayError("Payment failed. Please try again.");
      toast({ title: "Payment failed", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/courses">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />Back to Courses
            </button>
          </Link>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />Secure checkout
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ── Left: Bundle Info ── */}
          <div className="lg:col-span-3 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-primary" />
                <span className="text-xs text-primary font-semibold uppercase tracking-wider">Course Bundle</span>
              </div>
              <h1 className="text-2xl font-bold mb-1">{bundle.name}</h1>
              {bundle.description && <p className="text-muted-foreground text-sm">{bundle.description}</p>}
            </div>

            {/* Courses included */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{bundle.courses.length} Courses Included</span>
              </div>
              <div className="divide-y divide-border">
                {bundle.courses.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    {c.thumbnailUrl ? (
                      <img src={c.thumbnailUrl} alt={c.title} className="w-12 h-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-8 bg-gradient-to-br from-primary/20 to-blue-900/30 rounded flex-shrink-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary/50">{c.category.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.category} · {c.level}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="line-through">₹{c.price}</span>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { icon: <Shield className="w-5 h-5" />, label: "Secure Payment" },
                { icon: <BookOpen className="w-5 h-5" />, label: "Lifetime Access" },
                { icon: <Check className="w-5 h-5" />, label: "Instant Enrollment" },
              ].map(({ icon, label }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-1.5 text-muted-foreground">
                  {icon}
                  <span className="text-xs font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Payment Panel ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Price summary */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h2 className="font-semibold">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Individual total ({bundle.courses.length} courses)</span>
                  <span className="line-through">₹{individualTotal}</span>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Bundle savings</span>
                    <span>-₹{savings.toFixed(0)}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>₹{bundle.price}</span>
                </div>
              </div>
            </div>

            {/* Gateway selector */}
            {gateways && gateways.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold">Payment Method</h3>
                <div className="space-y-2">
                  {gateways.map(gw => {
                    const meta = GATEWAY_META[gw.name] ?? { label: gw.displayName, tagline: "" };
                    return (
                      <button
                        key={gw.id}
                        onClick={() => setSelectedGateway(gw)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${selectedGateway?.id === gw.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${gw.name === "stripe" ? "bg-[#635BFF]" : gw.name === "razorpay" ? "bg-blue-600" : "bg-primary"}`}>
                          {gw.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">{meta.tagline}</p>
                        </div>
                        {selectedGateway?.id === gw.id && <Check className="w-4 h-4 text-primary ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-semibold gap-2"
              onClick={() => { setPayStep("form"); setPayError(""); setPayModalOpen(true); }}
              disabled={!selectedGateway}
            >
              <Lock className="w-4 h-4" />Buy Bundle · ₹{bundle.price}
            </Button>
            <p className="text-xs text-center text-muted-foreground">Instant access to all {bundle.courses.length} courses after payment</p>
          </div>
        </div>
      </div>

      <SiteFooter />

      {/* ── Payment Modal ── */}
      {payModalOpen && selectedGateway && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => { if (e.target === overlayRef.current && payStep === "form") setPayModalOpen(false); }}
        >
          <div className="bg-[#0d1424] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className={`px-5 pt-5 pb-4 flex items-center justify-between ${isStripe ? "bg-[#635BFF]/10 border-b border-[#635BFF]/20" : "bg-blue-500/10 border-b border-blue-500/20"}`}>
              <div>
                <p className="font-bold text-sm">{GATEWAY_META[selectedGateway.name]?.label ?? selectedGateway.displayName}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[180px]">{bundle.name}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">₹{bundle.price}</p>
                <div className="flex items-center gap-1 text-[10px] text-green-400 justify-end"><Lock className="w-2.5 h-2.5" />Secure</div>
              </div>
            </div>

            {/* Processing */}
            {(payStep === "processing" || payStep === "verifying") && (
              <div className="px-5 py-10 text-center space-y-4">
                <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
                <div>
                  <p className="font-semibold">{payStep === "processing" ? "Processing Payment..." : "Verifying with bank..."}</p>
                  <p className="text-xs text-muted-foreground mt-1">Please do not close this window</p>
                </div>
              </div>
            )}

            {/* Form */}
            {payStep === "form" && (
              <div className="p-5 space-y-4">
                {isStripe ? (
                  <div className="space-y-3.5">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Card Number</Label>
                      <div className="relative">
                        <Input placeholder="1234 5678 9012 3456" value={card.number} onChange={e => setCard(c => ({ ...c, number: fmtCard(e.target.value) }))} className="bg-background border-border font-mono pr-10" maxLength={19} />
                        <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Expiry (MM/YY)</Label>
                        <Input placeholder="MM/YY" value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: fmtExpiry(e.target.value) }))} className="bg-background border-border font-mono" maxLength={5} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">CVV</Label>
                        <Input placeholder="•••" type="password" value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))} className="bg-background border-border font-mono" maxLength={4} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Name on Card</Label>
                      <Input placeholder="John Doe" value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value }))} className="bg-background border-border" />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">Use any valid-looking test card (e.g. 4242 4242 4242 4242)</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-1.5 bg-background rounded-lg p-1">
                      {(["upi", "card", "wallet"] as const).map(t => (
                        <button key={t} type="button" onClick={() => { setTab(t); setPayError(""); }}
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
                        <Input placeholder="Card Number" value={card.number} onChange={e => setCard(c => ({ ...c, number: fmtCard(e.target.value) }))} className="bg-background border-border font-mono" maxLength={19} />
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

                {payError && (
                  <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{payError}
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  <Button onClick={validateAndPay} className="w-full bg-primary hover:bg-primary/90 gap-2 font-semibold">
                    <Lock className="w-4 h-4" />Pay ₹{bundle.price} Securely
                  </Button>
                  <button type="button" onClick={() => setPayModalOpen(false)} className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
                    <X className="w-3 h-3" />Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
