import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { SiteFooter } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, VideoOff, BadgeDollarSign } from "lucide-react";

const TRUST_BADGES = [
  { label: "No Upselling",           Icon: ShieldCheck },
  { label: "No Webinars",            Icon: VideoOff },
  { label: "No High Ticket Pitches", Icon: BadgeDollarSign },
];

function VidalyticsEmbed() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    wrapper.innerHTML = `<div id="vidalytics_embed_optin2" style="width:100%;position:relative;padding-top:56.25%;"></div>`;

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
    })(window,document,'Vidalytics','vidalytics_embed_optin2','https://fast.vidalytics.com/embeds/gVGT5OOt/I48jnMn3fLUdr24x/');`;

    document.head.appendChild(script);

    const style = document.createElement("style");
    style.textContent = `
      #vidalytics_embed_optin2 video::-webkit-media-controls-picture-in-picture-button { display: none !important; }
    `;
    document.head.appendChild(style);

    const pipTimer = setInterval(() => {
      const videos = document.querySelectorAll<HTMLVideoElement>("#vidalytics_embed_optin2 video");
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

export default function Optin2Page() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}>
      {/* ── Hero / video section ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-2xl mx-auto text-center">

          {/* Eyebrow */}
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
            Free Training
          </span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-[3.25rem] font-extrabold leading-[1.12] tracking-tight text-foreground mb-5">
            Learn How to Start{" "}
            <span className="text-primary">Affiliate Marketing</span>{" "}
            with WarriorPlus
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-5">
            Learn the exact system I used to build a{" "}
            <span className="text-primary font-semibold">6-figure affiliate marketing business</span>{" "}
            from scratch — even if you're a complete beginner.
          </p>

          {/* Video card */}
          <div
            className="rounded-2xl overflow-hidden shadow-2xl shadow-black/30 w-full"
            style={{ backgroundColor: "var(--card)" }}
          >
            <VidalyticsEmbed />
          </div>

          {/* CTA Button */}
          <Button
            onClick={() => navigate("/vsl")}
            className="w-full text-base font-bold bg-primary hover:bg-primary/90 text-white rounded-xl gap-2.5 cta-bounce-glow mt-6"
            style={{ height: "52px" }}
          >
            Show Me The System <ArrowRight className="w-4 h-4" />
          </Button>

          {/* Trust badges */}
          <div className="flex flex-nowrap items-center justify-center gap-3 sm:gap-6 mt-5 w-full">
            {TRUST_BADGES.map(({ label, Icon }) => (
              <span
                key={label}
                className="flex items-center gap-1 sm:gap-1.5 font-medium whitespace-nowrap flex-shrink-0"
                style={{ color: "var(--muted-foreground)", fontSize: "clamp(11px, 2.8vw, 14px)" }}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-primary opacity-70" />
                {label}
              </span>
            ))}
          </div>

        </div>
      </main>

      {/* ── Platform footer ── */}
      <SiteFooter />
    </div>
  );
}
