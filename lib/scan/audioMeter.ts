export type AudioMeterControls = {
  stop: () => void;
};

export async function startAudioMeter(
  stream: MediaStream,
  onLevel: (level: number) => void
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
  analyser.smoothingTimeConstant = 0.55;
  source.connect(analyser);

  const buf = new Uint8Array(analyser.fftSize);

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
    } catch {}
  }, 80);

  return {
    stop: () => {
      try {
        window.clearInterval(interval);
      } catch {}

      try {
        ctx.close();
      } catch {}

      onLevel(0);
    },
  };
}
