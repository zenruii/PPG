'use strict';
/* Synthesized sound effects (WebAudio, no assets). */
const Sound = (() => {
  let ac = null, master = null, noiseBuf = null, enabled = true;
  const last = {};
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.5;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function noise(t, dur, vol, type, freq, q = 1, sweepTo = null, attack = 0.002) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = rand(0.9, 1.1);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, rand(0, 1)); src.stop(t + dur + 0.05);
  }
  function tone(t, dur, vol, type, f0, f1, attack = 0.002) {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const defs = {
    pistol: (t, v) => { noise(t, 0.18, 0.9 * v, 'lowpass', 3200, 0.7, 400); tone(t, 0.12, 0.6 * v, 'sine', 160, 50); },
    revolver: (t, v) => { noise(t, 0.35, 1.0 * v, 'lowpass', 2400, 0.8, 250); tone(t, 0.2, 0.8 * v, 'sine', 120, 40); },
    smg: (t, v) => { noise(t, 0.09, 0.6 * v, 'bandpass', 2200, 0.8, 600); tone(t, 0.06, 0.35 * v, 'sine', 180, 70); },
    rifle: (t, v) => { noise(t, 0.2, 0.9 * v, 'lowpass', 4200, 0.7, 350); tone(t, 0.12, 0.6 * v, 'sine', 140, 45); },
    shotgun: (t, v) => { noise(t, 0.5, 1.1 * v, 'lowpass', 2000, 0.6, 180); tone(t, 0.3, 0.9 * v, 'sine', 90, 30); },
    sniper: (t, v) => { noise(t, 0.9, 1.2 * v, 'lowpass', 3000, 0.6, 120); tone(t, 0.35, 1.0 * v, 'sine', 100, 30); noise(t + 0.05, 1.2, 0.25 * v, 'bandpass', 600, 0.5, 200, 0.05); },
    minigun: (t, v) => { noise(t, 0.06, 0.55 * v, 'bandpass', 2600, 0.9, 900); tone(t, 0.05, 0.3 * v, 'square', 200, 90); },
    rail: (t, v) => { tone(t, 0.5, 0.5 * v, 'sawtooth', 2400, 80); noise(t, 0.6, 0.7 * v, 'highpass', 3000, 0.5, 300); tone(t, 0.3, 0.6 * v, 'sine', 80, 30); },
    charge: (t, v) => { tone(t, 0.6, 0.25 * v, 'sawtooth', 120, 2400, 0.3); },
    plasma: (t, v) => { tone(t, 0.2, 0.35 * v, 'square', 900, 140); noise(t, 0.12, 0.2 * v, 'bandpass', 1800, 2); },
    crossbow: (t, v) => { tone(t, 0.25, 0.5 * v, 'triangle', 220, 90); noise(t, 0.08, 0.4 * v, 'highpass', 2500); },
    rocket: (t, v) => { noise(t, 1.2, 0.7 * v, 'bandpass', 900, 0.6, 250, 0.05); tone(t, 0.2, 0.5 * v, 'sine', 90, 40); },
    explosion: (t, v) => { noise(t, 1.6, 1.4 * v, 'lowpass', 1400, 0.5, 60, 0.005); tone(t, 0.8, 1.2 * v, 'sine', 70, 22); noise(t, 0.25, 0.8 * v, 'highpass', 1500); },
    small_explosion: (t, v) => { noise(t, 0.6, 0.9 * v, 'lowpass', 1800, 0.5, 120); tone(t, 0.3, 0.6 * v, 'sine', 100, 35); },
    flesh: (t, v) => { noise(t, 0.12, 0.5 * v, 'lowpass', 600, 1.5, 150); tone(t, 0.08, 0.4 * v, 'sine', 110, 60); },
    bullethit: (t, v) => { noise(t, 0.1, 0.6 * v, 'bandpass', 900, 1.2, 300); tone(t, 0.06, 0.3 * v, 'sine', 140, 70); },
    bone: (t, v) => { noise(t, 0.06, 0.8 * v, 'highpass', 2500, 1.5); tone(t, 0.04, 0.5 * v, 'square', 900, 300); noise(t + 0.02, 0.05, 0.4 * v, 'bandpass', 1500, 2); },
    wood: (t, v) => { noise(t, 0.12, 0.5 * v, 'bandpass', 700, 3, 300); tone(t, 0.1, 0.35 * v, 'triangle', 320, 180); },
    metal: (t, v) => { tone(t, 0.4, 0.25 * v, 'triangle', rand(900, 1500), null); tone(t, 0.35, 0.18 * v, 'sine', rand(2200, 3100), null); noise(t, 0.05, 0.4 * v, 'highpass', 3000); },
    stone: (t, v) => { noise(t, 0.14, 0.5 * v, 'lowpass', 900, 1, 200); },
    glass: (t, v) => { noise(t, 0.4, 0.6 * v, 'highpass', 4000, 1); for (let i = 0; i < 5; i++) tone(t + rand(0, 0.15), 0.2, 0.12 * v, 'sine', rand(2500, 6000), null); },
    rubber: (t, v) => { tone(t, 0.12, 0.35 * v, 'sine', 180, 90); },
    plastic: (t, v) => { noise(t, 0.06, 0.4 * v, 'bandpass', 1800, 2); },
    swish: (t, v) => { noise(t, 0.22, 0.35 * v, 'bandpass', 900, 1.2, 3500, 0.08); },
    slice: (t, v) => { noise(t, 0.18, 0.6 * v, 'highpass', 2200, 1, 800); noise(t, 0.12, 0.4 * v, 'lowpass', 500, 1); },
    stab: (t, v) => { noise(t, 0.15, 0.6 * v, 'lowpass', 900, 2, 200); tone(t, 0.1, 0.3 * v, 'sine', 160, 70); },
    energy_on: (t, v) => { tone(t, 0.5, 0.35 * v, 'sawtooth', 80, 320, 0.05); noise(t, 0.4, 0.2 * v, 'bandpass', 1200, 4, 3000); },
    energy_off: (t, v) => { tone(t, 0.4, 0.3 * v, 'sawtooth', 320, 60, 0.01); },
    energy_hit: (t, v) => { tone(t, 0.25, 0.35 * v, 'sawtooth', 500, 150); noise(t, 0.2, 0.4 * v, 'bandpass', 2500, 3); },
    click: (t, v) => { tone(t, 0.02, 0.5 * v, 'square', 2000, 1500); },
    beep: (t, v) => { tone(t, 0.08, 0.35 * v, 'square', 1800, null); },
    pin: (t, v) => { tone(t, 0.05, 0.4 * v, 'triangle', 3000, 2000); noise(t, 0.05, 0.3 * v, 'highpass', 5000); },
    shell: (t, v) => { tone(t, 0.08, 0.25 * v, 'sine', rand(3500, 5000), null); },
    pump: (t, v) => { noise(t, 0.08, 0.5 * v, 'bandpass', 1400, 3); noise(t + 0.15, 0.08, 0.5 * v, 'bandpass', 1100, 3); },
    punt: (t, v) => { tone(t, 0.3, 0.6 * v, 'sawtooth', 300, 60); noise(t, 0.25, 0.7 * v, 'lowpass', 1800, 1, 200); },
    fire: (t, v) => { noise(t, 0.6, 0.35 * v, 'lowpass', 700, 0.6, 300, 0.1); },
    whoosh: (t, v) => { noise(t, 0.4, 0.4 * v, 'bandpass', 500, 1, 2000, 0.1); },
    heal: (t, v) => { tone(t, 0.25, 0.25 * v, 'sine', 600, 1200, 0.02); tone(t + 0.1, 0.3, 0.2 * v, 'sine', 900, 1800, 0.02); },
    blackhole: (t, v) => { tone(t, 2.5, 0.5 * v, 'sine', 60, 25, 0.3); noise(t, 2.5, 0.3 * v, 'lowpass', 300, 1, 80, 0.5); },
    zap: (t, v) => { tone(t, 0.12, 0.3 * v, 'square', 1200, 200); },
    turret: (t, v) => { tone(t, 0.1, 0.25 * v, 'sine', 800, 1200); },
    spawn: (t, v) => { tone(t, 0.06, 0.15 * v, 'sine', 500, 800); },
  };
  function play(name, vol = 1, minGap = 0.025) {
    if (!enabled || !ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (last[name] && now - last[name] < minGap) return;
    last[name] = now;
    const fn = defs[name];
    if (fn) { try { fn(now, clamp(vol, 0.02, 1.5)); } catch (e) {} }
  }
  /* continuous hum for energy blades / minigun spin */
  function hum(freq, vol) {
    if (!ac) return null;
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 1.01;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 3;
    const g = ac.createGain(); g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o.start(); o2.start();
    g.gain.setTargetAtTime(enabled ? vol : 0, ac.currentTime, 0.05);
    return { stop() { g.gain.setTargetAtTime(0, ac.currentTime, 0.05); setTimeout(() => { try { o.stop(); o2.stop(); } catch (e) {} }, 300); },
             set(fq, v) { o.frequency.setTargetAtTime(fq, ac.currentTime, 0.03); o2.frequency.setTargetAtTime(fq * 1.01, ac.currentTime, 0.03); g.gain.setTargetAtTime(enabled ? v : 0, ac.currentTime, 0.05); } };
  }
  return {
    init, play, hum,
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; if (master) master.gain.value = v ? 0.5 : 0; },
  };
})();
