import { useState, useEffect, useRef } from "react";
import { SiteFooter } from "@/components/layout/app-layout";
import { ArrowRight, X } from "lucide-react";

const TRUST_BADGES = ["No Upselling", "No Webinars", "No High Ticket Pitches"];

function VidalyticsEmbed() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    wrapper.innerHTML = `<div id="vidalytics_embed_I48jnMn3fLUdr24x" style="width:100%;position:relative;padding-top:56.25%;"></div>`;

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
    })(window,document,'Vidalytics','vidalytics_embed_I48jnMn3fLUdr24x','https://fast.vidalytics.com/embeds/gVGT5OOt/I48jnMn3fLUdr24x/');`;

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  return <div ref={wrapperRef} />;
}

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
            <VidalyticsEmbed />
          </div>

          {/* CTA Button */}
          <div
            ref={ctaRef}
            className={`transition-all duration-700 ${showCta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <a
              href="/order"
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
