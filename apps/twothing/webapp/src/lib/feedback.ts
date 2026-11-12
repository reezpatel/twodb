let ctx: AudioContext | null = null;

/** Short scanner-style beep + haptic tick. `ok` = high chirp, `warn` = low double. */
export function feedback(kind: "ok" | "warn" | "error" = "ok") {
  try {
    navigator.vibrate?.(kind === "ok" ? 40 : [60, 50, 60]);
  } catch {
    /* not supported */
  }
  if (localStorage.getItem("twothing.sound") === "off") return;
  try {
    ctx ??= new AudioContext();
    const tones = kind === "ok" ? [1760] : kind === "warn" ? [660, 660] : [330, 220];
    tones.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      const t = ctx!.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  } catch {
    /* audio blocked */
  }
}
