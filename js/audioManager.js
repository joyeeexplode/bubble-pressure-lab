import { CRUSHABLE_AUDIO_GROUPS } from "./crushableCatalog.js";

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicVolume = 0.38;
    this.popVolume = 0.78;
    this.musicIndex = 0;
    this.musicNodes = [];
    this.musicMaster = null;
    this.musicFilter = null;
    this.musicTimer = null;
    this.musicElement = null;
    this.enabled = false;
    this.interactionEnergy = 0.5;
    this.musicTracks = [
      "./assets/music/bgm_cute_talking_chiptune.mp3",
      "./assets/music/bgm_upbeat_healing_starlight_city_loop.ogg",
      "./assets/music/bgm_bright_melodic_loopy_edm.ogg",
      "./assets/music/bgm_relaxing_ambient_loop.ogg",
      "./assets/music/bgm_kpop_bright_stars_loop.ogg",
    ];
    this.chords = [
      [110, 164.81, 220],
      [98, 146.83, 196],
      [130.81, 196, 261.63],
    ];
  }

  async ensure() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!this.ctx) this.ctx = new AudioContextClass();
    if (this.ctx.state !== "running") await this.ctx.resume();
    if (this.ctx.state !== "running") return false;
    this.enabled = true;
    this.startMusic();
    this.playUnlockTick();
    return this.ctx.state === "running";
  }

  async toggle() {
    if (this.enabled) {
      this.enabled = false;
      this.pauseMusic();
      if (this.ctx?.state === "running") await this.ctx.suspend();
      return false;
    }
    return this.ensure();
  }

  playUnlockTick() {
    if (!this.ctx || this.didUnlockTick) return;
    this.didUnlockTick = true;
    this.tone(520, 0.08, 0.055, "sine");
    window.setTimeout(() => this.tone(760, 0.1, 0.04, "sine"), 55);
  }

  setMusicVolume(value) {
    this.musicVolume = Number(value);
    if (this.musicMaster && this.ctx) {
      this.musicMaster.gain.setTargetAtTime(this.musicVolume * 0.32, this.ctx.currentTime, 0.08);
    }
    if (this.musicElement) this.musicElement.volume = this.musicVolume * 0.72;
  }

  setPopVolume(value) {
    this.popVolume = Number(value);
  }

  setInteractionEnergy(value) {
    this.interactionEnergy = Math.max(0, Math.min(1, Number(value)));
  }

  switchMusic() {
    this.musicIndex = (this.musicIndex + 1) % this.musicTracks.length;
    this.startMusic(true);
  }

  startMusic(restart = false) {
    if (!this.ctx || !this.enabled || this.ctx.state !== "running") return;
    if (this.musicElement && !restart) {
      this.musicElement.play().catch(() => {});
      return;
    }
    this.pauseMusic();

    const media = new Audio(this.musicTracks[this.musicIndex]);
    media.loop = true;
    media.preload = "auto";
    media.volume = this.musicVolume * 0.72;
    media.addEventListener("error", () => {
      if (this.musicElement === media) this.startSynthMusic();
    }, { once: true });
    this.musicElement = media;
    media.play().catch(() => {
      if (this.musicElement === media) this.startSynthMusic();
    });
  }

  startSynthMusic() {
    if (!this.ctx || !this.enabled || this.musicNodes.length) return;
    const master = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    master.gain.value = this.musicVolume * 0.32;
    this.musicMaster = master;
    this.musicFilter = filter;
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 0.7;
    filter.connect(master).connect(this.ctx.destination);

    this.musicNodes = [master, filter];
    let step = 0;
    const patterns = [
      [0, 2, 1, 2, 0, 1, 2, 1],
      [0, 1, 2, 1, 0, 2, 1, 2],
      [0, 2, 0, 1, 2, 1, 0, 2],
    ];
    const chordIndex = this.musicIndex % this.chords.length;
    const patternIndex = this.musicIndex % patterns.length;
    this.musicHit(this.chords[chordIndex][0], 0.18, 0.32, "sine");
    this.musicTimer = window.setInterval(() => {
      if (!this.musicMaster) return;
      const chord = this.chords[chordIndex];
      const note = chord[patterns[patternIndex][step % 8]];
      if (step % 4 === 0) this.musicHit(note * 0.5, 0.22, 0.52, "sine");
      if (step % 2 === 0) this.musicHit(note * 2, 0.09, 0.16, "triangle");
      else this.musicHit(note * 3, 0.055, 0.08, "sine");
      if (step % 4 === 2) this.noiseMusicHit();
      step += 1;
    }, 270);
  }

  musicHit(frequency, duration, level, type) {
    if (!this.ctx || !this.musicFilter) return;
    const now = this.ctx.currentTime;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.musicFilter);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  noiseMusicHit() {
    if (!this.ctx || !this.musicFilter) return;
    const length = Math.floor(this.ctx.sampleRate * 0.045);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = 0.055;
    source.buffer = buffer;
    source.connect(gain).connect(this.musicFilter);
    source.start();
  }

  pauseMusic() {
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.src = "";
      this.musicElement = null;
    }
    window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    for (const node of this.musicNodes) {
      try {
        if (typeof node.stop === "function") node.stop();
        node.disconnect();
      } catch {
        // A node may already be stopped.
      }
    }
    this.musicNodes = [];
    this.musicMaster = null;
    this.musicFilter = null;
  }

  tone(freq, duration, gainValue, type = "triangle") {
    if (!this.ctx || gainValue <= 0) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), this.ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.03);
  }

  noiseBurst({ duration = 0.1, frequency = 1200, gain = 0.25, filterType = "highpass" } = {}) {
    const now = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
    }
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const output = this.ctx.createGain();
    filter.type = filterType;
    filter.frequency.value = frequency;
    output.gain.setValueAtTime(gain * this.popVolume, now);
    output.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = buffer;
    source.connect(filter).connect(output).connect(this.ctx.destination);
    source.start(now);
  }

  sweep(from, to, duration, gainValue, type = "sine") {
    const now = this.ctx.currentTime;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, gainValue * this.popVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  pop(type = "bubble") {
    if (!this.ctx || !this.enabled || this.ctx.state !== "running") return;
    const crispness = this.interactionEnergy;
    if (crispness > 0.68) {
      this.tone(1100 + crispness * 520, 0.045, this.popVolume * 0.025, "sine");
    } else if (crispness < 0.34) {
      this.sweep(240, 125, 0.28, 0.045, "sine");
    }
    const focusedCrushableSound = {
      ice_bubble: {
        sample: ["pop.wav", 1.42, 0.42],
        noise: [[0.18, 3200, 0.09, "highpass"], [0.28, 1800, 0.055, "bandpass"]],
        sweeps: [[1040, 420, 0.18, 0.08, "sine"], [620, 1180, 0.34, 0.045, "sine"]],
        notes: [1760, 2140],
      },
      cracked_ice_cube: {
        sample: ["pop.wav", 1.18, 0.5],
        noise: [[0.22, 2100, 0.12, "bandpass"]],
        sweeps: [[310, 92, 0.26, 0.12, "triangle"], [1280, 430, 0.12, 0.055, "sine"]],
        notes: [980, 760],
      },
      walnut_pressure_shell: {
        sample: ["start.wav", 0.62, 0.5],
        noise: [[0.12, 520, 0.17, "lowpass"], [0.08, 1100, 0.08, "bandpass"]],
        sweeps: [[240, 74, 0.28, 0.18, "triangle"]],
        notes: [180, 150, 124],
      },
      bubble_wrap_tile: {
        sample: ["pop.wav", 1.65, 0.46],
        noise: [[0.065, 2600, 0.12, "highpass"]],
        sweeps: [[740, 210, 0.09, 0.08, "sine"]],
        notes: [820, 920, 1040, 1180, 1320],
        spacing: 28,
      },
      jelly_bubble: {
        sample: ["bounce.wav", 1.08, 0.5],
        noise: [[0.09, 520, 0.12, "lowpass"]],
        sweeps: [[160, 360, 0.2, 0.22, "sine"], [420, 140, 0.22, 0.11, "triangle"]],
        notes: [520, 390],
      },
      porcelain_emotion_mask: {
        sample: ["collect.wav", 1.36, 0.44],
        noise: [[0.13, 2600, 0.08, "highpass"], [0.22, 1400, 0.055, "bandpass"]],
        sweeps: [[1180, 380, 0.18, 0.08, "sine"], [760, 1540, 0.42, 0.045, "sine"]],
        notes: [1260, 1660, 1980],
      },
    }[type];
    if (focusedCrushableSound) {
      const [file, rate, level] = focusedCrushableSound.sample;
      this.playSample(`./assets/audio/${file}`, rate, level);
      focusedCrushableSound.noise.forEach(([duration, frequency, gain, filterType], index) => {
        window.setTimeout(
          () => this.noiseBurst({ duration, frequency, gain, filterType }),
          index * 45,
        );
      });
      focusedCrushableSound.sweeps.forEach(([from, to, duration, gain, wave], index) => {
        window.setTimeout(() => this.sweep(from, to, duration, gain, wave), index * 70);
      });
      focusedCrushableSound.notes.forEach((frequency, index) => {
        window.setTimeout(
          () => this.tone(frequency, 0.11, this.popVolume * 0.038, "sine"),
          24 + index * (focusedCrushableSound.spacing ?? 42),
        );
      });
      return;
    }
    const crushableGroup = CRUSHABLE_AUDIO_GROUPS[type];
    if (crushableGroup) {
      const sampleByGroup = {
        ice: ["pop.wav", 1.35], candy: ["pop.wav", 1.16], nut: ["start.wav", 0.72],
        shell: ["collect.wav", 0.92], crystal: ["collect.wav", 1.24], space: ["bounce.wav", 0.72],
        bubblewrap: ["pop.wav", 1.5], air: ["bounce.wav", 0.82], jelly: ["bounce.wav", 1.08],
        cloud: ["bounce.wav", 0.68], foam: ["pop.wav", 0.84], paper: ["start.wav", 1.18],
        ceramic: ["collect.wav", 1.42],
      };
      const [file, rate] = sampleByGroup[crushableGroup];
      this.playSample(`./assets/audio/${file}`, rate, 0.58);
      const tonalLayer = {
        ice: [920, 260], candy: [760, 420], nut: [260, 92], shell: [620, 980],
        crystal: [880, 1760], space: [190, 420], bubblewrap: [680, 210],
        air: [430, 95], jelly: [180, 360], cloud: [320, 140], foam: [410, 170],
        paper: [520, 190], ceramic: [1050, 340],
      }[crushableGroup];
      this.sweep(tonalLayer[0], tonalLayer[1], 0.22, 0.11, crushableGroup === "nut" ? "triangle" : "sine");
      return;
    }
    if (["duck", "pufferfish", "seal", "unicornFloat", "pressureHippo"].includes(type)) {
      const deflatePitch = {
        duck: 520, pufferfish: 410, seal: 330, unicornFloat: 620, pressureHippo: 220,
      }[type];
      const deflateLength = type === "pressureHippo" ? 0.48 : type === "unicornFloat" ? 0.4 : 0.3;
      this.noiseBurst({ duration: deflateLength, frequency: 760 + deflatePitch, gain: 0.22, filterType: "bandpass" });
      this.sweep(deflatePitch, type === "pressureHippo" ? 42 : 72, deflateLength, 0.24, "sine");
      if (type === "duck") window.setTimeout(() => this.tone(760, 0.08, this.popVolume * 0.12, "sine"), 70);
      return;
    }
    if (type === "mouse") {
      this.noiseBurst({ duration: 0.12, frequency: 2400, gain: 0.18, filterType: "highpass" });
      [920, 1280, 1660].forEach((frequency, index) => {
        window.setTimeout(() => this.tone(frequency, 0.18, this.popVolume * 0.1, "sine"), index * 42);
      });
      return;
    }
    if (["burger", "frog", "jellyfish", "octopus", "puddingGhost", "gummySlipper", "jellyOrange", "creamMochi"].includes(type)) {
      const gummyPitch = {
        burger: [135, 270], frog: [180, 420], jellyfish: [260, 510], octopus: [150, 350],
        puddingGhost: [210, 390], gummySlipper: [120, 245], jellyOrange: [165, 360],
        creamMochi: [105, 230],
      }[type];
      this.noiseBurst({ duration: 0.07, frequency: gummyPitch[1] * 1.7, gain: 0.16, filterType: "lowpass" });
      this.sweep(gummyPitch[0], gummyPitch[1], 0.17, 0.28, "sine");
      window.setTimeout(
        () => this.sweep(gummyPitch[1], gummyPitch[0] * 0.72, 0.16, 0.17, "triangle"),
        95,
      );
      return;
    }
    if (type === "waterCactus") {
      this.noiseBurst({ duration: 0.16, frequency: 1500, gain: 0.2, filterType: "bandpass" });
      this.sweep(520, 190, 0.21, 0.2, "sine");
      [680, 820].forEach((frequency, index) => {
        window.setTimeout(() => this.tone(frequency, 0.1, this.popVolume * 0.08, "sine"), 35 + index * 45);
      });
      return;
    }
    if (type === "waterStarfish" || type === "waterPeach") {
      this.noiseBurst({ duration: 0.18, frequency: 1450, gain: 0.18, filterType: "bandpass" });
      this.sweep(type === "waterPeach" ? 410 : 520, 155, 0.24, 0.2, "sine");
      return;
    }
    if (type === "softCloud") {
      this.noiseBurst({ duration: 0.22, frequency: 620, gain: 0.12, filterType: "lowpass" });
      this.sweep(280, 78, 0.34, 0.2, "sine");
      return;
    }
    if (type === "doubleDaisy") {
      this.noiseBurst({ duration: 0.26, frequency: 2400, gain: 0.105, filterType: "highpass" });
      this.noiseBurst({ duration: 0.12, frequency: 920, gain: 0.08, filterType: "bandpass" });
      this.sweep(520, 220, 0.24, 0.12, "sine");
      [880, 1110, 1360, 1660, 1980].forEach((frequency, index) => {
        window.setTimeout(
          () => this.tone(frequency, 0.14, this.popVolume * 0.038, "sine"),
          24 + index * 38,
        );
      });
      return;
    }
    const naturalSound = {
      dandelion: { noise: [0.28, 2500, 0.1, "highpass"], sweep: [620, 1180, 0.34, 0.1], notes: [1180, 1480] },
      hydrangea: { noise: [0.2, 1550, 0.12, "bandpass"], sweep: [460, 260, 0.22, 0.12], notes: [720, 910, 1120] },
      pinecone: { noise: [0.11, 480, 0.16, "lowpass"], sweep: [210, 92, 0.2, 0.2], notes: [260, 220, 180] },
      mapleSamara: { noise: [0.28, 1800, 0.1, "bandpass"], sweep: [680, 240, 0.38, 0.11], notes: [760, 690, 620] },
    }[type];
    if (naturalSound) {
      const [duration, frequency, gain, filterType] = naturalSound.noise;
      const [from, to, sweepDuration, sweepGain] = naturalSound.sweep;
      this.noiseBurst({ duration, frequency, gain, filterType });
      this.sweep(from, to, sweepDuration, sweepGain, type === "pinecone" ? "triangle" : "sine");
      naturalSound.notes.forEach((frequencyValue, index) => {
        window.setTimeout(
          () => this.tone(
            frequencyValue,
            0.1,
            this.popVolume * (type === "pinecone" ? 0.07 : 0.045),
            "triangle",
          ),
          24 + index * (type === "mapleSamara" ? 62 : 42),
        );
      });
      return;
    }
    if (type === "cyberChicken") {
      this.sweep(620, 1320, 0.14, 0.24, "sawtooth");
      window.setTimeout(() => this.sweep(1260, 210, 0.24, 0.2, "sawtooth"), 105);
      return;
    }

    const now = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * 0.09);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const envelope = Math.pow(1 - i / length, 5);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = this.ctx.createBufferSource();
    const highpass = this.ctx.createBiquadFilter();
    const noiseGain = this.ctx.createGain();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(1100, now);
    noiseGain.gain.setValueAtTime(this.popVolume * 0.34, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    source.buffer = buffer;
    source.connect(highpass).connect(noiseGain).connect(this.ctx.destination);
    source.start(now);

    const drop = this.ctx.createOscillator();
    const dropGain = this.ctx.createGain();
    drop.type = "sine";
    drop.frequency.setValueAtTime(420 + Math.random() * 90, now);
    drop.frequency.exponentialRampToValueAtTime(145, now + 0.16);
    dropGain.gain.setValueAtTime(this.popVolume * 0.2, now);
    dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    drop.connect(dropGain).connect(this.ctx.destination);
    drop.start(now);
    drop.stop(now + 0.2);
  }

  complete() {
    if (!this.ctx) return;
    [330, 440, 660, 880].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.32, this.popVolume * 0.13, "sine"), index * 70);
    });
    window.setTimeout(
      () => this.noiseBurst({ duration: 0.3, frequency: 2600, gain: 0.12, filterType: "highpass" }),
      110,
    );
  }

  playSample(path, playbackRate = 1, level = 0.5) {
    const sample = new Audio(path);
    sample.preload = "auto";
    sample.volume = Math.min(1, level * this.popVolume);
    sample.playbackRate = playbackRate;
    sample.play().catch(() => {});
  }
}
