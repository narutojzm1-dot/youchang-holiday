export interface YardAudio {
  unlock: () => void;
  setWeather: (weather: "sun" | "cloud" | "rain" | "fog") => void;
  honk: () => void;
  hay: () => void;
  paper: () => void;
  stop: () => void;
}

export function createYardAudio(): YardAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let windGain: GainNode | null = null;
  let rainGain: GainNode | null = null;
  let noise: AudioBufferSourceNode | null = null;

  function context() {
    if (!ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = "lowpass";
      windFilter.frequency.value = 420;
      windGain = ctx.createGain();
      windGain.gain.value = 0.015;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = "highpass";
      rainFilter.frequency.value = 900;
      rainGain = ctx.createGain();
      rainGain.gain.value = 0;
      noise.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(master);
      noise.start();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  return {
    unlock() {
      context();
    },
    setWeather(weather) {
      if (!windGain || !rainGain || !ctx) return;
      const now = ctx.currentTime;
      windGain.gain.cancelScheduledValues(now);
      rainGain.gain.cancelScheduledValues(now);
      windGain.gain.linearRampToValueAtTime(weather === "rain" ? 0.02 : 0.012, now + 0.4);
      rainGain.gain.linearRampToValueAtTime(weather === "rain" ? 0.04 : 0, now + 0.4);
    },
    honk() {
      const audio = context();
      if (!master) return;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(280, audio.currentTime + 0.18);
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, audio.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(audio.currentTime + 0.3);
    },
    hay() {
      const audio = context();
      if (!master) return;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = 140;
      gain.gain.setValueAtTime(0.04, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(audio.currentTime + 0.2);
    },
    paper() {
      const audio = context();
      if (!master) return;
      const buffer = audio.createBuffer(1, audio.sampleRate * 0.2, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = audio.createBufferSource();
      src.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      const gain = audio.createGain();
      gain.gain.value = 0.08;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    },
    stop() {
      if (noise) noise.stop();
      void ctx?.close();
      ctx = null;
    },
  };
}
