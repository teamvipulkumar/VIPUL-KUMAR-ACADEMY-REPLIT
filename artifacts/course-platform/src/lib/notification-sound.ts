let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function playNotificationSound(): void {
  const now = Date.now();
  if (now - lastPlayedAt < 250) return;
  lastPlayedAt = now;

  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const t0 = ctx.currentTime;
  const tones: Array<{ freq: number; start: number; duration: number; peak: number }> = [
    { freq: 880,  start: 0.00, duration: 0.18, peak: 0.18 },
    { freq: 1175, start: 0.10, duration: 0.28, peak: 0.16 },
  ];

  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = t.freq;
    gain.gain.setValueAtTime(0, t0 + t.start);
    gain.gain.linearRampToValueAtTime(t.peak, t0 + t.start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + t.start + t.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + t.start);
    osc.stop(t0 + t.start + t.duration);
  }
}
