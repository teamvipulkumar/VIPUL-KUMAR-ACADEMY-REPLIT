import { useState, useEffect, useRef } from "react";
import { SiteFooter } from "@/components/layout/app-layout";
import { ArrowRight, X } from "lucide-react";

const TRUST_BADGES = ["No Upselling", "No Webinars", "No High Ticket Pitches"];

export default function VslPage() {
  const [showCta, setShowCta] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowCta(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0f1e", color: "#ffffff" }}>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 md:py-20">
        <div className="w-full max-w-3xl mx-auto text-center space-y-6">

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Earn{" "}
            <span style={{ color: "#3b82f6" }}>$10000+</span>{" "}
            Per Month With{" "}
            <span style={{ color: "#3b82f6" }}>Affiliate Marketing</span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg" style={{ color: "#94a3b8" }}>
            Watch How I Made a 6 Figure Business with{" "}
            <span className="font-semibold" style={{ color: "#e2e8f0" }}>WarriorPlus</span>
          </p>

          {/* Video */}
          <div className="w-full rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#111827", border: "1px solid #1e293b" }}>
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "#111827" }}>
                {/* Placeholder — swap src with real embed URL */}
                <VideoPlaceholder />
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div
            ref={ctaRef}
            className={`transition-all duration-700 ${showCta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <a
              href="#"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-xl font-extrabold text-lg text-white shadow-xl transition-all hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                boxShadow: "0 8px 32px rgba(37,99,235,0.35)",
                letterSpacing: "0.03em",
              }}
            >
              YES! I WANT TO START
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 pt-2">
            {TRUST_BADGES.map(badge => (
              <span
                key={badge}
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: "#94a3b8" }}
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full" style={{ background: "rgba(239,68,68,0.15)" }}>
                  <X className="w-3 h-3" style={{ color: "#ef4444" }} />
                </span>
                {badge}
              </span>
            ))}
          </div>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function VideoPlaceholder() {
  const [clicked, setClicked] = useState(false);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group" onClick={() => setClicked(true)}>
      {/* Fake screen background */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }} />

      {/* Blurred dashboard mockup lines */}
      <div className="absolute inset-0 flex flex-col gap-3 p-8 opacity-20 blur-[1px] pointer-events-none select-none">
        <div className="h-4 rounded w-2/3" style={{ background: "#334155" }} />
        <div className="h-4 rounded w-1/2" style={{ background: "#334155" }} />
        <div className="grid grid-cols-3 gap-3 mt-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg p-3 space-y-2" style={{ background: "#1e293b", border: "1px solid #334155" }}>
              <div className="h-3 rounded w-3/4" style={{ background: "#475569" }} />
              <div className="h-6 rounded w-1/2" style={{ background: "#3b82f6", opacity: 0.6 }} />
            </div>
          ))}
        </div>
        <div className="flex-1 rounded-lg mt-2" style={{ background: "#1e293b", border: "1px solid #334155" }} />
      </div>

      {/* Overlay box — "Your Video Is Playing" */}
      {!clicked ? (
        <div
          className="relative z-10 flex flex-col items-center justify-center gap-3 rounded-xl px-8 py-6 text-center"
          style={{ background: "rgba(37,99,235,0.75)", backdropFilter: "blur(6px)", minWidth: "200px" }}
        >
          {/* Speaker icon */}
          <svg className="w-10 h-10 text-white opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-white font-bold text-lg leading-tight">Your Video Is Playing</p>
          <p className="text-white/80 font-semibold text-sm">Click To Unmute</p>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <p className="text-white/60 text-sm">Loading video…</p>
        </div>
      )}

      {/* Bottom bar mockup */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-2"
        style={{ background: "rgba(15,23,42,0.9)", borderTop: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-4 h-4 rounded-full" style={{ background: "#475569" }} />
        <div className="w-4 h-4 rounded-full" style={{ background: "#475569" }} />
        <div className="flex-1 h-1 rounded-full" style={{ background: "#1e293b" }}>
          <div className="h-1 rounded-full w-[1%]" style={{ background: "#3b82f6" }} />
        </div>
        <span className="text-xs" style={{ color: "#475569" }}>00:01</span>
        <div className="w-4 h-4 rounded-full ml-auto" style={{ background: "#475569" }} />
      </div>
    </div>
  );
}
