/**
 * Procedural Web Audio API soundscape for spacecraft engines, warp drive, and gate transit whooshes.
 * Zero external audio assets needed; cleanly initializes on user gesture.
 */
export class SpaceAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.masterGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.warpOsc = null;
    this.noiseFilter = null;
    this.noiseGain = null;
    this.warpGain = null;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0;
    this.masterGain.connect(this.ctx.destination);

    // 1. Deep twin ion-engine harmonic hum
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 180;
    engineFilter.connect(this.masterGain);

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 54;
    const g1 = this.ctx.createGain();
    g1.gain.value = 0.14;
    this.engineOsc1.connect(g1).connect(engineFilter);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 108.5;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.11;
    this.engineOsc2.connect(g2).connect(engineFilter);

    // 2. Ethereal hyperdrive harmonic resonance
    this.warpOsc = this.ctx.createOscillator();
    this.warpOsc.type = 'sine';
    this.warpOsc.frequency.value = 160;
    this.warpGain = this.ctx.createGain();
    this.warpGain.gain.value = 0.0;
    this.warpOsc.connect(this.warpGain).connect(this.masterGain);

    // 3. Filtered plasma thruster rush noise
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 260;
    this.noiseFilter.Q.value = 0.9;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.06;

    noiseSource.connect(this.noiseFilter).connect(this.noiseGain).connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.warpOsc.start();
    noiseSource.start();
  }

  toggle() {
    if (!this.ctx) {
      this.init();
    }
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.enabled = !this.enabled;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.enabled ? 0.38 : 0.0, now, 0.18);
    return this.enabled;
  }

  update(warp, speedRatio) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;

    this.engineOsc1.frequency.setTargetAtTime(52 + warp * 44 + speedRatio * 12, now, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(104.5 + warp * 92, now, 0.1);
    this.warpOsc.frequency.setTargetAtTime(155 + warp * 210, now, 0.12);
    this.warpGain.gain.setTargetAtTime(warp * 0.14, now, 0.12);
    this.noiseFilter.frequency.setTargetAtTime(240 + warp * 1250, now, 0.12);
    this.noiseGain.gain.setTargetAtTime(0.055 + warp * 0.16, now, 0.12);
  }

  playGateWhoosh(warp) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340 + warp * 240, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.55);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22 + warp * 0.1, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.6);

    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.65);
  }
}
