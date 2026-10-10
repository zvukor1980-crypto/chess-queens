/* Синтезированные звуки (WebAudio) */
(function (root) {
  'use strict';
  let ctx = null, master = null, enabled = true;
  function ensure() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, t0, dur, type = 'sine', vol = 0.3, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, freq, q, vol) {
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  }
  const S = {
    select() { const t = ctx.currentTime; tone(1250, t, 0.05, 'sine', 0.07); },
    move() { const t = ctx.currentTime; noise(t, 0.07, 1500, 1.4, 0.9); tone(190, t, 0.09, 'sine', 0.35, 120); },
    capture() { const t = ctx.currentTime; noise(t, 0.12, 2400, 1, 1.1); tone(150, t, 0.12, 'triangle', 0.3, 90); tone(1320, t + 0.04, 0.22, 'sine', 0.12); tone(1980, t + 0.09, 0.25, 'sine', 0.08); },
    check() { const t = ctx.currentTime; tone(660, t, 0.16, 'triangle', 0.25); tone(990, t + 0.13, 0.26, 'triangle', 0.25); },
    castle() { const t = ctx.currentTime; noise(t, 0.06, 1500, 1.4, 0.8); noise(t + 0.11, 0.06, 1300, 1.4, 0.8); tone(200, t, 0.08, 'sine', 0.3); },
    promote() { const t = ctx.currentTime; [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.06, 0.3, 'triangle', 0.15)); },
    win() { const t = ctx.currentTime; [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { tone(f, t + i * 0.11, 0.5, 'triangle', 0.2); tone(f * 2, t + i * 0.11, 0.3, 'sine', 0.05); }); tone(1047, t + 0.75, 1.0, 'sine', 0.15); },
    lose() { const t = ctx.currentTime; [523, 466, 415, 349].forEach((f, i) => tone(f, t + i * 0.2, 0.45, 'triangle', 0.18)); },
    draw() { const t = ctx.currentTime; [523, 659, 587, 523].forEach((f, i) => tone(f, t + i * 0.15, 0.35, 'sine', 0.16)); },
    bad() { const t = ctx.currentTime; tone(160, t, 0.12, 'square', 0.05); },
    tick() { const t = ctx.currentTime; tone(2000, t, 0.03, 'square', 0.03); }
  };
  root.CQAudio = {
    play(name) { if (!enabled) return; try { if (!ensure()) return; S[name] && S[name](); } catch (e) { /* звук не критичен */ } },
    unlock() { try { ensure(); } catch (e) { } },
    set enabled(v) { enabled = !!v; }, get enabled() { return enabled; }
  };
})(window);
