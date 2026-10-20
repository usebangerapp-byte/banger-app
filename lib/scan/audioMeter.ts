export type AudioMeterControls = {
  stop: () => void;
};

export async function startAudioMeter(
  stream: MediaStream,
  onLevel: (level: number) => void,
  /** 0..1 punch on bass hits (kick drum), decays fast — drives the woofer cone */
  onKick?: (kick: number) => void
): Promise<AudioMeterControls> {
  const scanWindow = window as Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

  const AudioCtx =
    (window.AudioContext || scanWindow.webkitAudioContext) as typeof AudioContext;

  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();

  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.35;
  source.connect(analyser);

  const buf = new Uint8Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  // Bass band ≈ 40–180 Hz whatever the sample rate
  const binHz = ctx.sampleRate / analyser.fftSize;
  const lo = Math.max(1, Math.floor(40 / binHz));
  const hi = Math.max(lo + 1, Math.ceil(180 / binHz));
  let bassAvg = 0;
  let kickEnv = 0;

  const interval = window.setInterval(() => {
    try {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;

      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }

      const rms = Math.sqrt(sum / buf.length);
      const lvl = Math.max(0, Math.min(1, (rms - 0.01) / 0.18));
      onLevel(lvl);

      if (onKick) {
        // Kick detection: bass energy jumping above its own running average
        analyser.getByteFrequencyData(freq);
        let b = 0;
        for (let i = lo; i <= hi; i++) b += freq[i];
        const bass = b / ((hi - lo + 1) * 255);
        bassAvg = bassAvg * 0.88 + bass * 0.12;
        const hit = Math.max(0, Math.min(1, (bass - bassAvg * 1.04) / 0.18));
        kickEnv = Math.max(hit, kickEnv * 0.55); // fast attack, quick release
        onKick(kickEnv < 0.02 ? 0 : kickEnv);
      }
    } catch {}
  }, 40);

  return {
    stop: () => {
      try {
        window.clearInterval(interval);
      } catch {}

      try {
        ctx.close();
      } catch {}

      onLevel(0);
      onKick?.(0);
    },
  };
}
