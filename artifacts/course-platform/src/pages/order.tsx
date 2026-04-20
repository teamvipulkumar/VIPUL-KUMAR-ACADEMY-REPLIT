import { useState, useEffect } from "react";
import { SiteFooter } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, ShieldCheck, Lock, MessageCircle, Star,
  ArrowRight, Zap, Users, Clock, Award, CreditCard, Smartphone,
  ChevronDown,
} from "lucide-react";

/* ─── Countdown ─── */
function useCountdown(targetMinutes = 27) {
  const [left, setLeft] = useState(() => {
    const stored = sessionStorage.getItem("vka_order_countdown");
    if (stored) return parseInt(stored, 10);
    return targetMinutes * 60;
  });

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => {
      setLeft(prev => {
        const next = Math.max(0, prev - 1);
        sessionStorage.setItem("vka_order_countdown", String(next));
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return { h, m, s, expired: left <= 0 };
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-16 sm:w-20 h-16 sm:h-20 rounded-xl flex items-center justify-center font-extrabold text-2xl sm:text-3xl tabular-nums text-white"
        style={{ background: "linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%)", boxShadow: "0 4px 20px rgba(29,78,216,0.4)" }}
      >
        {String(value).padStart(2, "0")}
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-widest mt-1.5" style={{ color: "#64748b" }}>{label}</span>
    </div>
  );
}

/* ─── Order Form ─── */
interface FormState { name: string; email: string; phone: string; method: "upi" | "card" | "netbanking" }

function OrderForm({ price }: { price: number }) {
  const [form, setForm] = useState<FormState>({ name: "", email: "", phone: "", method: "upi" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setDone(true);
  }

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-xl font-bold text-white">Order Placed Successfully!</h3>
        <p className="text-sm" style={{ color: "#94a3b8" }}>Check your email for login details and course access.</p>
      </div>
    );
  }

  const payMethods = [
    { id: "upi", label: "UPI / GPay", icon: Smartphone },
    { id: "card", label: "Credit/Debit Card", icon: CreditCard },
    { id: "netbanking", label: "Net Banking", icon: ArrowRight },
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold" style={{ color: "#94a3b8" }}>Full Name *</Label>
          <Input
            required value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="Enter your full name"
            className="h-11 text-sm"
            style={{ background: "#0f172a", borderColor: "#1e293b", color: "#e2e8f0" }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold" style={{ color: "#94a3b8" }}>Phone Number *</Label>
          <Input
            required value={form.phone}
            onChange={e => set("phone", e.target.value)}
            placeholder="+91 00000 00000"
            type="tel"
            className="h-11 text-sm"
            style={{ background: "#0f172a", borderColor: "#1e293b", color: "#e2e8f0" }}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold" style={{ color: "#94a3b8" }}>Email Address *</Label>
        <Input
          required type="email" value={form.email}
          onChange={e => set("email", e.target.value)}
          placeholder="Enter your best email address"
          className="h-11 text-sm"
          style={{ background: "#0f172a", borderColor: "#1e293b", color: "#e2e8f0" }}
        />
      </div>

      {/* Payment Method */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold" style={{ color: "#94a3b8" }}>Payment Method</Label>
        <div className="grid grid-cols-3 gap-2">
          {payMethods.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => set("method", id)}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all"
              style={form.method === id
                ? { background: "rgba(37,99,235,0.15)", borderColor: "#2563eb", color: "#60a5fa" }
                : { background: "#0f172a", borderColor: "#1e293b", color: "#64748b" }
              }
            >
              <Icon className="w-4 h-4" />
              <span className="leading-tight text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* UPI Field (conditional) */}
      {form.method === "upi" && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold" style={{ color: "#94a3b8" }}>UPI ID / VPA</Label>
          <Input
            placeholder="yourname@upi"
            className="h-11 text-sm"
            style={{ background: "#0f172a", borderColor: "#1e293b", color: "#e2e8f0" }}
          />
        </div>
      )}

      {/* Summary */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "#94a3b8" }}>Ultimate Affiliate 2.0</span>
          <span className="line-through text-sm" style={{ color: "#475569" }}>₹2,499</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-bold text-green-400 text-sm">Limited Time Discount</span>
          <span className="font-bold text-green-400">−₹{(2499 - price).toLocaleString("en-IN")}</span>
        </div>
        <div className="border-t pt-2 flex items-center justify-between" style={{ borderColor: "#1e293b" }}>
          <span className="font-bold text-white">Total Today</span>
          <span className="text-xl font-extrabold text-white">₹{price}</span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-14 text-base font-extrabold rounded-xl gap-2 text-white"
        style={{
          background: loading ? "#1e3a8a" : "linear-gradient(135deg,#16a34a 0%,#15803d 100%)",
          boxShadow: loading ? "none" : "0 8px 32px rgba(22,163,74,0.35)",
          border: "none",
        }}
      >
        {loading ? (
          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Processing…</>
        ) : (
          <><Lock className="w-4 h-4" />YES! Give Me Instant Access — ₹{price}</>
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "#64748b" }}>
        <Lock className="w-3.5 h-3.5" />
        256-bit SSL Secure Checkout · Your data is 100% safe
      </div>
    </form>
  );
}

/* ─── Main Page ─── */
const FEATURES = [
  "Complete A-Z Affiliate Marketing System",
  "WarriorPlus Product Selection Blueprint",
  "Funnel Setup — Done-For-You Templates",
  "AI Automation Setup (Save 10+ hrs/week)",
  "Email Marketing Mastery Module",
  "Meta & Google Ads Traffic Strategies",
  "Private Community Access (Lifetime)",
  "1-Year Personal Support from Vipul",
];

const TESTIMONIALS = [
  { name: "Rahul S.", role: "Student", text: "Made my first ₹23,000 in just 11 days! The funnel templates alone were worth 10x the price.", stars: 5 },
  { name: "Priya M.", role: "Homemaker", text: "I had zero experience. Now I earn ₹60K+ per month working just 2 hours a day. Life changing!", stars: 5 },
  { name: "Deepak T.", role: "IT Professional", text: "Finally quit my 9-5. The email marketing module helped me build a list of 4,000+ buyers in 60 days.", stars: 5 },
];

const FAQS = [
  { q: "Do I need experience to join?", a: "No! This course is built from scratch for complete beginners. You only need a smartphone or laptop and an internet connection." },
  { q: "Is this a one-time payment?", a: "Yes. You pay ₹299 once and get lifetime access — no hidden fees, no subscriptions." },
  { q: "What if I don't see results?", a: "We offer a 30-day money-back guarantee. If you follow the steps and don't see results, email us and we'll refund you — no questions asked." },
  { q: "How do I access the course after payment?", a: "Your login credentials are sent to your email within minutes of payment. You can start immediately." },
];

export default function OrderPage() {
  const { h, m, s } = useCountdown(27);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const PRICE = 299;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080d1a", color: "#e2e8f0" }}>

      {/* ── Support Bar ── */}
      <div className="text-center py-2.5 px-4 text-sm" style={{ background: "#0f172a", borderBottom: "1px solid #1e293b" }}>
        Need Help?{" "}
        <a
          href="https://wa.me/15557485582"
          className="font-bold inline-flex items-center gap-1 underline-offset-2 hover:underline"
          style={{ color: "#3b82f6" }}
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp Us — We're Here To Help!
        </a>
      </div>

      <main className="flex-1">

        {/* ── Headline Section ── */}
        <section className="text-center px-4 pt-10 pb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-xs font-bold uppercase tracking-widest" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
            <Zap className="w-3 h-3" />
            Limited Time Offer — ₹2,499 OFF Today Only
          </div>
          <h1 className="text-3xl sm:text-5xl font-black uppercase leading-tight tracking-tight max-w-4xl mx-auto">
            Turn{" "}
            <span style={{ color: "#3b82f6" }}>₹0</span>{" "}
            Into{" "}
            <span style={{ color: "#3b82f6" }}>₹10,000+</span>{" "}
            Monthly In{" "}
            <span style={{ color: "#f59e0b" }}>Just 30 Days</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg max-w-2xl mx-auto" style={{ color: "#94a3b8" }}>
            ULTIMATE AFFILIATE 2.0 — Beginner to Advanced Level Affiliate Marketing Masterclass
          </p>
        </section>

        {/* ── Product Mockup ── */}
        <section className="flex justify-center px-4 pb-8">
          <div className="relative w-full max-w-2xl">
            <ProductMockup />
          </div>
        </section>

        {/* ── Countdown ── */}
        <section className="text-center px-4 pb-8">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: "#ef4444" }}>
            ⚡ This Price Expires In:
          </p>
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <CountdownBox value={h} label="Hours" />
            <span className="text-3xl font-bold pb-5" style={{ color: "#3b82f6" }}>:</span>
            <CountdownBox value={m} label="Minutes" />
            <span className="text-3xl font-bold pb-5" style={{ color: "#3b82f6" }}>:</span>
            <CountdownBox value={s} label="Seconds" />
          </div>
        </section>

        {/* ── Pricing + Order Form ── */}
        <section className="px-4 pb-12 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* Left: What's included */}
            <div className="space-y-6">
              <div className="rounded-2xl p-6 space-y-4" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                    <Award className="w-4 h-4" style={{ color: "#f59e0b" }} />
                  </div>
                  <h2 className="text-lg font-bold text-white">What You Get Inside</h2>
                </div>
                <ul className="space-y-3">
                  {FEATURES.map(f => (
                    <li key={f} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#22c55e" }} />
                      <span className="text-sm" style={{ color: "#cbd5e1" }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Users, val: "5,200+", label: "Students" },
                  { icon: Star, val: "4.9/5", label: "Rating" },
                  { icon: Clock, val: "30-Day", label: "Guarantee" },
                ].map(({ icon: Icon, val, label }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                    <Icon className="w-5 h-5 mx-auto mb-1.5" style={{ color: "#3b82f6" }} />
                    <p className="font-bold text-white text-sm">{val}</p>
                    <p className="text-xs" style={{ color: "#64748b" }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Guarantee */}
              <div className="rounded-2xl p-5 flex items-start gap-4" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)" }}>
                <ShieldCheck className="w-10 h-10 shrink-0" style={{ color: "#22c55e" }} />
                <div>
                  <p className="font-bold text-white mb-1">30-Day Money-Back Guarantee</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                    If you follow the course and don't see results in 30 days, email us for a full refund — no questions asked, no hard feelings.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Order form */}
            <div>
              <div className="rounded-2xl p-6 sm:p-7 sticky top-4" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                {/* Pricing header */}
                <div className="text-center mb-6">
                  <p className="text-sm mb-1" style={{ color: "#94a3b8" }}>Regular Price</p>
                  <p className="text-lg line-through" style={{ color: "#475569" }}>₹2,499</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-4xl font-black text-white">₹{PRICE}</span>
                    <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                      88% OFF
                    </span>
                  </div>
                  <p className="text-xs mt-2 font-medium" style={{ color: "#f59e0b" }}>
                    For Limited Time Only — One-Time Payment
                  </p>
                </div>

                <OrderForm price={PRICE} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="px-4 pb-12 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-8">
            Real Results From Real Students
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="rounded-2xl p-5 space-y-3" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                <div className="flex gap-0.5">
                  {[...Array(t.stars)].map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-sm italic leading-relaxed" style={{ color: "#cbd5e1" }}>"{t.text}"</p>
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "#1e3a8a" }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{t.name}</p>
                    <p className="text-xs" style={{ color: "#64748b" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="px-4 pb-12 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-6">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid #1e293b" }}>
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  style={{ background: openFaq === i ? "#0f172a" : "#0a1628" }}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm font-semibold text-white pr-4">{faq.q}</span>
                  <ChevronDown
                    className="w-4 h-4 shrink-0 transition-transform"
                    style={{ color: "#64748b", transform: openFaq === i ? "rotate(180deg)" : "none" }}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4" style={{ background: "#0f172a", borderTop: "1px solid #1e293b" }}>
                    <p className="text-sm pt-3 leading-relaxed" style={{ color: "#94a3b8" }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="px-4 pb-16 text-center max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
            Don't Miss This Opportunity
          </h2>
          <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>
            Join 5,200+ students already earning with the same system. Price goes back to ₹2,499 soon.
          </p>
          <a
            href="#order-form"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-xl font-extrabold text-lg text-white transition-all hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg,#16a34a 0%,#15803d 100%)", boxShadow: "0 8px 32px rgba(22,163,74,0.35)" }}
            onClick={e => { e.preventDefault(); document.querySelector("form")?.scrollIntoView({ behavior: "smooth" }); }}
          >
            <Lock className="w-5 h-5" />
            YES! I Want Access for ₹299
            <ArrowRight className="w-5 h-5" />
          </a>
          <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
            {["Instant Access", "Secure Payment", "30-Day Guarantee"].map(b => (
              <span key={b} className="flex items-center gap-1.5 text-xs" style={{ color: "#64748b" }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{b}
              </span>
            ))}
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}

/* ─── Product Mockup SVG ─── */
function ProductMockup() {
  return (
    <div className="relative flex items-end justify-center gap-3 sm:gap-4 py-4">
      {/* Monitor */}
      <div className="relative z-20 w-[55%] sm:w-[52%]">
        <div className="rounded-xl overflow-hidden shadow-2xl" style={{ border: "2px solid #1e293b", background: "#111827" }}>
          <MockupScreen title="Ultimate Affiliate 2.0" />
          {/* Monitor stand */}
          <div className="h-4 flex justify-center" style={{ background: "#0f172a" }}>
            <div className="w-1/3 h-full" style={{ background: "#1e293b", borderRadius: "0 0 4px 4px" }} />
          </div>
        </div>
      </div>

      {/* Laptop */}
      <div className="relative z-10 w-[40%] sm:w-[38%] -ml-6 sm:-ml-8 mb-2">
        <div className="rounded-lg overflow-hidden shadow-xl" style={{ border: "1.5px solid #1e293b", background: "#111827" }}>
          <MockupScreen title="Affiliate 2.0" compact />
          <div className="h-3 flex items-center justify-center" style={{ background: "#0f172a" }}>
            <div className="w-10 h-1.5 rounded-full" style={{ background: "#1e293b" }} />
          </div>
        </div>
        <div className="h-2 mx-2 rounded-b-md" style={{ background: "#0a0f1e", border: "1px solid #1e293b" }} />
      </div>

      {/* Phone */}
      <div className="relative z-30 w-[18%] sm:w-[16%] mb-3 -ml-3">
        <div className="rounded-xl overflow-hidden shadow-xl mx-auto" style={{ border: "2px solid #1e293b", background: "#111827", aspectRatio: "9/16" }}>
          <div className="h-full flex flex-col p-1.5 gap-1">
            <div className="rounded-sm text-center py-0.5" style={{ background: "#1e3a8a" }}>
              <p className="text-[6px] font-bold text-white leading-none">WP</p>
            </div>
            <div className="flex-1 rounded-sm" style={{ background: "#0f172a" }}>
              <div className="p-1 space-y-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-1 rounded-full" style={{ background: "#1e293b", width: `${[80, 60, 70, 50][i]}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: "rgba(29,78,216,0.25)" }} />
    </div>
  );
}

function MockupScreen({ title, compact = false }: { title: string; compact?: boolean }) {
  const badges = ["Lifetime Access", "Community", "1-Yr Support"];
  return (
    <div className="p-2 sm:p-3" style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 100%)", minHeight: compact ? 80 : 140 }}>
      <div className="text-center mb-2">
        <p className="text-[7px] sm:text-[8px] font-semibold" style={{ color: "#94a3b8" }}>Beginner to Advanced Level</p>
        <p className={`font-extrabold text-white uppercase leading-tight ${compact ? "text-[8px] sm:text-[9px]" : "text-[10px] sm:text-xs"}`}>{title}</p>
      </div>
      {!compact && (
        <div className="flex justify-center gap-1.5 flex-wrap">
          {badges.map(b => (
            <span key={b} className="px-1.5 py-0.5 rounded-full text-[6px] sm:text-[7px] font-bold text-white" style={{ background: "#f59e0b" }}>
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
