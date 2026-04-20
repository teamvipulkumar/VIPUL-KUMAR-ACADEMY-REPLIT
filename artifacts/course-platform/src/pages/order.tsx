import { useState, useEffect } from "react";
import { SiteFooter } from "@/components/layout/app-layout";
import { ShieldCheck, CheckCircle2, MessageCircle, ImageIcon, Clock } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const MOCKUP_IMG = `${API_BASE}/api/files/3b0b3e24eb675e69d0b30312.png`;

/* ─── Countdown Hook ─── */
function useCountdown() {
  const [left, setLeft] = useState(() => {
    const s = sessionStorage.getItem("vka_order_cd");
    return s ? parseInt(s, 10) : 3600;
  });
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => {
      setLeft(p => {
        const n = Math.max(0, p - 1);
        sessionStorage.setItem("vka_order_cd", String(n));
        return n;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return {
    h: Math.floor(left / 3600),
    m: Math.floor((left % 3600) / 60),
    s: left % 60,
  };
}

function Countdown() {
  const { h, m, s } = useCountdown();
  const box = (v: number, label: string) => (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-16 sm:w-20 h-14 sm:h-16 flex items-center justify-center rounded-lg text-2xl sm:text-3xl font-black tabular-nums text-white"
        style={{ background: "#1e293b" }}
      >
        {String(v).padStart(2, "0")}
      </div>
      <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: "#64748b" }}>{label}</span>
    </div>
  );
  return (
    <div className="flex items-end justify-center gap-2 sm:gap-3">
      {box(h, "Hours")}
      <span className="text-3xl font-black mb-4" style={{ color: "#3b82f6" }}>:</span>
      {box(m, "Minutes")}
      <span className="text-3xl font-black mb-4" style={{ color: "#3b82f6" }}>:</span>
      {box(s, "Seconds")}
    </div>
  );
}

/* ─── Blank Image Placeholder ─── */
function ImgPlaceholder({ label = "Image", height = 260, className = "" }: { label?: string; height?: number; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-xl w-full ${className}`}
      style={{ minHeight: height, background: "#f1f5f9", border: "2px dashed #cbd5e1" }}
    >
      <ImageIcon className="w-8 h-8" style={{ color: "#94a3b8" }} />
      <span className="text-sm font-medium" style={{ color: "#64748b" }}>{label}</span>
      <span className="text-xs" style={{ color: "#94a3b8" }}>Upload Later</span>
    </div>
  );
}

/* ─── CTA Button ─── */
function CtaBtn({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <a
        href="#"
        className="inline-flex flex-col items-center px-10 py-4 rounded-xl font-black text-white text-lg sm:text-xl uppercase tracking-wide transition-all hover:scale-[1.03] active:scale-[0.97] shadow-xl w-full sm:w-auto text-center"
        style={{
          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
          boxShadow: "0 8px 32px rgba(37,99,235,0.35)",
          minWidth: 280,
        }}
        onClick={e => e.preventDefault()}
      >
        {label}
      </a>
      {sub && <p className="text-xs mt-1 text-center max-w-xs" style={{ color: "#64748b" }}>{sub}</p>}
    </div>
  );
}

/* ─── Trust Row ─── */
function TrustRow() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm font-semibold" style={{ color: "#64748b" }}>
      <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" />Instant Access After Payment</span>
      <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-500" />30-Day Money Back Guarantee</span>
    </div>
  );
}

/* ─── Section Wrapper ─── */
function Section({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`px-4 py-10 sm:py-14 ${className}`} style={style}>
      <div className="max-w-4xl mx-auto">{children}</div>
    </section>
  );
}

/* ─── Module Card ─── */
function Module({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4 p-5 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base" style={{ background: "linear-gradient(135deg,#1e3a8a,#2563eb)" }}>
        {num}
      </div>
      <div>
        <h4 className="font-bold mb-1 text-sm sm:text-base" style={{ color: "#0f172a" }}>{title}</h4>
        <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
      </div>
    </div>
  );
}

/* ─── FAQ ─── */
const FAQS = [
  { q: "What language is this course in?", a: "This course is in the Hindi language and some English words have also been used in it." },
  { q: "From which devices can this course be accessed?", a: "This course can be accessed from all devices like mobile, laptop, computer, tablet etc." },
  { q: "Who can join this course?", a: "This course can be joined by those people who want to earn online by working online or working from home, that too without showing their face." },
  { q: "How much time will it take to complete this course?", a: "This course is of 10+ hours, it depends on you how soon you want to complete it." },
  { q: "Is there any guarantee that we will start earning after joining this?", a: "We do not make any such claim that your earning will start just after enrolling in this course because it depends on you how seriously you take everything mentioned in this course. If you work in the manner explained and taught in this course, then you will definitely earn, and if the methods mentioned by us do not work for you, then we also offer 30 days money back guarantee for this." },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
        style={{ background: open ? "#f8fafc" : "#ffffff" }}
        onClick={() => setOpen(p => !p)}
      >
        <span className="font-semibold text-sm sm:text-base" style={{ color: "#0f172a" }}>{q}</span>
        <span className="text-xl shrink-0" style={{ color: "#3b82f6" }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm leading-relaxed" style={{ background: "#f8fafc", color: "#64748b", borderTop: "1px solid #e2e8f0" }}>
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function OrderPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#ffffff", color: "#0f172a" }}>
      {/* ── Support Bar ── */}
      <div className="text-center py-2.5 px-4 text-sm font-medium" style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
        Need Help?{" "}
        <a
          href="https://wa.me/15557485582"
          className="font-bold inline-flex items-center gap-1.5 hover:underline underline-offset-2"
          style={{ color: "#2563eb" }}
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp Us +15557485582 (We're Here To Help)
        </a>
      </div>
      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="pt-10 sm:pt-14 text-center" style={{ background: "#ffffff" }}>
          <div className="max-w-4xl mx-auto px-4 space-y-4">
            <h1 className="text-3xl sm:text-5xl font-black uppercase leading-tight tracking-tight" style={{ color: "#0f172a" }}>
              Turn{" "}
              <span style={{ color: "#2563eb" }}>$0</span>{" "}
              Into{" "}
              <span style={{ color: "#2563eb" }}>$10,000+</span>{" "}
              Monthly In Just 30 Days
            </h1>
            <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{ color: "#64748b" }}>
              ULTIMATE AFFILIATE 2.0 Beginner to Advance Level Affiliate Marketing Masterclass
            </p>
          </div>

          {/* Product Mockup Image */}
          <div style={{ maxWidth: "860px", margin: "2rem auto 0", padding: "0 1rem" }}>
            <img
              src={MOCKUP_IMG}
              alt="Ultimate Affiliate 2.0 Course Mockup"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
              }}
            />
          </div>

          <div className="max-w-4xl mx-auto px-4 pb-10 space-y-5 mt-8">
            <Countdown />
            <div className="space-y-1">
              <p className="text-lg" style={{ color: "#94a3b8" }}>
                Regular Price —{" "}
                <span className="line-through font-bold" style={{ color: "#ef4444" }}>₹2499</span>
              </p>
              <p className="text-2xl sm:text-3xl font-black" style={{ color: "#0f172a" }}>
                For Limited Time Only{" "}
                <span className="font-black" style={{ color: "#2563eb" }}>JUST ₹299</span>
              </p>
            </div>
            <CtaBtn label="GET INSTANT ACCESS" />
            <TrustRow />
          </div>
        </section>

        {/* ── Pain Points ── */}
        <Section style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-10" style={{ color: "#0f172a" }}>
            Are You Tired Of...
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                title: "Working 9-5 For Peanuts?",
                desc: "Trading your precious time for a paycheck that barely covers your bills while your boss gets rich?",
              },
              {
                title: "Failed Online Attempts?",
                desc: "Tried dropshipping, crypto, courses but nothing worked? Lost money on \"gurus\" who disappeared with your cash?",
              },
              {
                title: "Living Paycheck To Paycheck?",
                desc: "Stressed about bills, unable to afford luxuries, watching others live the life you dream of?",
              },
            ].map(({ title, desc }) => (
              <div key={title} className="rounded-2xl p-6 text-center space-y-3" style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  😤
                </div>
                <h3 className="font-bold text-base sm:text-lg" style={{ color: "#0f172a" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Promise ── */}
        <Section className="text-center">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-4xl font-black leading-tight" style={{ color: "#0f172a" }}>
              What If I Told You...
            </h2>
            <p className="text-xl sm:text-2xl font-black leading-tight" style={{ color: "#d97706" }}>
              You Could Make More In{" "}
              <span className="underline decoration-wavy decoration-blue-500">ONE Month</span>{" "}
              Than Most People Make In A Year...
            </p>
            <p className="text-lg font-semibold" style={{ color: "#64748b" }}>
              Without Any Previous Experience!
            </p>
          </div>
        </Section>

        {/* ── Student Results (Proof) ── */}
        <section className="px-4 py-10 sm:py-14" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-3" style={{ color: "#0f172a" }}>
              PROOF: Real Student Results
            </h2>
            <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>
              These ordinary people followed the exact system you're about to discover...
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { src: `${API_BASE}/api/files/4d432b070d2d411e24a4d77c.jpg`, label: "STUDENT #1" },
                { src: `${API_BASE}/api/files/964249bf75f7602bc339ad4a.jpg`, label: "STUDENT #2" },
                { src: `${API_BASE}/api/files/6fe2de6bae918f8dd531bb90.jpg`, label: "STUDENT #3" },
                { src: `${API_BASE}/api/files/e49830a459f19fb7933d649b.jpg`, label: "STUDENT #4" },
              ].map(({ src, label }, i) => (
                <div key={i} className="flex flex-col items-center gap-3">
                  <p className="text-base sm:text-lg font-black tracking-wide" style={{ color: "#2563eb" }}>{label}</p>
                  <img
                    src={src}
                    alt={label}
                    className="w-full rounded-2xl border-t-[2px] border-r-[2px] border-b-[2px] border-l-[2px] border-t-[#c9c9c9] border-r-[#c9c9c9] border-b-[#c9c9c9] border-l-[#c9c9c9]"
                    style={{ display: "block", height: "auto", boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Modules ── */}
        <Section>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ color: "#0f172a" }}>
              The Complete ULTIMATE AFFILIATE 2.0 System
            </h2>
            <p className="text-base" style={{ color: "#64748b" }}>
              10 Power-Packed Modules That Will Transform You From Complete Beginner To Six-Figure Affiliate Marketer
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Module num={1} title="Introduction to Affiliate Marketing" desc="Master the fundamentals and discover the untapped potential of affiliate marketing. Learn how complete beginners are making $10K+ monthly." />
            <Module num={2} title="Affiliate Networks & Account Setup" desc="Explore top networks and set up affiliate accounts to start promoting products." />
            <Module num={3} title="Profitable Niche Selection" desc="Discover the 7 most profitable niches generating millions. Use my proprietary research tools to find untapped markets." />
            <Module num={4} title="Landing Page Mastery" desc="In this module you will learn how you can build advance level landing pages." />
            <Module num={5} title="AI Advanced Funnel Systems" desc="Build automated sales funnels that convert 35%+ visitors into buyers. Copy my exact high-converting templates." />
            <Module num={6} title="Traffic Generation Mastery" desc="Generate unlimited free traffic using platforms that 99% of marketers ignore. Scale to 10K+ daily visitors." />
            <Module num={7} title="High Converting Email Marketing" desc="Build an email list and automate sequences to convert leads into sales." />
            <Module num={8} title="Analytics & Conversion Tracking" desc="Track clicks, conversions, and sales using tools and optimize performance." />
            <Module num={9} title="Advanced Scaling Strategies" desc="Scale your affiliate business to 6-figures using automation, outsourcing, and advanced optimization techniques." />
            <Module num={10} title="Bonuses & Advanced Lessons" desc="Access real-life funnels, scripts, and strategies used to earn with free and paid traffic." />
          </div>
        </Section>

        {/* ── 30-Day Guarantee ── */}
        <Section style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
          <div className="max-w-2xl mx-auto text-center space-y-5">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.3)" }}>
              <ShieldCheck className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wide" style={{ color: "#0f172a" }}>
              30 Days Money Back Guarantee
            </h2>
            <p className="text-base leading-relaxed" style={{ color: "#64748b" }}>
              We Are Confident On Our Course That's Why We Offer 30 Days Money Back Guarantee. If you believe that you have not received any value or results, we will refund double your payment amount — no questions asked.
            </p>
            <CtaBtn label="GET INSTANT ACCESS NOW" />
            <TrustRow />
          </div>
        </Section>

        {/* ── Bonuses ── */}
        <Section>
          <div className="text-center mb-8">
            <p className="text-2xl font-black" style={{ color: "#0f172a" }}>
              FREE BONUSES 🎁
            </p>
            <p className="mt-2 text-base font-bold" style={{ color: "#d97706" }}>
              BONUS: Order Today & Get FREE Access To:
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {[
              { title: "Private VIP Community", value: "₹9,999 Value", emoji: "👥" },
              { title: "1 Year WhatsApp Support", value: "₹7,999 Value", emoji: "📱" },
              { title: "1-on-1 Strategy Call", value: "₹14,999 Value", emoji: "📞" },
              { title: "Lifetime Updates", value: "Priceless", emoji: "♾️" },
            ].map(({ title, value, emoji }) => (
              <div key={title} className="flex items-center gap-4 p-5 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <span className="text-3xl shrink-0">{emoji}</span>
                <div>
                  <p className="font-bold text-sm sm:text-base" style={{ color: "#0f172a" }}>{title}</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: "#16a34a" }}>{value}</p>
                </div>
                <CheckCircle2 className="w-5 h-5 ml-auto shrink-0 text-green-500" />
              </div>
            ))}
          </div>
        </Section>

        {/* ── FAQ ── */}
        <Section style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-8" style={{ color: "#0f172a" }}>
            Frequently Asked Questions
          </h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {FAQS.map(f => <Faq key={f.q} q={f.q} a={f.a} />)}
          </div>
        </Section>

        {/* ── Final CTA ── */}
        <Section className="text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl sm:text-3xl font-black" style={{ color: "#0f172a" }}>
              Don't Let This Opportunity Slip Away
            </h2>
            <p className="text-base" style={{ color: "#64748b" }}>
              Right now, you have a choice. Continue struggling with your current situation, or take action and transform your life in the next 30 days.
            </p>
          </div>

          <img
            src={MOCKUP_IMG}
            alt="Ultimate Affiliate 2.0 Course Mockup"
            style={{ display: "block", width: "100%", height: "auto", maxWidth: "860px", margin: "1.5rem auto 0" }}
          />

          <div className="max-w-2xl mx-auto space-y-6 mt-6">
            <Countdown />

            <div className="space-y-1">
              <p className="text-lg" style={{ color: "#94a3b8" }}>
                Regular Price —{" "}
                <span className="line-through font-bold" style={{ color: "#ef4444" }}>₹2499</span>
              </p>
              <p className="text-2xl sm:text-3xl font-black" style={{ color: "#0f172a" }}>
                For Limited Time Only{" "}
                <span style={{ color: "#2563eb" }}>JUST ₹299</span>
              </p>
            </div>

            <CtaBtn label="YES! I Want Financial Freedom" sub="Protected by 30-day money-back guarantee if you don't see any value or results" />
          </div>
        </Section>

      </main>
      <SiteFooter />
    </div>
  );
}
