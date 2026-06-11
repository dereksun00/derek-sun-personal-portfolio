import * as Tone from 'tone';

/**
 * Procedural chiptune SFX engine. Every sound is synthesized — no audio files.
 * Tone.start() must be called from a user gesture; play() lazily handles that.
 */
class AudioEngine {
  private started = false;
  private muted = false;

  private square!: Tone.Synth;
  private triangle!: Tone.Synth;
  private noise!: Tone.NoiseSynth;
  private sub!: Tone.MembraneSynth;
  private rumbleNoise: Tone.Noise | null = null;
  private rumbleFilter: Tone.Filter | null = null;
  private rumbleGain: Tone.Gain | null = null;

  private ensureGraph() {
    if (this.square) return;
    this.square = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
      volume: -16,
    }).toDestination();
    this.triangle = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
      volume: -12,
    }).toDestination();
    this.noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
      volume: -20,
    }).toDestination();
    this.sub = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0 },
      volume: -8,
    }).toDestination();
  }

  async unlock() {
    if (this.started) return;
    try {
      await Tone.start();
      this.ensureGraph();
      this.started = true;
      Tone.getDestination().mute = this.muted;
    } catch {
      /* gesture not accepted yet — next call retries */
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.started) Tone.getDestination().mute = m;
  }

  private go(fn: () => void) {
    if (!this.started || this.muted) {
      // fire-and-forget unlock so the *next* interaction has sound
      void this.unlock();
      if (!this.started || this.muted) return;
    }
    try {
      fn();
    } catch {
      /* overlapping triggers on the same synth can throw; sfx are non-critical */
    }
  }

  /* ── menu / ui ─────────────────────────────────────────── */
  blip() { this.go(() => this.square.triggerAttackRelease(440, 0.04)); }
  cursor() { this.blip(); }
  confirm() {
    this.go(() => {
      const t = Tone.now();
      this.square.triggerAttackRelease(523, 0.06, t);
      this.square.triggerAttackRelease(784, 0.08, t + 0.07);
    });
  }
  back() {
    this.go(() => {
      const t = Tone.now();
      this.square.triggerAttackRelease(330, 0.06, t);
      this.square.triggerAttackRelease(220, 0.08, t + 0.08);
    });
  }
  open() {
    this.go(() => {
      const t = Tone.now();
      [392, 523, 659, 784, 988].forEach((f, i) =>
        this.square.triggerAttackRelease(f, 0.05, t + i * 0.05));
    });
  }
  fanfare() {
    this.go(() => {
      const t = Tone.now();
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
        this.triangle.triggerAttackRelease(f, 0.09, t + i * 0.09));
    });
  }
  bootBlip() { this.go(() => this.square.triggerAttackRelease(220, 0.03)); }
  /** CRT power-on "click" — sharp noise tick + low thunk */
  crtClick() {
    this.go(() => {
      const t = Tone.now();
      this.noise.triggerAttackRelease(0.03, t);
      this.sub.triggerAttackRelease(60, 0.15, t + 0.01);
    });
  }
  coin() {
    this.go(() => {
      const t = Tone.now();
      this.square.triggerAttackRelease(988, 0.06, t);
      this.square.triggerAttackRelease(1319, 0.25, t + 0.07);
    });
  }
  marioCoin() {
    this.go(() => {
      const t = Tone.now();
      this.square.triggerAttackRelease(523, 0.05, t);
      this.square.triggerAttackRelease(1047, 0.2, t + 0.06);
    });
  }
  jump() {
    this.go(() => {
      const s = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
        volume: -18,
      }).toDestination();
      s.triggerAttack(180);
      s.frequency.rampTo(620, 0.15);
      s.triggerRelease(Tone.now() + 0.18);
      setTimeout(() => s.dispose(), 600);
    });
  }
  glitch() {
    this.go(() => {
      const t = Tone.now();
      this.noise.triggerAttackRelease(0.04, t);
      this.noise.triggerAttackRelease(0.02, t + 0.07);
    });
  }
  reelTick() { this.go(() => this.square.triggerAttackRelease(660, 0.02)); }
  lever() {
    this.go(() => {
      const t = Tone.now();
      this.noise.triggerAttackRelease(0.08, t);
      this.sub.triggerAttackRelease(90, 0.2, t);
    });
  }
  jackpot() { this.fanfare(); }
  zap() {
    this.go(() => {
      const s = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.02 },
        volume: -18,
      }).toDestination();
      s.triggerAttack(880);
      s.frequency.rampTo(220, 0.14);
      s.triggerRelease(Tone.now() + 0.15);
      setTimeout(() => s.dispose(), 500);
    });
  }
  punch() {
    this.go(() => {
      const t = Tone.now();
      this.noise.triggerAttackRelease(0.06, t);
      this.sub.triggerAttackRelease(80, 0.2, t);
    });
  }
  ko() {
    this.go(() => {
      const t = Tone.now();
      this.sub.triggerAttackRelease(40, 0.4, t);
      this.triangle.triggerAttackRelease(1200, 0.4, t + 0.05);
    });
  }

  /* ── black hole transition ─────────────────────────────── */
  /** Filtered-noise rumble that builds with the collapse. Call stopRumble() after. */
  startRumble(durationSec: number) {
    this.go(() => {
      this.stopRumble();
      this.rumbleGain = new Tone.Gain(0).toDestination();
      this.rumbleFilter = new Tone.Filter(120, 'lowpass').connect(this.rumbleGain);
      this.rumbleNoise = new Tone.Noise('brown').connect(this.rumbleFilter);
      this.rumbleNoise.start();
      this.rumbleGain.gain.rampTo(0.5, durationSec * 0.85);
      this.rumbleFilter.frequency.rampTo(320, durationSec);
    });
  }
  /** The collapse "whoomp": kill the rumble, hit a deep sub. */
  whoomp() {
    this.go(() => {
      this.sub.triggerAttackRelease(35, 0.6);
      if (this.rumbleGain) this.rumbleGain.gain.rampTo(0, 0.12);
      setTimeout(() => this.stopRumble(), 200);
    });
  }
  stopRumble() {
    this.rumbleNoise?.stop();
    this.rumbleNoise?.dispose();
    this.rumbleFilter?.dispose();
    this.rumbleGain?.dispose();
    this.rumbleNoise = null;
    this.rumbleFilter = null;
    this.rumbleGain = null;
  }
}

export const audio = new AudioEngine();
