// audio.js — a fully synthesized WebAudio soundscape: synthwave loop, engine,
// sirens, impacts and UI blips. No audio files, everything is oscillators.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = 0;
    this.chordIdx = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }

  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.25, freq = 1200, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  blip() { this.tone(880, 0.09, 'square', 0.12, 1320); }
  pickup() { this.tone(660, 0.08, 'square', 0.14); this.tone(990, 0.12, 'square', 0.14, null, 0.07); }
  cash() { this.tone(1240, 0.07, 'triangle', 0.2); this.tone(1560, 0.1, 'triangle', 0.2, null, 0.06); this.tone(2090, 0.16, 'triangle', 0.18, null, 0.12); }
  crash(strength = 1) { this.noise(0.22, 0.3 * strength, 700); this.tone(90, 0.25, 'sawtooth', 0.2 * strength, 40); }
  punch() { this.noise(0.08, 0.22, 900); this.tone(140, 0.08, 'sine', 0.25, 60); }
  shot() { this.noise(0.13, 0.32, 2600); this.tone(220, 0.1, 'square', 0.12, 55); }
  hurt() { this.tone(200, 0.16, 'sawtooth', 0.2, 90); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.2, null, i * 0.11)); }
  missionFail() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.18, null, i * 0.12)); }
  starUp() { this.tone(740, 0.1, 'square', 0.16); this.tone(740, 0.1, 'square', 0.16, null, 0.14); }

  setEngine(on, speedRatio) {
    if (!this.ctx) return;
    if (on && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0.0;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    if (this.engineOsc) {
      const target = on && !this.muted ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speedRatio) * 165, this.ctx.currentTime, 0.06);
    }
  }

  setSiren(on, dt) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenPhase = 0;
    }
    if (this.sirenOsc) {
      this.sirenPhase = (this.sirenPhase || 0) + dt * 2.4;
      const f = (this.sirenPhase % 1) < 0.5 ? 720 : 960;
      this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.03);
      this.sirenGain.gain.setTargetAtTime(on && !this.muted ? 0.028 : 0, this.ctx.currentTime, 0.1);
    }
  }

  // A slow synthwave chord loop: Am – F – C – G pads with a soft bass pulse.
  updateMusic(dt, intensity) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 2.1;
    const chords = [[110, 220, 261.6, 329.6], [87.3, 174.6, 220, 261.6], [130.8, 196, 261.6, 329.6], [98, 196, 246.9, 293.7]];
    const chord = chords[this.chordIdx % chords.length];
    this.chordIdx++;
    const vol = 0.035 + intensity * 0.02;
    for (let i = 1; i < chord.length; i++) this.tone(chord[i], 2.0, 'triangle', vol);
    this.tone(chord[0], 0.5, 'sine', 0.09);
    this.tone(chord[0], 0.5, 'sine', 0.07, null, 0.52);
    this.tone(chord[0] * 1.5, 0.4, 'sine', 0.05, null, 1.05);
  }
}
