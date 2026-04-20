import { useState, useEffect } from "react";
import { SiteFooter } from "@/components/layout/app-layout";
import { ShieldCheck, CheckCircle2, MessageCircle, Zap, Users, Phone, Infinity, Lock, Clock } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const FONT = "'Plus Jakarta Sans', sans-serif";

const D = {
  pageBg:    "#060b14",
  sectionAlt:"#0d1424",
  card:      "#111827",
  cardBorder:"#1e2d40",
  text:      "#f1f5f9",
  textSub:   "#94a3b8",
  textMuted: "#64748b",
  border:    "#1e293b",
  blue:      "#2563eb",
  blueDark:  "#1d4ed8",
  green:     "#22c55e",
  greenDark: "#16a34a",
  red:       "#ef4444",
};

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

function CountdownBoxes() {
  const { h, m, s } = useCountdown();
  const box = (v: number, label: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div className="cd-box" style={{
        width: 60, height: 60, borderRadius: 10,
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        border: "1px solid rgba(37,99,235,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: FONT,
        fontVariantNumeric: "tabular-nums",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}>
        {String(v).padStart(2, "0")}
      </div>
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: D.textMuted, fontFamily: FONT }}>{label}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
      {box(h, "Hours")}
      <span style={{ fontSize: 24, fontWeight: 900, marginBottom: 18, color: D.blue, fontFamily: FONT }}>:</span>
      {box(m, "Minutes")}
      <span style={{ fontSize: 24, fontWeight: 900, marginBottom: 18, color: D.blue, fontFamily: FONT }}>:</span>
      {box(s, "Seconds")}
    </div>
  );
}

/* ─── Self-contained Plan Card ─── */
function PlanCard() {
  return (
    <div style={{
      maxWidth: 520, margin: "0 auto",
      borderRadius: 20, border: `2px solid ${D.blue}`,
      boxShadow: "0 12px 60px rgba(37,99,235,0.22)", overflow: "hidden", textAlign: "left",
    }}>
      {/* Card Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", padding: "22px 26px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 8px", marginBottom: 6 }}>
          <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10, color: "rgba(255,255,255,0.65)", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0, whiteSpace: "nowrap" }}>Complete Training Program</p>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10, color: "#fff", background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "2px 8px", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>🎬 Recorded Course</span>
        </div>
        <h3 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(18px, 4vw, 24px)", color: "#ffffff", margin: "0 0 3px", letterSpacing: "-0.01em" }}>ULTIMATE AFFILIATE 2.0</h3>
        <p style={{ fontFamily: FONT, fontWeight: 500, fontSize: 12, color: "rgba(255,255,255,0.72)", margin: 0 }}>Everything you need to go from zero to 6-figures</p>
      </div>

      {/* Inclusions */}
      <div style={{ background: D.card, padding: "20px 26px 0" }}>
        <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: D.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 12px" }}>What's Included:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {[
            "10 Power-Packed Training Modules (10+ Hours)",
            "Beginner to Advanced Affiliate Marketing System",
            "Step-by-Step Funnel Building Templates",
            "AI-Powered Traffic Generation Strategies",
            "High-Converting Email Marketing Sequences",
            "Analytics & Conversion Tracking Masterclass",
            "Private VIP Community Access",
            "1 Year WhatsApp Support",
            "1-on-1 Strategy Call",
            "Lifetime Updates — Always Current",
          ].map(item => (
            <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
              <CheckCircle2 size={15} color={D.green} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontFamily: FONT, fontSize: 13, color: D.text, lineHeight: 1.45 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FOMO Timer */}
      <div style={{ background: D.card, padding: "18px 26px 0" }}>
        <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: D.red, animation: "pulse 1.5s infinite" }} />
            <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: D.red, letterSpacing: "0.06em", textTransform: "uppercase" }}>Offer Expires In</span>
            <Clock size={12} color={D.red} />
          </div>
          <CountdownBoxes />
        </div>
      </div>

      {/* Pricing */}
      <div style={{ background: D.card, padding: "16px 26px 0", textAlign: "center" }}>
        <p style={{ fontFamily: FONT, fontSize: 13, color: D.textMuted, margin: "0 0 4px" }}>
          Regular Price —{" "}
          <span style={{ textDecoration: "line-through", fontWeight: 700, color: D.red }}>₹2,499</span>
        </p>
        <p style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(17px, 4vw, 22px)", color: D.text, margin: "0 0 6px" }}>
          For Limited Time Only{" "}
          <span style={{ color: D.blue }}>JUST ₹299</span>
        </p>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: D.greenDark, background: "rgba(22,163,74,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 999, padding: "3px 12px", letterSpacing: "0.04em" }}>88% OFF — Limited Time Only</span>
      </div>

      {/* CTA Button */}
      <div style={{ background: D.card, padding: "16px 26px 0" }}>
        <a
          href="#"
          onClick={e => e.preventDefault()}
          style={{
            display: "block", width: "100%", padding: "15px 24px", borderRadius: 12,
            fontFamily: FONT, fontWeight: 800, fontSize: "clamp(14px, 3.5vw, 17px)",
            color: "#ffffff", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em",
            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            boxShadow: "0 8px 28px rgba(37,99,235,0.45)",
            textDecoration: "none",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          className="cta-btn"
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.animation = "none"; el.style.transform = "translateY(-2px) scale(1.03)"; el.style.boxShadow = "0 14px 40px rgba(37,99,235,0.65)"; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.animation = ""; el.style.transform = ""; el.style.boxShadow = ""; }}
        >
          ⚡ GET INSTANT ACCESS NOW
        </a>
      </div>

      {/* Trust row */}
      <div style={{ background: D.card, padding: "12px 26px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "6px 18px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: D.textMuted }}>
            <Lock size={12} color={D.green} /> Instant Access After Payment
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: D.textMuted }}>
            <ShieldCheck size={12} color={D.green} /> 30-Day Money Back Guarantee
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Section Heading ─── */
function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 36 }}>
      <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(26px, 5vw, 36px)", color: D.text, lineHeight: 1.2, margin: 0 }}>{children}</h2>
      {sub && <p style={{ fontFamily: FONT, fontSize: 14, color: D.textSub, marginTop: 8, lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

/* ─── Module Card ─── */
function Module({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="module-card" style={{
      display: "flex", gap: 14, padding: "16px 18px", borderRadius: 14,
      background: D.card, border: `1px solid ${D.cardBorder}`,
      boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
    }}>
      <div className="module-num" style={{
        flexShrink: 0, width: 38, height: 38, borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg,#1e3a8a,#2563eb)",
        fontFamily: FONT, fontWeight: 800, color: "#fff", fontSize: 14,
      }}>{num}</div>
      <div>
        <h4 style={{ fontFamily: FONT, fontWeight: 700, color: D.text, fontSize: 14, margin: "0 0 4px" }}>{title}</h4>
        <p style={{ fontFamily: FONT, fontSize: 13, color: D.textSub, margin: 0, lineHeight: 1.55 }}>{desc}</p>
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
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${D.cardBorder}`, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
      <button
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "15px 18px", textAlign: "left", gap: 12, cursor: "pointer", border: "none",
          background: open ? "#162032" : D.card, fontFamily: FONT,
        }}
        onClick={() => setOpen(p => !p)}
      >
        <span style={{ fontWeight: 600, color: D.text, fontSize: 14, lineHeight: 1.4 }}>{q}</span>
        <span style={{ fontSize: 20, color: D.blue, flexShrink: 0, fontWeight: 700 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 16px", background: "#162032", borderTop: `1px solid ${D.cardBorder}` }}>
          <p style={{ fontFamily: FONT, fontSize: 13, color: D.textSub, lineHeight: 1.65, margin: "12px 0 0" }}>{a}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function OrderPage() {
  return (
    <div className="order-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: D.pageBg, fontFamily: FONT, color: D.text }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes ctaGlow {
          0%,100% { box-shadow: 0 8px 28px rgba(37,99,235,0.45), 0 0 0 0 rgba(37,99,235,0.4); transform: scale(1); }
          50%     { box-shadow: 0 12px 40px rgba(37,99,235,0.7), 0 0 0 8px rgba(37,99,235,0); transform: scale(1.025); }
        }
        .cta-btn { animation: ctaGlow 2s ease-in-out infinite; }

        .grid-modules { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 560px) { .grid-modules { grid-template-columns: repeat(2, 1fr); } }

        .grid-pain { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 560px) { .grid-pain { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 820px) { .grid-pain { grid-template-columns: repeat(3, 1fr); } }

        .grid-students { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .grid-students .student-img { max-width: 85%; margin: 0 auto; }
        @media (min-width: 560px) { .grid-students { grid-template-columns: repeat(2, 1fr); } .grid-students .student-img { max-width: 100%; } }
        @media (min-width: 820px) { .grid-students { grid-template-columns: repeat(4, 1fr); } }

        .grid-proof { display: grid; grid-template-columns: 1fr; gap: 14px; max-width: 1100px; margin: 0 auto; }
        @media (min-width: 560px) { .grid-proof { grid-template-columns: repeat(2, 1fr); } }

        .grid-bonuses { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 480px) { .grid-bonuses { grid-template-columns: repeat(2, 1fr); } }

        .cd-box { width: 52px !important; height: 52px !important; font-size: 20px !important; border-radius: 9px !important; }
        @media (min-width: 400px) { .cd-box { width: 60px !important; height: 60px !important; font-size: 24px !important; } }

        .order-page * { box-sizing: border-box; }
        .order-page img { max-width: 100%; }

        @media (max-width: 400px) {
          .module-card { padding: 12px 12px !important; gap: 10px !important; }
          .module-num { width: 32px !important; height: 32px !important; font-size: 12px !important; }
        }
      `}</style>

      {/* ── Support Bar ── */}
      <div style={{
        textAlign: "center", padding: "10px 16px", fontSize: 12, fontWeight: 600, fontFamily: FONT,
        background: "#0d1424", borderBottom: `1px solid ${D.border}`, color: D.textMuted,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      }}>
        <span>Need Help?</span>
        <a href="https://wa.me/15557485582" style={{ color: D.blue, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <MessageCircle size={13} />
          WhatsApp Us +15557485582 (We're Here To Help)
        </a>
      </div>

      <main style={{ flex: 1 }}>

        {/* ── Hero ── */}
        <section style={{ background: D.pageBg, padding: "44px 16px 52px", textAlign: "center", borderBottom: `1px solid ${D.border}` }}>
          <div style={{ maxWidth: 720, margin: "0 auto 32px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 999, padding: "5px 14px", marginBottom: 16 }}>
              <Zap size={12} color={D.blue} />
              <span style={{ fontSize: 11, fontWeight: 700, color: D.blue, letterSpacing: "0.06em", textTransform: "uppercase" }}>Limited Time Offer</span>
            </div>
            <h1 style={{ fontFamily: FONT, fontWeight: 800, lineHeight: 1.15, fontSize: "clamp(26px, 6vw, 48px)", color: D.text, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "-0.01em" }}>
              Turn{" "}<span style={{ color: D.blue }}>$0</span>{" "}Into{" "}
              <span style={{ color: D.blue }}>$10,000+</span>{" "}Monthly<br className="hidden sm:block" /> In Just 30 Days
            </h1>
            <p style={{ fontFamily: FONT, fontSize: "clamp(13px, 3.5vw, 16px)", color: D.textSub, fontWeight: 500, margin: "0 auto", maxWidth: 480, lineHeight: 1.6 }}>
              ULTIMATE AFFILIATE 2.0 — Beginner to Advance Level Affiliate Marketing Masterclass
            </p>
          </div>
          <PlanCard />
        </section>

        {/* ── Pain Points ── */}
        <section style={{ background: D.sectionAlt, padding: "52px 16px", borderTop: `1px solid ${D.border}` }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <SectionHeading>Are You Tired Of...</SectionHeading>
            <div className="grid-pain">
              {[
                { title: "Working 9-5 For Peanuts?", desc: "Trading your precious time for a paycheck that barely covers your bills while your boss gets rich?", emoji: "😤" },
                { title: "Failed Online Attempts?", desc: 'Tried dropshipping, crypto, courses but nothing worked? Lost money on "gurus" who disappeared with your cash?', emoji: "😔" },
                { title: "Living Paycheck To Paycheck?", desc: "Stressed about bills, unable to afford luxuries, watching others live the life you dream of?", emoji: "😰" },
              ].map(({ title, desc, emoji }) => (
                <div key={title} style={{
                  background: D.card, borderRadius: 16, padding: "22px 18px", textAlign: "center",
                  border: `1px solid ${D.cardBorder}`, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{emoji}</div>
                  <h3 style={{ fontFamily: FONT, fontWeight: 700, color: D.text, fontSize: 15, margin: "0 0 6px" }}>{title}</h3>
                  <p style={{ fontFamily: FONT, fontSize: 13, color: D.textSub, margin: 0, lineHeight: 1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Promise ── */}
        <section style={{ background: D.pageBg, padding: "52px 16px", textAlign: "center" }}>
          <div style={{ maxWidth: 640, margin: "0 auto 32px" }}>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(28px, 5vw, 38px)", color: D.text, lineHeight: 1.2, margin: "0 0 12px" }}>
              What If I Told <span style={{ color: D.blue }}>You...</span>
            </h2>
            <p style={{ fontFamily: FONT, fontWeight: 500, fontSize: "clamp(14px, 4vw, 20px)", color: D.textSub, lineHeight: 1.4, margin: 0 }}>
              You Could Make More In ONE Month Than Most People Make In A Year...{" "}
              <span style={{ color: D.blue }}>Without Any Previous Experience!</span>
            </p>
          </div>
          <div className="grid-proof">
            {[
              `${API_BASE}/api/files/3034c6d598a19edf3010ef49.png`,
              `${API_BASE}/api/files/037ff30eaf8f7b280256e0ca.png`,
            ].map((src, i) => (
              <img key={i} src={src} alt={`Proof screenshot ${i + 1}`} style={{
                display: "block", width: "100%", height: "auto", borderRadius: 12,
                boxShadow: "0 4px 24px rgba(0,0,0,0.3)", border: "2px solid #94a3b8",
              }} />
            ))}
          </div>
        </section>

        {/* ── Student Results ── */}
        <section style={{ background: D.sectionAlt, padding: "52px 16px", borderTop: `1px solid ${D.border}` }}>
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
                  <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: D.blue, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
                  <img src={src} alt={label} className="student-img" style={{
                    display: "block", width: "100%", height: "auto", borderRadius: 12,
                    boxShadow: "0 6px 24px rgba(0,0,0,0.3)", border: "2px solid #94a3b8",
                  }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Modules ── */}
        <section style={{ background: D.pageBg, padding: "52px 16px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <SectionHeading sub="10 Power-Packed Modules That Will Transform You From Complete Beginner To Six-Figure Affiliate Marketer">
              The Complete <span style={{ color: D.blue }}>ULTIMATE AFFILIATE 2.0</span> System
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
        <section style={{ background: "linear-gradient(135deg, #071a0f 0%, #0d1424 100%)", padding: "52px 16px", borderTop: "1px solid rgba(34,197,94,0.15)", borderBottom: "1px solid rgba(34,197,94,0.15)" }}>
          <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.25)",
            }}>
              <ShieldCheck size={36} color={D.greenDark} />
            </div>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(18px, 5vw, 26px)", color: D.text, textTransform: "uppercase", letterSpacing: "0.02em", margin: 0 }}>
              30 Days Money Back Guarantee
            </h2>
            <p style={{ fontFamily: FONT, fontSize: 14, color: D.textSub, lineHeight: 1.65, margin: 0 }}>
              We Are Confident On Our Course That's Why We Offer 30 Days Money Back Guarantee. If you believe that you have not received any value or results, we will refund double your payment amount — no questions asked.
            </p>
            <a
              href="#"
              onClick={e => e.preventDefault()}
              style={{
                display: "inline-block", padding: "14px 32px", borderRadius: 12, fontFamily: FONT, fontWeight: 800,
                fontSize: 15, color: "#fff", background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                boxShadow: "0 8px 24px rgba(37,99,235,0.4)", textDecoration: "none", letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >⚡ GET INSTANT ACCESS NOW</a>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "6px 18px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: D.textMuted }}>
                <Lock size={12} color={D.green} /> Instant Access After Payment
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: D.textMuted }}>
                <ShieldCheck size={12} color={D.green} /> 30-Day Money Back Guarantee
              </span>
            </div>
          </div>
        </section>

        {/* ── Bonuses ── */}
        <section style={{ background: D.pageBg, padding: "52px 16px" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <p style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(28px, 5vw, 34px)", color: D.text, margin: "0 0 6px" }}>FREE BONUSES 🎁</p>
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
                  background: D.card, border: `1px solid ${D.cardBorder}`, boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(37,99,235,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={18} color={D.blue} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: D.text, margin: 0 }}>{title}</p>
                    <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: D.greenDark, margin: "2px 0 0" }}>{value}</p>
                  </div>
                  <CheckCircle2 size={16} color={D.green} style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ background: D.sectionAlt, padding: "52px 16px", borderTop: `1px solid ${D.border}` }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <SectionHeading>Frequently Asked Questions</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {FAQS.map(f => <Faq key={f.q} q={f.q} a={f.a} />)}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section style={{ background: D.pageBg, padding: "52px 16px", textAlign: "center", borderTop: `1px solid ${D.border}` }}>
          <div style={{ maxWidth: 640, margin: "0 auto 32px" }}>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(28px, 5vw, 38px)", color: D.text, margin: "0 0 10px" }}>
              Don't Let This <span style={{ color: D.blue }}>Opportunity</span> Slip Away
            </h2>
            <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: D.textSub, lineHeight: 1.6, margin: 0 }}>
              Right now, you have a choice. Continue struggling with your current situation, or take action and transform your life in the next 30 days.
            </p>
          </div>
          <PlanCard />
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
