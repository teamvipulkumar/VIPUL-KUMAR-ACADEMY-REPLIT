import { useState, useEffect } from "react";
import { SiteFooter } from "@/components/layout/app-layout";
import { ShieldCheck, CheckCircle2, MessageCircle, ImageIcon, Zap, Users, Phone, Infinity } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const MOCKUP_IMG = `${API_BASE}/api/files/3b0b3e24eb675e69d0b30312.png`;
const FONT = "'Plus Jakarta Sans', sans-serif";

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
  return { h: Math.floor(left / 3600), m: Math.floor((left % 3600) / 60), s: left % 60 };
}

function Countdown() {
  const { h, m, s } = useCountdown();
  const box = (v: number, label: string) => (
    <div className="flex flex-col items-center gap-1.5">
      <div className="cd-box" style={{
        width: 64, height: 64,
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        borderRadius: 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, fontWeight: 900, color: "#ffffff",
        fontFamily: FONT, fontVariantNumeric: "tabular-nums",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {String(v).padStart(2, "0")}
      </div>
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", fontFamily: FONT }}>{label}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8 }}>
      {box(h, "Hours")}
      <span style={{ fontSize: 28, fontWeight: 900, marginBottom: 20, color: "#2563eb", fontFamily: FONT }}>:</span>
      {box(m, "Minutes")}
      <span style={{ fontSize: 28, fontWeight: 900, marginBottom: 20, color: "#2563eb", fontFamily: FONT }}>:</span>
      {box(s, "Seconds")}
    </div>
  );
}

/* ─── CTA Button ─── */
function CtaBtn({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
      <a
        href="#"
        style={{
          display: "block",
          width: "100%",
          maxWidth: 480,
          padding: "16px 24px",
          borderRadius: 14,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: "clamp(15px, 3.5vw, 19px)",
          color: "#ffffff",
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
          boxShadow: "0 8px 24px rgba(37,99,235,0.40), 0 2px 6px rgba(37,99,235,0.2)",
          textDecoration: "none",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onClick={e => e.preventDefault()}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px rgba(37,99,235,0.50), 0 4px 8px rgba(37,99,235,0.25)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(37,99,235,0.40), 0 2px 6px rgba(37,99,235,0.2)"; }}
      >
        ⚡ {label}
      </a>
      {sub && <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", maxWidth: 340, fontFamily: FONT, lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}

/* ─── Trust Row ─── */
function TrustRow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "8px 20px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: FONT }}>
          <CheckCircle2 size={14} color="#22c55e" /> Instant Access After Payment
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: FONT }}>
          <ShieldCheck size={14} color="#22c55e" /> 30-Day Money Back Guarantee
        </span>
      </div>
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

/* ─── Section Heading ─── */
function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 36 }}>
      <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(28px, 5vw, 38px)", color: "#0f172a", lineHeight: 1.2, margin: 0 }}>{children}</h2>
      {sub && <p style={{ fontFamily: FONT, fontSize: 14, color: "#64748b", marginTop: 8, lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

/* ─── Module Card ─── */
function Module({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="module-card" style={{
      display: "flex", gap: 14, padding: "16px 18px", borderRadius: 14,
      background: "#ffffff", border: "1px solid #e8eef4",
      boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
    }}>
      <div className="module-num" style={{
        flexShrink: 0, width: 38, height: 38, borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg,#1e3a8a,#2563eb)",
        fontFamily: FONT, fontWeight: 800, color: "#fff", fontSize: 14,
      }}>{num}</div>
      <div>
        <h4 style={{ fontFamily: FONT, fontWeight: 700, color: "#0f172a", fontSize: 14, margin: "0 0 4px" }}>{title}</h4>
        <p style={{ fontFamily: FONT, fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.55 }}>{desc}</p>
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
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e8eef4", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <button
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "15px 18px", textAlign: "left", gap: 12, cursor: "pointer", border: "none",
          background: open ? "#f8fafc" : "#ffffff", fontFamily: FONT,
        }}
        onClick={() => setOpen(p => !p)}
      >
        <span style={{ fontWeight: 600, color: "#0f172a", fontSize: 14, lineHeight: 1.4 }}>{q}</span>
        <span style={{ fontSize: 20, color: "#2563eb", flexShrink: 0, fontWeight: 700 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 16px", background: "#f8fafc", borderTop: "1px solid #e8eef4" }}>
          <p style={{ fontFamily: FONT, fontSize: 13, color: "#64748b", lineHeight: 1.65, margin: "12px 0 0" }}>{a}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Price Block ─── */
function PriceBlock() {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontFamily: FONT, fontSize: 14, color: "#94a3b8", marginBottom: 4 }}>
        Regular Price —{" "}
        <span style={{ textDecoration: "line-through", fontWeight: 700, color: "#ef4444" }}>₹2,499</span>
      </p>
      <p style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(18px, 5vw, 26px)", color: "#0f172a", margin: 0 }}>
        For Limited Time Only{" "}
        <span style={{ color: "#2563eb" }}>JUST ₹299</span>
      </p>
    </div>
  );
}

/* ─── Main Page ─── */
export default function OrderPage() {
  return (
    <div className="order-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc", fontFamily: FONT, color: "#0f172a" }}>
      <style>{`
        /* ── Modules: 1 col mobile → 2 col tablet+ ── */
        .grid-modules { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 560px) { .grid-modules { grid-template-columns: repeat(2, 1fr); } }

        /* ── Pain Points: 1 col mobile → 3 col desktop ── */
        .grid-pain { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 560px) { .grid-pain { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 820px) { .grid-pain { grid-template-columns: repeat(3, 1fr); } }

        /* ── Student Results: 1 col mobile → 2 col tablet → 4 col desktop ── */
        .grid-students { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .grid-students .student-img { max-width: 85%; margin: 0 auto; }
        @media (min-width: 560px) { .grid-students { grid-template-columns: repeat(2, 1fr); } .grid-students .student-img { max-width: 100%; } }
        @media (min-width: 820px) { .grid-students { grid-template-columns: repeat(4, 1fr); } }

        /* ── Proof images: 1 col mobile → 2 col tablet+ ── */
        .grid-proof { display: grid; grid-template-columns: 1fr; gap: 14px; max-width: 1100px; margin: 0 auto; }
        @media (min-width: 560px) { .grid-proof { grid-template-columns: repeat(2, 1fr); } }

        /* ── Bonuses: 1 col mobile → 2 col tablet+ ── */
        .grid-bonuses { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 480px) { .grid-bonuses { grid-template-columns: repeat(2, 1fr); } }

        /* ── Countdown boxes: smaller on mobile ── */
        .cd-box { width: 56px !important; height: 56px !important; font-size: 22px !important; border-radius: 10px !important; }
        @media (min-width: 400px) { .cd-box { width: 64px !important; height: 64px !important; font-size: 26px !important; } }

        /* ── Prevent any horizontal overflow ── */
        .order-page * { box-sizing: border-box; }
        .order-page img { max-width: 100%; }

        /* ── Module card: tighter on very small screens ── */
        @media (max-width: 400px) {
          .module-card { padding: 12px 12px !important; gap: 10px !important; }
          .module-num { width: 32px !important; height: 32px !important; font-size: 12px !important; }
        }
      `}</style>
      {/* ── Support Bar ── */}
      <div style={{
        textAlign: "center", padding: "10px 16px", fontSize: 12, fontWeight: 600, fontFamily: FONT,
        background: "#ffffff", borderBottom: "1px solid #e2e8f0", color: "#64748b",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      }}>
        <span>Need Help?</span>
        <a href="https://wa.me/15557485582" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <MessageCircle size={13} />
          WhatsApp Us +15557485582 (We're Here To Help)
        </a>
      </div>
      <main style={{ flex: 1 }}>

        {/* ── Hero ── */}
        <section style={{ background: "#ffffff", padding: "40px 0 0", textAlign: "center", borderBottom: "1px solid #e8eef4" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}>

            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.18)", borderRadius: 999, padding: "5px 14px", marginBottom: 16 }}>
              <Zap size={12} color="#2563eb" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", letterSpacing: "0.06em", textTransform: "uppercase" }}>Limited Time Offer</span>
            </div>

            <h1 style={{
              fontFamily: FONT, fontWeight: 800, lineHeight: 1.15,
              fontSize: "clamp(24px, 6vw, 48px)",
              color: "#0f172a", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "-0.01em",
            }}>
              Turn{" "}<span style={{ color: "#2563eb" }}>$0</span>{" "}Into{" "}
              <span style={{ color: "#2563eb" }}>$10,000+</span>{" "}Monthly<br className="hidden sm:block" /> In Just 30 Days
            </h1>

            <p style={{ fontFamily: FONT, fontSize: "clamp(13px, 3.5vw, 16px)", color: "#64748b", fontWeight: 500, margin: "0 auto 28px", maxWidth: 480, lineHeight: 1.6 }}>
              ULTIMATE AFFILIATE 2.0 — Beginner to Advance Level Affiliate Marketing Masterclass
            </p>
          </div>

          {/* Mockup */}
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 16px" }}>
            <img
              src={MOCKUP_IMG}
              alt="Ultimate Affiliate 2.0 Course Mockup"
              style={{ display: "block", width: "100%", height: "auto", imageRendering: "auto" }}
            />
          </div>

          {/* Countdown + CTA */}
          <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 20px 36px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Urgency label */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", letterSpacing: "0.05em", textTransform: "uppercase" }}>Offer Expires In</span>
            </div>

            <Countdown />
            <PriceBlock />
            <CtaBtn label="GET INSTANT ACCESS" />
            <TrustRow />
          </div>
        </section>

        {/* ── Pain Points ── */}
        <section style={{ background: "#f1f5f9", padding: "48px 16px", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <SectionHeading>Are You Tired Of...</SectionHeading>
            <div className="grid-pain">
              {[
                { title: "Working 9-5 For Peanuts?", desc: "Trading your precious time for a paycheck that barely covers your bills while your boss gets rich?", emoji: "😤" },
                { title: "Failed Online Attempts?", desc: 'Tried dropshipping, crypto, courses but nothing worked? Lost money on "gurus" who disappeared with your cash?', emoji: "😔" },
                { title: "Living Paycheck To Paycheck?", desc: "Stressed about bills, unable to afford luxuries, watching others live the life you dream of?", emoji: "😰" },
              ].map(({ title, desc, emoji }) => (
                <div key={title} style={{
                  background: "#ffffff", borderRadius: 16, padding: "22px 18px", textAlign: "center",
                  border: "1px solid #e8eef4", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{emoji}</div>
                  <h3 style={{ fontFamily: FONT, fontWeight: 700, color: "#0f172a", fontSize: 15, margin: "0 0 6px" }}>{title}</h3>
                  <p style={{ fontFamily: FONT, fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Promise ── */}
        <section style={{ background: "#ffffff", padding: "48px 16px", textAlign: "center" }}>
          <div style={{ maxWidth: 640, margin: "0 auto 32px" }}>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(28px, 5vw, 38px)", color: "#0f172a", lineHeight: 1.2, margin: "0 0 12px" }}>
              What If I Told <span style={{ color: "#2563eb" }}>You...</span>
            </h2>
            <p style={{ fontFamily: FONT, fontWeight: 500, fontSize: "clamp(14px, 4vw, 20px)", color: "#0f172a", lineHeight: 1.4, margin: 0 }}>
              You Could Make More In ONE Month Than Most People Make In A Year...{" "}
              <span style={{ color: "#2563eb" }}>Without Any Previous Experience!</span>
            </p>
          </div>
          <div className="grid-proof">
            {[
              `${API_BASE}/api/files/3034c6d598a19edf3010ef49.png`,
              `${API_BASE}/api/files/037ff30eaf8f7b280256e0ca.png`,
            ].map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Proof screenshot ${i + 1}`}
                style={{
                  display: "block", width: "100%", height: "auto", borderRadius: 12,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.10)", border: "1px solid #e2e8f0",
                }}
                className="border-t-[#c6c6c6] border-r-[#c6c6c6] border-b-[#c6c6c6] border-l-[#c6c6c6] border-t-[1px] border-r-[1px] border-b-[1px] border-l-[1px] rounded-tl-[4px] rounded-tr-[4px] rounded-br-[4px] rounded-bl-[4px]" />
            ))}
          </div>
        </section>

        {/* ── Student Results ── */}
        <section style={{ background: "#f1f5f9", padding: "48px 16px", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <SectionHeading sub="These ordinary people followed the exact system you're about to discover...">
              PROOF: Real Student Results
            </SectionHeading>
            <div className="grid-students">
              {[
                { src: `${API_BASE}/api/files/4d432b070d2d411e24a4d77c.jpg`, label: "STUDENT #1" },
                { src: `${API_BASE}/api/files/964249bf75f7602bc339ad4a.jpg`, label: "STUDENT #2" },
                { src: `${API_BASE}/api/files/6fe2de6bae918f8dd531bb90.jpg`, label: "STUDENT #3" },
                { src: `${API_BASE}/api/files/e49830a459f19fb7933d649b.jpg`, label: "STUDENT #4" },
              ].map(({ src, label }, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: "#2563eb", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
                  <img src={src} alt={label} className="student-img border-t-[#c6c6c6] border-r-[#c6c6c6] border-b-[#c6c6c6] border-l-[#c6c6c6] border-t-[1px] border-r-[1px] border-b-[1px] border-l-[1px] rounded-tl-[12px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px]" style={{
                    display: "block", width: "100%", height: "auto", borderRadius: 12,
                    boxShadow: "0 6px 24px rgba(0,0,0,0.10)", border: "1px solid #e2e8f0",
                  }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Modules ── */}
        <section style={{ background: "#ffffff", padding: "48px 16px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <SectionHeading sub="10 Power-Packed Modules That Will Transform You From Complete Beginner To Six-Figure Affiliate Marketer">
              The Complete ULTIMATE AFFILIATE 2.0 System
            </SectionHeading>
            <div className="grid-modules">
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
          </div>
        </section>

        {/* ── 30-Day Guarantee ── */}
        <section style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%)", padding: "48px 16px", borderTop: "1px solid #dcfce7", borderBottom: "1px solid #dcfce7" }}>
          <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.3)",
            }}>
              <ShieldCheck size={36} color="#16a34a" />
            </div>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(18px, 5vw, 26px)", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.02em", margin: 0 }}>
              30 Days Money Back Guarantee
            </h2>
            <p style={{ fontFamily: FONT, fontSize: 14, color: "#64748b", lineHeight: 1.65, margin: 0 }}>
              We Are Confident On Our Course That's Why We Offer 30 Days Money Back Guarantee. If you believe that you have not received any value or results, we will refund double your payment amount — no questions asked.
            </p>
            <CtaBtn label="GET INSTANT ACCESS NOW" />
            <TrustRow />
          </div>
        </section>

        {/* ── Bonuses ── */}
        <section style={{ background: "#ffffff", padding: "48px 16px" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <p style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(28px, 5vw, 34px)", color: "#0f172a", margin: "0 0 6px" }}>FREE BONUSES 🎁</p>
              <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: "#d97706", margin: 0 }}>BONUS: Order Today & Get FREE Access To:</p>
            </div>
            <div className="grid-bonuses">
              {[
                { title: "Private VIP Community", value: "₹9,999 Value", Icon: Users },
                { title: "1 Year WhatsApp Support", value: "₹7,999 Value", Icon: Phone },
                { title: "1-on-1 Strategy Call", value: "₹14,999 Value", Icon: Zap },
                { title: "Lifetime Updates", value: "Priceless", Icon: Infinity },
              ].map(({ title, value, Icon }) => (
                <div key={title} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12,
                  background: "#f8fafc", border: "1px solid #e8eef4", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(37,99,235,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={18} color="#2563eb" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: "#0f172a", margin: 0 }}>{title}</p>
                    <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: "#16a34a", margin: "2px 0 0" }}>{value}</p>
                  </div>
                  <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ background: "#f1f5f9", padding: "48px 16px", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <SectionHeading>Frequently Asked Questions</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {FAQS.map(f => <Faq key={f.q} q={f.q} a={f.a} />)}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section style={{ background: "#ffffff", padding: "48px 16px", textAlign: "center", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ maxWidth: 640, margin: "0 auto 0" }}>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(28px, 5vw, 38px)", color: "#0f172a", margin: "0 0 10px" }}>
              Don't Let This Opportunity Slip Away
            </h2>
            <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: "#64748b", lineHeight: 1.6, margin: "0 0 24px" }}>
              Right now, you have a choice. Continue struggling with your current situation, or take action and transform your life in the next 30 days.
            </p>
          </div>

          <img
            src={MOCKUP_IMG}
            alt="Ultimate Affiliate 2.0 Course Mockup"
            style={{ display: "block", width: "100%", height: "auto", maxWidth: 860, margin: "0 auto 28px" }}
          />

          <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            <Countdown />
            <PriceBlock />
            <CtaBtn label="YES! I Want Financial Freedom" sub="Protected by 30-day money-back guarantee if you don't see any value or results" />
            <TrustRow />
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
