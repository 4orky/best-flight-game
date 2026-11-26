// Synthesised sound: no audio files, everything comes from WebAudio. The
// engine is a detuned sawtooth through a low-pass filter whose pitch follows
// the throttle; rings chime, touchdowns thud and crashes rumble.
export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    engineFilter: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    /** Start the audio graph on the first user gesture. */
    ensure() {
      if (audio.ctx) {
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audio.ctx = ctx;

      // Engine: two detuned saws, low-passed, quiet at idle.
      audio.engineFilter = ctx.createBiquadFilter();
      audio.engineFilter.type = 'lowpass';
      audio.engineFilter.frequency.value = 420;
      audio.engineGain = ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc = ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 62;
      audio.engineOsc2 = ctx.createOscillator();
      audio.engineOsc2.type = 'sawtooth';
      audio.engineOsc2.frequency.value = 65;
      audio.engineOsc.connect(audio.engineFilter);
      audio.engineOsc2.connect(audio.engineFilter);
      audio.engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(ctx.destination);
      audio.engineOsc.start();
      audio.engineOsc2.start();

      // Wind: looped noise through a band-pass, louder with speed.
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      audio.windSource = ctx.createBufferSource();
      audio.windSource.buffer = buffer;
      audio.windSource.loop = true;
      audio.windFilter = ctx.createBiquadFilter();
      audio.windFilter.type = 'bandpass';
      audio.windFilter.frequency.value = 700;
      audio.windFilter.Q.value = 0.6;
      audio.windGain = ctx.createGain();
      audio.windGain.gain.value = 0;
      audio.windSource.connect(audio.windFilter);
      audio.windFilter.connect(audio.windGain);
      audio.windGain.connect(ctx.destination);
      audio.windSource.start();
    },
    /** Continuous engine and wind levels from the flight state. */
    update(throttle, speed, airborne) {
      if (!audio.ctx || audio.muted) return;
      const t = audio.ctx.currentTime;
      const base = 52 + throttle * 66;
      audio.engineOsc.frequency.setTargetAtTime(base, t, 0.08);
      audio.engineOsc2.frequency.setTargetAtTime(base * 1.02 + 2, t, 0.08);
      audio.engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
      audio.engineGain.gain.setTargetAtTime(airborne ? 0.045 + throttle * 0.05 : 0.02 + throttle * 0.03, t, 0.1);
      audio.windGain.gain.setTargetAtTime(Math.min(0.12, (speed / 78) * 0.11), t, 0.15);
      audio.windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.15);
    },
    /** A short tone with an exponential decay envelope. */
    blip(freq, seconds, type, volume, when = 0) {
      if (!audio.ctx || audio.muted) return;
      const ctx = audio.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const start = ctx.currentTime + when;
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + seconds + 0.05);
    },
    ring() {
      audio.blip(880, 0.35, 'sine', 0.16);
      audio.blip(1318, 0.4, 'sine', 0.12, 0.07);
      audio.blip(1760, 0.5, 'sine', 0.09, 0.14);
    },
    click() {
      audio.blip(660, 0.08, 'square', 0.05);
    },
    touchdown() {
      audio.blip(90, 0.25, 'sine', 0.25);
      audio.blip(55, 0.3, 'triangle', 0.2, 0.05);
    },
    crash() {
      if (!audio.ctx || audio.muted) return;
      const ctx = audio.ctx;
      const length = ctx.sampleRate * 0.7;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      audio.blip(48, 0.6, 'sine', 0.3);
    },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.ctx) {
        const t = audio.ctx.currentTime;
        if (audio.engineGain) audio.engineGain.gain.setTargetAtTime(audio.muted ? 0 : 0.05, t, 0.05);
        if (audio.windGain) audio.windGain.gain.setTargetAtTime(0, t, 0.05);
      }
      return audio.muted;
    },
  };
  return audio;
}
