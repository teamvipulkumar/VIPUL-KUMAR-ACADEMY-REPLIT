import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { SiteFooter } from "@/components/layout/app-layout";
import { ArrowRight, X, Loader2 } from "lucide-react";

const TRUST_BADGES = ["No Upselling", "No Webinars", "No High Ticket Pitches"];

function VidalyticsEmbed() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    wrapper.innerHTML = `<div id="vidalytics_embed_optin" style="width:100%;position:relative;padding-top:56.25%;"></div>`;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.text = `(function (v, i, d, a, l, y, t, c, s) {
      y='_'+d.toLowerCase();c=d+'L';if(!v[d]){v[d]={};}if(!v[c]){v[c]={};}if(!v[y]){v[y]={};}
      var vl='Loader',vli=v[y][vl],vsl=v[c][vl+'Script'],vlf=v[c][vl+'Loaded'],ve='Embed';
      if(!vsl){vsl=function(u,cb){
        if(t){cb();return;}s=i.createElement("script");s.type="text/javascript";s.async=1;s.src=u;
        if(s.readyState){s.onreadystatechange=function(){if(s.readyState==="loaded"||s.readyState=="complete"){s.onreadystatechange=null;vlf=1;cb();}};}
        else{s.onload=function(){vlf=1;cb();};}
        i.getElementsByTagName("head")[0].appendChild(s);
      };}
      vsl(l+'loader.min.js',function(){if(!vli){var vlc=v[c][vl];vli=new vlc();}vli.loadScript(l+'player.min.js',function(){var vec=v[d][ve];t=new vec();t.run(a);});});
    })(window,document,'Vidalytics','vidalytics_embed_optin','https://fast.vidalytics.com/embeds/gVGT5OOt/I48jnMn3fLUdr24x/');`;

    document.head.appendChild(script);

    const style = document.createElement("style");
    style.textContent = `
      #vidalytics_embed_optin video::-webkit-media-controls-picture-in-picture-button { display: none !important; }
    `;
    document.head.appendChild(style);

    const pipTimer = setInterval(() => {
      const videos = document.querySelectorAll<HTMLVideoElement>("#vidalytics_embed_optin video");
      if (videos.length > 0) {
        videos.forEach(v => { v.disablePictureInPicture = true; });
        clearInterval(pipTimer);
      }
    }, 500);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (style.parentNode) style.parentNode.removeChild(style);
      clearInterval(pipTimer);
    };
  }, []);

  return <div ref={wrapperRef} />;
}

export default function OptinPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => setShowCta(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.email.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    setSubmitted(true);
    navigate("/vsl");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0f1e", color: "#ffffff" }}>
      <main
        className="flex-1 flex flex-col items-center justify-center px-4 py-12 md:py-20"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        <div className="w-full max-w-3xl mx-auto text-center space-y-6">

          {/* Headline */}
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight uppercase"
            style={{ letterSpacing: "-0.01em" }}
          >
            Learn How to Start{" "}
            <span style={{ color: "#3b82f6" }}>Affiliate Marketing</span>{" "}
            with{" "}
            <span style={{ color: "#3b82f6" }}>WarriorPlus</span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg font-medium" style={{ color: "#94a3b8" }}>
            The exact system I used to build a{" "}
            <span className="font-bold" style={{ color: "#e2e8f0" }}>6-figure affiliate business</span>{" "}
            — even as a complete beginner
          </p>

          {/* Video */}
          <div
            className="w-full rounded-lg overflow-hidden shadow-2xl"
            style={{ background: "#111827", border: "1px solid #1e293b" }}
          >
            <VidalyticsEmbed />
          </div>

          {/* CTA / Form */}
          {!submitted ? (
            <div
              className={`transition-all duration-700 ${showCta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            >
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4 text-left"
                style={{ backgroundColor: "#111827", border: "1px solid #1e293b" }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748b" }}>
                      First Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Your First Name"
                      value={form.firstName}
                      onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                      required
                      className="w-full h-12 px-4 rounded-xl text-base outline-none transition"
                      style={{
                        background: "#0a0f1e",
                        border: "1px solid #1e293b",
                        color: "#e2e8f0",
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748b" }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Your Last Name"
                      value={form.lastName}
                      onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl text-base outline-none transition"
                      style={{
                        background: "#0a0f1e",
                        border: "1px solid #1e293b",
                        color: "#e2e8f0",
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748b" }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="Enter Your Best Email Address"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    required
                    className="w-full h-12 px-4 rounded-xl text-base outline-none transition"
                    style={{
                      background: "#0a0f1e",
                      border: "1px solid #1e293b",
                      color: "#e2e8f0",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-3 rounded-xl font-extrabold text-sm text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{
                    height: "52px",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    boxShadow: "0 8px 32px rgba(37,99,235,0.35)",
                    letterSpacing: "0.03em",
                  }}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Sending you access...</>
                  ) : (
                    <>YES! SHOW ME THE FREE TRAINING <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div
              className="rounded-2xl p-8 sm:p-12 text-center space-y-4"
              style={{ backgroundColor: "#111827", border: "1px solid #1e293b" }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <span style={{ fontSize: "2rem" }}>✓</span>
              </div>
              <h2 className="text-2xl font-bold" style={{ color: "#e2e8f0" }}>You're In!</h2>
              <p style={{ color: "#94a3b8" }} className="max-w-sm mx-auto">
                Check your inbox — we've sent the free training access link to{" "}
                <span style={{ color: "#e2e8f0" }} className="font-medium">{form.email}</span>.
              </p>
            </div>
          )}

          {/* Trust Badges */}
          {!submitted && (
            <div className="flex flex-nowrap items-center justify-center gap-3 sm:gap-6 pt-2 w-full">
              {TRUST_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="flex items-center gap-1 sm:gap-1.5 font-semibold whitespace-nowrap flex-shrink-0"
                  style={{ color: "#64748b", fontSize: "clamp(9px, 2.5vw, 13px)" }}
                >
                  <span
                    className="flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                    style={{ background: "rgba(239,68,68,0.15)" }}
                  >
                    <X className="w-2 h-2 sm:w-2.5 sm:h-2.5" style={{ color: "#ef4444" }} />
                  </span>
                  {badge}
                </span>
              ))}
            </div>
          )}

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
