// Ljudmotor: allt syntetiseras med Web Audio, inga ljudfiler behövs.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.pluckCache = new Map();
  }

  /** Måste anropas från en användargest (tryck) – annars får webbläsaren inte spela ljud. */
  init() {
    if (!this.ctx) {
      // Safari 17+: spela som "media" så att ljudet hörs även när ringsignalsreglaget står på tyst.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* stöds inte */ }
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);

      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, len);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  get now() {
    return this.ctx.currentTime;
  }

  /** Tid som motsvarar det som hörs just nu (kompenserar för utgångslatens). */
  get heardNow() {
    return this.ctx.currentTime - (this.ctx.outputLatency || 0);
  }

  createBus(volume = 1) {
    const g = this.ctx.createGain();
    g.gain.value = volume;
    g.connect(this.master);
    return g;
  }

  fadeOutBus(bus, time = 0.25) {
    const t = this.now;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + time);
    setTimeout(() => bus.disconnect(), (time + 0.3) * 1000);
  }

  // ---- Gitarrton (Karplus–Strong, förrenderad per ton) ----

  pluckBuffer(midi) {
    let buf = this.pluckCache.get(midi);
    if (buf) return buf;
    const sr = this.ctx.sampleRate;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const seconds = 2.6;
    const total = Math.floor(sr * seconds);
    buf = this.ctx.createBuffer(1, total, sr);
    const y = buf.getChannelData(0);

    // Fördröjning med bråkdel så att tonen blir ren även högt upp på halsen.
    const period = sr / freq - 0.5;
    const N = Math.floor(period);
    const frac = period - N;
    const t60 = Math.max(1.2, 3.2 - (midi - 40) * 0.035);
    const g = Math.pow(0.001, 1 / (freq * t60));

    // Excitation: brus, lätt lågpassat för en rundare ton.
    let lp = 0;
    for (let i = 0; i <= N + 1; i++) {
      lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45;
      y[i] = lp;
    }
    let prevD = y[0];
    for (let i = N + 2; i < total; i++) {
      const d = (1 - frac) * y[i - N] + frac * y[i - N - 1];
      y[i] = g * 0.5 * (d + prevD);
      prevD = d;
    }
    const fade = Math.floor(sr * 0.15);
    for (let i = 0; i < fade; i++) y[total - 1 - i] *= i / fade;
    this.pluckCache.set(midi, buf);
    return buf;
  }

  pluck(midi, when = 0, volume = 0.9, dest = this.master) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.pluckBuffer(midi);
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(dest);
    src.start(when || this.now);
    return g;
  }

  /** Ton från greppbrädan. Vid slide dämpas förra tonen så att det låter som en glidning på strängen. */
  fretNote(midi, { slide, prev }) {
    if (slide && prev) {
      const t = this.now;
      prev.gain.setValueAtTime(prev.gain.value, t);
      prev.gain.linearRampToValueAtTime(0, t + 0.07);
    }
    return this.pluck(midi, 0, slide ? 0.65 : 0.9);
  }

  // ---- Trummor ----

  kick(t, dest) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.3);
  }

  noiseHit(t, dest, { type, freq, dur, vol }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  snare(t, dest) {
    this.noiseHit(t, dest, { type: 'bandpass', freq: 1900, dur: 0.16, vol: 0.55 });
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.12);
  }

  hat(t, dest, vol = 0.16) {
    this.noiseHit(t, dest, { type: 'highpass', freq: 7500, dur: 0.045, vol });
  }

  click(t, dest) {
    this.noiseHit(t, dest, { type: 'bandpass', freq: 2600, dur: 0.05, vol: 0.7 });
  }

  /** Ett enkelt 4/4-komp. step = åttondel 0–7 i takten. */
  drumStep(step, t, dest) {
    if (step === 0 || step === 4 || step === 5) this.kick(t, dest);
    if (step === 2 || step === 6) this.snare(t, dest);
    this.hat(t, dest, step % 2 === 0 ? 0.18 : 0.09);
  }

  // ---- Ackord & bas ----

  tone(midi, t, dur, dest, { type = 'triangle', vol = 0.12, attack = 0.02, cutoff = 1800 } = {}) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(vol * 0.45, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  chord(midis, t, dur, dest) {
    midis.forEach((m, i) => {
      const tt = t + i * 0.012;
      this.tone(m, tt, dur, dest, { type: 'sawtooth', vol: 0.05, cutoff: 1400 });
      this.tone(m, tt, dur, dest, { type: 'triangle', vol: 0.09 });
    });
  }

  bass(midi, t, dur, dest) {
    this.tone(midi, t, dur, dest, { type: 'triangle', vol: 0.34, attack: 0.01, cutoff: 500 });
  }
}

export const audio = new AudioEngine();

/** Schemalägger åttondelar i förväg mot ljudklockan så att takten håller sig stadig. */
export class Scheduler {
  constructor(bpm, onStep) {
    this.stepDur = 60 / bpm / 2;
    this.onStep = onStep;
    this.timer = null;
  }

  start(t0) {
    this.next = t0;
    this.index = 0;
    const tick = () => {
      const now = audio.now;
      while (this.next < now + 0.15) {
        // Hoppa över steg som redan passerat (t.ex. om fliken legat i bakgrunden).
        if (this.next > now - 0.05) this.onStep(this.index, this.next);
        this.index++;
        this.next += this.stepDur;
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}
