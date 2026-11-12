/* ==========================================================================
   Bühne – Flutlicht-Verlosung
   Fünf Zieh-Animationen mit Sounddesign: Pisten-Walze, Bergfahrt,
   Anzeigetafel, Yeti, Schneesturm. Nutzt Globals aus index.html
   ($, esc, state, tApi, poll, setHtml, htmlCache, prizeLeft, time, sound, ac, ls, tab).
   ========================================================================== */
const stageEl = $("stage"), fxCanvas = $("fx"), fx = fxCanvas.getContext("2d");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE_OUT = "cubic-bezier(.23,1,.32,1)", EASE_IO = "cubic-bezier(.77,0,.175,1)";
let stagePlayKey, stagePlaying = false, stageOn = false, poolInfo = null, poolAt = 0, watchStart = 0, keptSceneFor = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------------------------------------------------------------- Sound */
const SFX = (() => {
  let master, noiseBuf;
  function ctx() {
    if (!sound) return null;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      if (!master) {
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
        master = ac.createGain(); master.gain.value = .9; master.connect(comp).connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return ac;
    } catch { return null; }
  }
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t + a);
    g.gain.exponentialRampToValueAtTime(.0001, t + Math.max(dur, a + .01));
  }
  function osc({ at = 0, f = 440, f2, dur = .3, type = "sine", vol = .3, a = .005 }) {
    const c = ctx(); if (!c) return; const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, a, vol, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function noise({ at = 0, dur = .3, type = "bandpass", f = 1000, f2, q = 1, vol = .3, a = .005 }) {
    const c = ctx(); if (!c) return; const t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); env(g, t, a, vol, dur);
    s.connect(fl).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  let lastClack = 0;
  return {
    // Zeitnahme-Startpiepser wie beim Skirennen
    beep: (go) => osc({ f: go ? 1568 : 1046, dur: go ? .6 : .16, type: "square", vol: .1, a: .003 }),
    tick: (p = 1) => { osc({ f: 2400 * p, dur: .02, type: "triangle", vol: .12 }); noise({ dur: .015, type: "highpass", f: 5000, vol: .04 }); },
    whoosh: (dur = .5, vol = .25) => noise({ dur, f: 280, f2: 2600, q: .9, vol, a: dur * .7 }),
    whooshDown: (dur = .6, vol = .25) => noise({ dur, f: 2800, f2: 260, q: .9, vol, a: .02 }),
    thud: (vol = .55) => { osc({ f: 110, f2: 36, dur: .4, vol }); noise({ dur: .14, type: "lowpass", f: 500, vol: vol * .6 }); },
    crunch: (vol = .22) => { for (let i = 0; i < 6; i++) noise({ at: i * .03 + Math.random() * .02, dur: .05, f: rnd(1600, 4500), q: 2.5, vol }); },
    spray: () => { noise({ dur: .9, type: "highpass", f: 2500, vol: .22, a: .02 }); noise({ dur: .7, f: 900, f2: 400, q: .6, vol: .15 }); },
    splat: () => { osc({ f: 95, f2: 28, dur: .55, vol: .8 }); noise({ dur: .4, type: "lowpass", f: 1600, f2: 260, vol: .6, a: .003 }); for (let i = 0; i < 9; i++) noise({ at: .02 + i * .025, dur: .04, f: rnd(2000, 6000), q: 3, vol: .12 }); },
    clack: () => { const now = performance.now(); if (now - lastClack < 18) return; lastClack = now;
      noise({ dur: .016, f: rnd(2600, 4200), q: 5, vol: .2 }); osc({ f: rnd(150, 210), dur: .025, type: "square", vol: .04 }); },
    creak: () => osc({ f: rnd(300, 360), f2: rnd(220, 260), dur: .5, type: "sawtooth", vol: .025, a: .12 }),
    bell: () => { [[880, 1], [1318, .45], [2217, .2]].forEach(([f, v]) => { osc({ f, dur: 2.4, vol: .2 * v, a: .002 }); osc({ at: .5, f: f * .841, dur: 2.6, vol: .18 * v, a: .002 }); }); },
    chime: () => [1568, 2093, 2637, 3136, 4186].forEach((f, i) => osc({ at: i * .06, f, dur: 1, vol: .07, a: .003 })),
    drumroll: (dur) => { let t = 0, gap = .1; while (t < dur) { noise({ at: t, dur: .05, f: 1700, q: .7, vol: .05 + .14 * (t / dur) }); t += gap; gap = Math.max(.032, gap * .965); } },
    roar: () => { const c = ctx(); if (!c) return; const t = c.currentTime;
      const f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      f.type = "lowpass"; f.Q.value = 4; f.frequency.setValueAtTime(350, t); f.frequency.linearRampToValueAtTime(1500, t + .45); f.frequency.linearRampToValueAtTime(280, t + 1.8);
      lfo.frequency.value = 22; lg.gain.value = 10; lfo.connect(lg); env(g, t, .18, .55, 1.9);
      [[92, 1], [94.5, 1], [46, .8]].forEach(([fr]) => { const o = c.createOscillator(); o.type = "sawtooth";
        o.frequency.setValueAtTime(fr, t); o.frequency.linearRampToValueAtTime(fr * 1.35, t + .5); o.frequency.linearRampToValueAtTime(fr * .75, t + 1.8);
        lg.connect(o.frequency); o.connect(f); o.start(t); o.stop(t + 2); });
      f.connect(g).connect(master); lfo.start(t); lfo.stop(t + 2);
      noise({ dur: 1.6, f: 600, f2: 260, q: .6, vol: .3, a: .25 }); },
    fanfare: () => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { osc({ at: i * .11, f, dur: i === 3 ? 1.8 : .38, type: "triangle", vol: .24 }); osc({ at: i * .11, f: f * 2, dur: i === 3 ? 1.3 : .3, vol: .05 }); });
      [261.63, 329.63, 392].forEach((f) => osc({ at: .44, f, dur: 1.8, type: "triangle", vol: .12, a: .02 }));
      noise({ at: .44, dur: 1.8, type: "highpass", f: 7000, vol: .06, a: .01 }); },
    wind() {
      const c = ctx(); if (!c) return { set() {}, stop() {} };
      const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.4; bp.frequency.value = 300;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200;
      const g = c.createGain(); g.gain.value = .0001;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .6; lg.gain.value = 140; lfo.connect(lg).connect(bp.frequency);
      s.connect(bp).connect(lp).connect(g).connect(master); s.start(); lfo.start();
      const ramp = (p, v, r) => { const t = c.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + r); };
      return {
        set(level, r = .25) { ramp(bp.frequency, 220 + level * 1600, r); ramp(g.gain, .015 + level * .38, r); },
        stop(r = 1.2) { ramp(g.gain, .0001, r); const t = c.currentTime + r + .1; s.stop(t); lfo.stop(t); },
      };
    },
  };
})();

/* ---------------------------------------------------------- Schnee & Effekte */
let flakes = [], bits = [], puffs = [], wind = 0, storm = 0, fxRaf = null, fxW = 0, fxH = 0;
function fxResize() {
  const r = stageEl.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  if (!r.width) return;
  fxW = r.width; fxH = r.height; fxCanvas.width = fxW * d; fxCanvas.height = fxH * d; fx.setTransform(d, 0, 0, d, 0, 0);
  const n = Math.round(fxW * fxH / 4600);
  flakes = Array.from({ length: n }, () => ({ x: Math.random() * fxW, y: Math.random() * fxH, r: Math.random() * 1.9 + .5, v: Math.random() * .5 + .35, s: Math.random() * 7 }));
}
new ResizeObserver(fxResize).observe(stageEl);
// Position eines Elements im Bühnen-Koordinatensystem
function posIn(el, fxRel = .5, fyRel = .5) {
  const r = el.getBoundingClientRect(), s = stageEl.getBoundingClientRect();
  return { x: r.left - s.left + r.width * fxRel, y: r.top - s.top + r.height * fyRel };
}
function confetti(x = fxW * .42, y = fxH * .5, n = 240) {
  const cols = ["#FFFFFF", "#C0372C", "#3B43A6", "#DCE5EA", "#FFFFFF"];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = Math.random() * 10 + 3;
    bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 5, w: rnd(4, 12), h: rnd(2, 6), rot: Math.random() * 6, vr: rnd(-.3, .3), c: cols[i % cols.length], life: 1 });
  }
}
// Schnee-Wolke (z. B. Ski-Stopp, Yeti-Schritte, Aufprall)
function snowPuff(x, y, n = 60, { dir = -Math.PI / 2, spread = Math.PI, power = 7 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(-spread / 2, spread / 2), sp = rnd(.3, 1) * power;
    puffs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rnd(1.5, 5), life: 1, decay: rnd(.008, .02) });
  }
}
function fxLoop() {
  fx.clearRect(0, 0, fxW, fxH);
  wind += ((stagePlaying ? 2.6 : .4) - wind) * .03;
  const cx = fxW / 2, cy = fxH * .48;
  fx.strokeStyle = "rgba(255,255,255,.8)"; fx.fillStyle = "rgba(255,255,255,.85)"; fx.lineCap = "round";
  for (const f of flakes) {
    const px = f.x, py = f.y;
    f.s += .02;
    if (storm > .02) {
      const dx = f.x - cx, dy = f.y - cy, d = Math.hypot(dx, dy) + 1;
      f.x += (-dy / d) * storm * 14 * f.v - (dx / d) * storm * 1.4;
      f.y += (dx / d) * storm * 14 * f.v - (dy / d) * storm * 1.4 + f.v * (1 - storm);
      if (d < 30) { f.x = Math.random() < .5 ? -5 : fxW + 5; f.y = Math.random() * fxH; }
    } else {
      f.y += f.v * (1 + wind * .6); f.x += Math.sin(f.s) * .3 + wind * .9 * f.v;
    }
    if (f.y > fxH + 6) { f.y = -4; f.x = Math.random() * fxW; } if (f.y < -10) f.y = fxH;
    if (f.x > fxW + 6) f.x = -4; if (f.x < -10) f.x = fxW + 4;
    fx.globalAlpha = .35 + f.r / 4;
    const sp = Math.hypot(f.x - px, f.y - py);
    if (sp > 3 && sp < 80) { fx.lineWidth = f.r * 1.4; fx.beginPath(); fx.moveTo(px, py); fx.lineTo(f.x, f.y); fx.stroke(); }
    else { fx.beginPath(); fx.arc(f.x, f.y, f.r, 0, 7); fx.fill(); }
  }
  puffs = puffs.filter((p) => p.life > 0);
  for (const p of puffs) {
    p.vy += .14; p.vx *= .97; p.vy *= .98; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
    fx.globalAlpha = Math.max(0, p.life) * .9; fx.beginPath(); fx.arc(p.x, p.y, p.r * (1.6 - p.life * .6), 0, 7); fx.fill();
  }
  fx.globalAlpha = 1;
  bits = bits.filter((b) => b.life > 0 && b.y < fxH + 20);
  for (const b of bits) {
    b.vy += .22; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.life -= .004;
    fx.save(); fx.translate(b.x, b.y); fx.rotate(b.rot); fx.scale(1, Math.cos(b.rot * 2));
    fx.globalAlpha = Math.min(1, b.life * 1.5); fx.fillStyle = b.c; fx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); fx.restore();
  }
  fxRaf = stageOn && !document.hidden ? requestAnimationFrame(fxLoop) : null;
}
function stageVisible(on) { stageOn = on; if (on) { fxResize(); if (!fxRaf && !reduceMotion) fxRaf = requestAnimationFrame(fxLoop); refreshPool(); } }
document.addEventListener("visibilitychange", () => { if (stageOn && !fxRaf && !reduceMotion && !document.hidden) fxRaf = requestAnimationFrame(fxLoop); });

// Kamera wackeln (Bühneninhalt + Berge)
function shake(power = 1, ms = 450) {
  if (reduceMotion) return;
  const steps = 10, frames = [];
  for (let i = 0; i < steps; i++) { const k = (1 - i / steps) * power; frames.push({ transform: `translate(${rnd(-14, 14) * k}px,${rnd(-10, 10) * k}px)` }); }
  frames.push({ transform: "none" });
  [$("stageMain"), stageEl.querySelector(".ridge")].forEach((el) => el.animate(frames, { duration: ms, easing: "linear" }));
}
const lamps = () => [...stageEl.querySelectorAll(".mast i")];
function setLamps(n) { lamps().forEach((l, i) => l.classList.toggle("on", (i % 3) < n)); }
function flicker(ms = 900) { const t0 = performance.now(); const iv = setInterval(() => { stageEl.classList.toggle("dim", Math.random() < .35); if (performance.now() - t0 > ms) { clearInterval(iv); stageEl.classList.remove("dim"); } }, 70); }
const fmtWatch = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(Math.floor(ms / 10) % 100).padStart(2, "0")}`;
setInterval(() => { if (stagePlaying && watchStart) $("bWatch").textContent = fmtWatch(performance.now() - watchStart); }, 33);
const reelNames = (d, n) => { const names = d.reel.length ? d.reel : ["Lena H.", "Jonas B.", "Mia S.", "Felix B."]; const l = []; while (l.length < n) l.push(...[...names].sort(() => Math.random() - .5)); l.length = n; return l; };
// rAF-Schleife über eine Dauer: cb(p, dt, now)
function frames(dur, cb) {
  return new Promise((res) => { const t0 = performance.now(); let last = t0;
    const step = (now) => { const p = Math.min(1, (now - t0) / dur); cb(p, (now - last) / 16.67, now - t0); last = now; p < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step); });
}

/* ---------------------------------------------------------- Lostopf & Ansicht */
async function refreshPool() {
  if (Date.now() - poolAt < 4000) return; poolAt = Date.now();
  try { poolInfo = await tApi({ action: "showPool" }); } catch { poolInfo = null; }
  renderStage();
}
function currentPrizeLabel() {
  const t = state.tombola || { prizes: [] };
  return $("sPrizeText").value.trim() || t.prizes.find((p) => p.id === $("sPrize").value)?.name || "";
}
function stageIdle() {
  const n = poolInfo ? ($("sUnique").checked ? poolInfo.eligible : poolInfo.total) : null;
  return `<div class="kicker">${n === 0 ? "Noch niemand im Lostopf" : "Gleich wird gezogen"}</div>
    <div class="prizeline">${esc(currentPrizeLabel() || "Flutlicht-Verlosung")}</div>
    ${n ? `<div class="pool">${n} ${n === 1 ? "Gast" : "Gäste"} im Lostopf</div>` : ""}`;
}
const resultExtras = (d) => `${d.prize ? `<div class="banner"><small>gewinnt</small><span>${esc(d.prize)}</span></div>` : ""}
    <div class="wmeta">Bitte am Tombola-Stand melden${d.test ? " (Testziehung)" : ""}</div>`;
const stageResult = (d) => `<div class="winner">${esc(d.display || d.name)}</div>${resultExtras(d)}`;

function renderStage() {
  const sh = state.show || { draws: [] };
  const t = state.tombola || { prizes: [] };
  const sel = $("sPrize"), cur = sel.value;
  const opts = `<option value="">Ohne Gewinn – nur Namen ziehen</option>` + t.prizes.map((p) => {
    const left = prizeLeft(t, p); return `<option value="${esc(p.id)}" ${left !== null && left <= 0 ? "disabled" : ""}>${esc(p.name)}${left !== null ? ` (${left} übrig)` : ""}</option>`; }).join("");
  if (htmlCache.sPrize !== opts && document.activeElement !== sel) { htmlCache.sPrize = opts; sel.innerHTML = opts; sel.value = cur; }

  $("sDrawn").textContent = sh.draws.filter((d) => !d.test).length; $("bNo").textContent = sh.draws.length;
  const n = poolInfo ? ($("sUnique").checked ? poolInfo.eligible : poolInfo.total) : null;
  $("sPool").textContent = n ?? "–"; $("bPool").textContent = n ?? "–";

  setHtml("sHist", sh.draws.length ? sh.draws.map((d) => `
    <div class="row"><div><div class="who">${esc(d.name)}${d.test ? `<span class="tag" style="background:var(--bg);color:var(--slate)">Test</span>` : ""}</div>
      <div class="sub">${esc(d.prize || "ohne Gewinn")} · ${esc(ANIM_TXT[d.anim] || "")} · ${esc(d.code)}${d.nr ? " · Umschlag " + esc(d.nr) : ""} · ${time(d.t)}</div></div>
      <button class="btn ghost" style="padding:8px 12px;font-size:14px" data-sdel="${esc(d.id)}">Löschen</button></div>`).join("") : `<div class="none" style="padding:6px 0">Noch niemand gezogen.</div>`);

  // neue Ziehung → auf allen Bildschirmen gleichzeitig abspielen
  const key = sh.playKey || null;
  if (stagePlayKey !== undefined && key && key !== stagePlayKey) { stagePlayKey = key; const d = sh.draws.find((x) => x.id === sh.currentId); if (d) playDraw(d); return; }
  stagePlayKey = key;
  if (stagePlaying) return;
  const d = sh.draws.find((x) => x.id === sh.currentId);
  stageEl.classList.add("lit"); stageEl.classList.toggle("finish", !!d); setLamps(3);
  $("armBtn").hidden = !(d && d.prizeId && !d.test && state.tombola?.armed !== d.prizeId);
  if (d && keptSceneFor === d.id) return; // Szene (Yeti/Sturm) bleibt stehen
  keptSceneFor = null;
  setHtml("stageMain", d ? stageResult(d) : stageIdle());
}
const ANIM_TXT = { piste: "Pisten-Walze", gondel: "Bergfahrt", tafel: "Anzeigetafel", yeti: "Yeti", sturm: "Schneesturm" };

/* ---------------------------------------------------------- Ablauf einer Ziehung */
async function playDraw(d) {
  stagePlaying = true; $("drawBtn").disabled = $("testDrawBtn").disabled = true; $("armBtn").hidden = true;
  const main = $("stageMain"); delete htmlCache.stageMain; keptSceneFor = null;
  stageEl.classList.remove("finish", "lit", "frosted");
  if (reduceMotion) { await sleep(300); return finishDraw(d); }

  // Start: Lampen gehen an, Piepser 3 – 2 – 1 – los
  setLamps(0); $("bWatch").textContent = "0:00.00"; watchStart = 0;
  main.innerHTML = `<div class="kicker">${esc(d.prize || "Ziehung")}</div><div class="count" id="cnt">3</div>`;
  for (let i = 3; i >= 1; i--) {
    const c = $("cnt"); c.textContent = i; setLamps(4 - i); SFX.beep(false);
    c.animate([{ transform: "scale(1.18)", opacity: .2, filter: "blur(6px)" }, { transform: "scale(1)", opacity: 1, filter: "blur(0)" }], { duration: 380, easing: EASE_OUT });
    await sleep(900);
  }
  stageEl.classList.add("lit"); SFX.beep(true); watchStart = performance.now();
  $("cnt").animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.9)" }], { duration: 200, fill: "forwards" });
  await sleep(180);

  let keep = false;
  try { keep = await ({ piste: runPiste, gondel: runGondel, tafel: runTafel, yeti: runYeti, sturm: runSturm }[d.anim] || runPiste)(d, main); }
  catch (e) { console.error(e); }
  finishDraw(d, keep);
}
function finishDraw(d, keep = false) {
  stageEl.classList.add("lit", "finish"); setLamps(3); storm = 0;
  const main = $("stageMain");
  if (keep) { main.insertAdjacentHTML("beforeend", `<div class="overlay-result ${keep === "center" ? "center" : ""}">${resultExtras(d)}</div>`); keptSceneFor = d.id; }
  else { main.innerHTML = stageResult(d); htmlCache.stageMain = main.innerHTML; }
  if (!reduceMotion) { const w = main.querySelector(".winner, .ticket, .stuck"); const p = w ? posIn(w) : { x: fxW * .42, y: fxH * .5 }; confetti(p.x, p.y); }
  SFX.fanfare();
  stagePlaying = false; watchStart = 0; $("drawBtn").disabled = $("testDrawBtn").disabled = false; poolAt = 0; refreshPool();
  $("armBtn").hidden = !(d.prizeId && !d.test);
}

/* ---------------------------------------------------------- A) Pisten-Walze */
async function runPiste(d, main) {
  const list = reelNames(d, 64).concat(d.display, "", "");
  main.innerHTML = `<div class="kicker">Gezogen wird …</div><div class="reel"><div class="strip" id="strip">${list.map((x, i) => `<div ${i === 64 ? 'class="hit"' : ""}>${esc(x)}</div>`).join("")}</div></div>`;
  const strip = $("strip"), lh = strip.firstElementChild.offsetHeight, target = 63; // Gewinner landet mittig
  const w = SFX.wind(); let last = 0, lastPos = 0;
  // Anschieben, lange auslaufen lassen, am Ende leicht überziehen
  await frames(8200, (p) => {
    const e = p < .08 ? .03 * (p / .08) ** 2 : .03 + .97 * (1 - Math.pow(1 - (p - .08) / .92, 4));
    const pos = e * (target + .28), v = Math.abs(pos - lastPos); lastPos = pos;
    strip.style.transform = `translateY(${-pos * lh}px)`;
    strip.style.filter = `blur(${Math.min(5, v * 6).toFixed(2)}px)`;
    w.set(Math.min(1, v * 2.2), .1); wind = 1 + v * 8;
    if (Math.floor(pos) !== last) { last = Math.floor(pos); SFX.tick(.7 + Math.min(.6, v)); }
  });
  // Federnd zurück in die Mitte – wie ein Ski-Stopp
  w.stop(.6); SFX.spray();
  const hit = strip.querySelector(".hit"), sp = posIn(hit, .95, .6);
  snowPuff(sp.x, sp.y, 140, { dir: -Math.PI * .62, spread: Math.PI * .7, power: 11 });
  await frames(700, (p, _, ms) => { const off = .28 * Math.exp(-ms / 110) * Math.cos(ms / 60); strip.style.transform = `translateY(${-(target + off) * lh}px)`; strip.style.filter = "none"; });
  hit.classList.add("on"); SFX.chime();
  await sleep(1100);
  return false;
}

/* ---------------------------------------------------------- B) Bergfahrt */
async function runGondel(d, main) {
  const list = reelNames(d, 18).concat(d.display, ...reelNames(d, 2));
  const win = 18;
  main.innerHTML = `<div class="kicker yk">Bergfahrt …</div>
    <div class="ropeway"><div class="rope"></div><div class="rope two"></div><div class="train" id="train">${list.map((x, i) => `
      <div class="gondola" data-i="${i}"><i class="grip"></i><i class="hanger"></i><div class="cabin"><div class="win"><span>${esc(x)}</span></div><small>${String(i + 7).padStart(2, "0")}</small><i class="door l"></i><i class="door r"></i></div></div>`).join("")}</div></div>
    <div class="station"></div>`;
  const train = $("train"), gs = [...train.children], g = gs[0], pitch = g.offsetWidth + parseFloat(getComputedStyle(train).columnGap || 0);
  const cx = train.parentElement.clientWidth / 2, at = (i) => cx - (i * pitch + g.offsetWidth / 2);
  const x0 = at(-1.5), x1 = at(win);
  let last = -9, lastX = x0, lastV = 0, swing = 0, swingV = 0;
  const motor = SFX.wind(); motor.set(.15, .5);
  await frames(8600, (p, dt) => {
    const e = p < .1 ? .04 * (p / .1) ** 2 : .04 + .96 * (1 - Math.pow(1 - (p - .1) / .9, 3.2));
    const x = x0 + (x1 - x0) * e, v = (x - lastX) / Math.max(dt, .5), acc = v - lastV; lastX = x; lastV = v;
    train.style.transform = `translateX(${x}px)`;
    // Pendelphysik: Kabinen schwingen gegen die Beschleunigung
    swingV += (-swing * .08 - acc * .9) * dt; swingV *= .94; swing += swingV * dt;
    const ang = Math.max(-14, Math.min(14, swing));
    gs.forEach((el, i) => el.style.transform = `rotate(${ang * (1 + (i % 3) * .08) - 9}deg)`);
    motor.set(Math.min(.6, Math.abs(v) / 40), .1);
    const c = Math.round((cx - x - g.offsetWidth / 2) / pitch);
    if (c !== last) { last = c; SFX.tick(.5); if (Math.random() < .35) SFX.creak(); }
  });
  motor.stop(.8);
  // Ausschwingen in der Station
  await frames(1100, (p, dt, ms) => { const ang = swing * Math.exp(-ms / 300) * Math.cos(ms / 90); gs.forEach((el) => el.style.transform = `rotate(${ang - 9}deg)`); });
  const wg = train.querySelector(`[data-i="${win}"]`);
  SFX.bell(); wg.classList.add("arrive");
  await sleep(700);
  wg.classList.add("open"); SFX.whoosh(.4, .12);
  wg.querySelector(".cabin").animate([{ transform: "scale(1)" }, { transform: "scale(1.28) translateY(1cqw)" }], { duration: 700, easing: EASE_OUT, fill: "forwards" });
  await sleep(1300);
  return false;
}

/* ---------------------------------------------------------- C) Anzeigetafel */
async function runTafel(d, main) {
  const name = d.display || d.name, prize = d.prize ? d.prize.slice(0, 26) : "";
  const tw = Math.min(6, 84 / Math.max([...name].length, 9)), pw = Math.min(2.9, 84 / Math.max([...prize].length, 18));
  const row = (txt, cls) => [...txt].map((c) => `<span class="flap ${c === " " ? "gap" : ""}"><b></b></span>`).join("");
  main.innerHTML = `<div class="kicker">Anzeigetafel</div>
    <div class="flapboard"><div class="flaprow frow-l" style="--tw:${tw}cqw">${row(name)}</div>${prize ? `<div class="flaprow frow-s" style="--tw:${pw}cqw">${row(prize)}</div>` : ""}</div>`;
  const CH = " ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜabcdefghijklmnopqrstuvwxyzäöüß0123456789.,-'&€";
  const tiles = [...main.querySelectorAll(".flap")], targets = [...name, ...prize];
  const st = tiles.map((el, i) => {
    const tgt = targets[i]; let ti = CH.indexOf(tgt); if (ti < 0) ti = 0;
    const steps = tgt === " " ? 0 : Math.round(rnd(26, 56)); const big = i < [...name].length;
    return { el, b: el.firstElementChild, tgt, idx: (ti - steps + CH.length * 4) % CH.length, steps, next: (big ? i * 140 : 900 + (i - name.length) * 70) + rnd(0, 120), done: steps === 0, gap: big ? rnd(70, 96) : rnd(50, 66) };
  });
  st.forEach((s) => { if (s.done) s.b.textContent = ""; else s.b.textContent = CH[s.idx]; });
  const t0 = performance.now();
  await new Promise((res) => {
    const iv = setInterval(() => {
      const t = performance.now() - t0; let flipped = 0;
      for (const s of st) {
        if (s.done || t < s.next) continue;
        s.idx = (s.idx + 1) % CH.length; s.steps--; s.b.textContent = CH[s.idx]; s.next = t + s.gap; flipped++;
        s.b.animate([{ transform: "rotateX(-85deg)", opacity: .35 }, { transform: "none", opacity: 1 }], { duration: Math.min(70, s.gap), easing: "linear" });
        if (s.steps <= 0) { s.done = true; s.b.textContent = s.tgt; s.el.classList.add("set"); }
      }
      if (flipped) SFX.clack();
      if (st.every((s) => s.done)) { clearInterval(iv); res(); }
    }, 12);
  });
  // Lichtwelle über die fertige Tafel
  SFX.chime();
  tiles.forEach((el, i) => el.animate([{ background: "#16223B" }, { background: "#3B43A6" }, { background: "#16223B" }], { duration: 520, delay: i * 35, easing: "ease-in-out" }));
  await sleep(1300);
  return false;
}

/* ---------------------------------------------------------- D) Yeti */
function furPath(cx, cy, rx, ry, tufts, depth, rot = 0) {
  let dPath = "";
  for (let i = 0; i <= tufts; i++) {
    const a0 = rot + (i / tufts) * Math.PI * 2, am = rot + ((i + .5) / tufts) * Math.PI * 2, a1 = rot + ((i + 1) / tufts) * Math.PI * 2;
    const p = (a, k) => `${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`;
    if (i === 0) dPath += `M${p(a0, 1)}`;
    if (i < tufts) dPath += ` Q${p(am, 1 + depth * (.7 + ((i * 37) % 10) / 30))} ${p(a1, 1)}`;
  }
  return dPath + "Z";
}
function yetiSVG() {
  const fur = "#F3F7FC", shade = "#CFDBEA", skin = "#A9C1E3", deep = "#2B3A66";
  return `<svg class="yeti-svg" viewBox="0 0 320 400" aria-hidden="true">
    <defs><linearGradient id="lens" x1="0" x2="1"><stop offset="0" stop-color="#3B43A6"/><stop offset=".55" stop-color="#5FA8E8"/><stop offset="1" stop-color="#C9F0FF"/></linearGradient></defs>
    <ellipse cx="160" cy="392" rx="96" ry="10" fill="rgba(0,0,0,.35)"/>
    <g class="y-legL"><path d="${furPath(122, 322, 34, 54, 11, .18)}" fill="${shade}"/><ellipse cx="114" cy="376" rx="42" ry="16" fill="#B7C7DC"/></g>
    <g class="y-legR"><path d="${furPath(198, 322, 34, 54, 11, .18, .3)}" fill="${shade}"/><ellipse cx="206" cy="376" rx="42" ry="16" fill="#B7C7DC"/></g>
    <path d="${furPath(166, 248, 108, 116, 26, .12, .2)}" fill="${shade}"/>
    <path d="${furPath(160, 240, 104, 114, 26, .12)}" fill="${fur}"/>
    <ellipse cx="160" cy="268" rx="62" ry="72" fill="#E4EDF7"/>
    <g class="y-armL"><path d="${furPath(58, 250, 30, 66, 12, .2, .4)}" fill="${fur}"/><ellipse cx="50" cy="312" rx="23" ry="19" fill="${skin}"/></g>
    <g class="y-armR"><path d="${furPath(262, 250, 30, 66, 12, .2, .1)}" fill="${fur}"/><ellipse cx="270" cy="312" rx="23" ry="19" fill="${skin}"/></g>
    <path d="${furPath(160, 122, 80, 70, 20, .14, .1)}" fill="${fur}"/>
    <path d="M108 132 Q108 92 160 92 Q212 92 212 132 Q212 176 160 178 Q108 176 108 132Z" fill="${skin}"/>
    <g class="y-eyes"><ellipse cx="138" cy="126" rx="11" ry="12" fill="#fff"/><ellipse cx="182" cy="126" rx="11" ry="12" fill="#fff"/>
      <circle class="pup" cx="140" cy="129" r="5.5" fill="#0A1620"/><circle class="pup" cx="180" cy="129" r="5.5" fill="#0A1620"/>
      <circle cx="142" cy="126" r="1.8" fill="#fff"/><circle cx="182" cy="126" r="1.8" fill="#fff"/></g>
    <path class="y-brow" d="M124 108 L150 113 M196 108 L170 113" stroke="${deep}" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="160" cy="146" rx="9" ry="6" fill="#5E77A8"/>
    <g class="y-mouth"><path d="M138 160 Q160 176 182 160 Q160 168 138 160Z" fill="#2B1E3A"/><path d="M146 162 l3 -7 l3 8Z M168 162 l3 -8 l3 7Z" fill="#fff"/></g>
    <path d="M90 100 Q92 30 160 26 Q228 30 230 100Z" fill="#C0372C"/>
    <path d="M88 92 Q160 76 232 92 L232 108 Q160 92 88 108Z" fill="#A32C23"/>
    <path d="M100 66 Q160 52 220 66" stroke="#fff" stroke-width="7" fill="none" opacity=".9"/>
    <circle cx="160" cy="24" r="17" fill="#fff"/><circle cx="154" cy="18" r="6" fill="#F3F7FC"/>
    <path d="M96 78 Q160 66 224 78" stroke="#0A1620" stroke-width="8" fill="none" opacity=".75"/>
    <rect x="126" y="62" width="68" height="28" rx="14" fill="#0A1620"/><rect x="130" y="65" width="60" height="22" rx="11" fill="url(#lens)"/>
    <path d="M138 70 L150 70" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  </svg>`;
}
const PILE = `<svg class="pile-svg" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 140 Q20 70 70 66 Q90 30 140 36 Q170 4 214 18 Q250 6 278 34 Q330 30 348 70 Q392 78 400 140Z" fill="#E8EFF7"/>
  <path d="M30 140 Q60 96 120 92 Q170 70 230 78 Q300 76 340 104 Q370 116 380 140Z" fill="#CFDBEA" opacity=".7"/>
  <circle cx="120" cy="56" r="3" fill="#fff"/><circle cx="240" cy="40" r="2.5" fill="#fff"/><circle cx="300" cy="62" r="2" fill="#fff"/></svg>`;

async function runYeti(d, main) {
  main.innerHTML = `<div class="kicker yk">Der Yeti zieht …</div>
    <div class="yscene"><div class="pile" id="pile">${PILE}</div><div class="yeti" id="yeti">${yetiSVG()}</div></div>
    <div class="ticket" id="ticket"><div class="face front"><span>Glückslos</span><i></i></div><div class="face back"><small>Glückslos</small><b class="stuck">${esc(d.display || d.name)}</b></div></div>`;
  const yeti = $("yeti"), svg = yeti.firstElementChild, pile = $("pile"), ticket = $("ticket");
  const q = (s) => svg.querySelector(s);
  const legL = q(".y-legL"), legR = q(".y-legR"), armL = q(".y-armL"), armR = q(".y-armR"), mouth = q(".y-mouth");

  // 1) Reinstapfen
  yeti.animate([{ transform: "translateX(-46cqw)" }, { transform: "translateX(0)" }], { duration: 3000, easing: "cubic-bezier(.3,.1,.3,1)", fill: "forwards" });
  for (let i = 0; i < 8; i++) {
    const L = i % 2 === 0;
    (L ? legL : legR).animate([{ transform: "translateY(0) rotate(0)" }, { transform: "translateY(-14px) rotate(" + (L ? -10 : 10) + "deg)" }, { transform: "translateY(0) rotate(0)" }], { duration: 360, easing: "ease-in-out" });
    svg.animate([{ transform: "translateY(0) rotate(0)" }, { transform: `translateY(-8px) rotate(${L ? -2 : 2}deg)` }, { transform: "translateY(0) rotate(0)" }], { duration: 360, easing: "ease-in-out" });
    (L ? armR : armL).animate([{ transform: "rotate(0)" }, { transform: `rotate(${L ? 14 : -14}deg)` }, { transform: "rotate(0)" }], { duration: 360 });
    await sleep(340);
    SFX.thud(.45 + i * .03); shake(.22 + i * .02, 260);
    const f = posIn(yeti, L ? .35 : .65, .97); snowPuff(f.x, f.y, 22, { power: 4, spread: Math.PI * .9 });
    await sleep(35);
  }
  await sleep(250);

  // 2) Brüllen
  SFX.roar(); flicker(1100); shake(1.1, 1400); storm = .25;
  mouth.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.5,3)" }, { transform: "scale(1.5,3)" }, { transform: "scale(1,1)" }], { duration: 1700, easing: "ease-in-out" });
  svg.animate([{ transform: "scale(1)" }, { transform: "scale(1.06) translateY(-6px)" }, { transform: "scale(1.06) translateY(-6px)" }, { transform: "scale(1)" }], { duration: 1700, easing: "ease-in-out" });
  [armL, armR].forEach((a, i) => a.animate([{ transform: "rotate(0)" }, { transform: `rotate(${i ? -70 : 70}deg)` }, { transform: `rotate(${i ? -70 : 70}deg)` }, { transform: "rotate(0)" }], { duration: 1700, easing: "ease-in-out" }));
  await sleep(1900); storm = 0;

  // 3) Im Schneehaufen wühlen – Lose fliegen heraus
  SFX.drumroll(3.4);
  for (let i = 0; i < 6; i++) {
    armR.animate([{ transform: "rotate(0)" }, { transform: "rotate(-48deg)" }, { transform: "rotate(16deg)" }, { transform: "rotate(0)" }], { duration: 560, easing: "ease-in-out" });
    svg.animate([{ transform: "rotate(0)" }, { transform: "rotate(4deg) translateX(6px)" }, { transform: "rotate(0)" }], { duration: 560 });
    await sleep(300);
    SFX.crunch(); const p = posIn(pile, rnd(.3, .55), .3); snowPuff(p.x, p.y, 45, { dir: -Math.PI / 2 + .3, spread: 1.6, power: 9 });
    for (let k = 0; k < 2; k++) slip(main, pick(d.reel.length ? d.reel : ["…"]), p);
    await sleep(260);
  }

  // 4) Das Glückslos schießt heraus und dreht sich
  armR.animate([{ transform: "rotate(0)" }, { transform: "rotate(-150deg)" }], { duration: 420, easing: EASE_OUT, fill: "forwards" });
  armL.animate([{ transform: "rotate(0)" }, { transform: "rotate(130deg)" }], { duration: 420, easing: EASE_OUT, fill: "forwards" });
  const pp = posIn(pile, .45, .25); snowPuff(pp.x, pp.y, 120, { power: 13, spread: 1.2 }); SFX.whoosh(.6, .3); SFX.chime();
  ticket.classList.add("show");
  await ticket.animate([
    { transform: "translate(-30cqw, 18cqw) rotateZ(-40deg) rotateY(0deg) scale(.45)", opacity: 0 },
    { transform: "translate(-12cqw, -10cqw) rotateZ(200deg) rotateY(0deg) scale(.8)", opacity: 1, offset: .5 },
    { transform: "translate(0, 0) rotateZ(356deg) rotateY(0deg) scale(1)", opacity: 1 },
  ], { duration: 1300, easing: EASE_OUT, fill: "forwards" }).finished;
  SFX.whoosh(.35, .15);
  await ticket.animate([{ transform: "rotateZ(-4deg) perspective(80cqw) rotateY(0deg)" }, { transform: "rotateZ(-4deg) perspective(80cqw) rotateY(90deg)" }], { duration: 300, easing: "cubic-bezier(.55,0,1,.45)", fill: "forwards" }).finished;
  ticket.classList.add("flipped");
  await ticket.animate([{ transform: "rotateZ(-4deg) perspective(80cqw) rotateY(-90deg)" }, { transform: "rotateZ(-4deg) perspective(80cqw) rotateY(0deg)" }], { duration: 520, easing: EASE_OUT, fill: "forwards" }).finished;
  // Yeti jubelt weiter
  svg.animate([{ transform: "translateY(0)" }, { transform: "translateY(-10px)" }, { transform: "translateY(0)" }], { duration: 520, iterations: 4, easing: "ease-in-out" });
  return "right";
}
// Fliegendes Los-Papierchen mit einem Namen
function slip(main, txt, p) {
  const el = document.createElement("div"); el.className = "slip"; el.textContent = txt;
  el.style.left = p.x + "px"; el.style.top = p.y + "px"; main.appendChild(el);
  const dx = rnd(-30, 30), up = rnd(14, 26);
  el.animate([
    { transform: "translate(-50%,-50%) rotate(0) scale(.7)", opacity: 0 },
    { transform: `translate(calc(-50% + ${dx * .5}cqw), calc(-50% - ${up}cqw)) rotate(${rnd(-200, 200)}deg) scale(1)`, opacity: 1, offset: .35 },
    { transform: `translate(calc(-50% + ${dx}cqw), calc(-50% + 12cqw)) rotate(${rnd(-500, 500)}deg) scale(.9)`, opacity: 0 },
  ], { duration: rnd(1500, 2100), easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" }).finished.then(() => el.remove());
}

/* ---------------------------------------------------------- E) Schneesturm */
function splatSVG() {
  // weicher Klecks: Punkte auf einer Ellipse, verbunden über Kurvenmittelpunkte
  const n = 18, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, r = i % 3 === 0 ? rnd(1.12, 1.3) : rnd(.92, 1.04); pts.push([200 + Math.cos(a) * 168 * r, 100 + Math.sin(a) * 74 * r]); }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let blob = `M${mid(pts[n - 1], pts[0]).map((v) => v.toFixed(1)).join(" ")}`;
  for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); blob += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`; }
  // Tropfen: schmal oben, Tropfen-Kopf unten
  const drips = Array.from({ length: 6 }, () => { const x = rnd(90, 310), y = rnd(150, 165), h = rnd(18, 62), w = rnd(5, 10);
    return `<path d="M${x - w} ${y} Q${x - w * .5} ${y + h * .6} ${x - w * .55} ${y + h} A${w * .9} ${w * .9} 0 1 0 ${x + w * .55} ${y + h} Q${x + w * .5} ${y + h * .6} ${x + w} ${y}Z"/>`; }).join("");
  const dots = Array.from({ length: 26 }, () => { const a = rnd(0, 7), r = rnd(1.18, 1.6); return `<circle cx="${(200 + Math.cos(a) * 172 * r).toFixed(0)}" cy="${(100 + Math.sin(a) * 80 * r).toFixed(0)}" r="${rnd(2, 9).toFixed(1)}"/>`; }).join("");
  return `<svg class="splat-svg" viewBox="-30 -50 460 300" aria-hidden="true">
    <g fill="#CFDBEA" transform="translate(6 8)"><path d="${blob}Z"/></g>
    <g fill="#F4F8FF"><path d="${blob}Z"/>${drips}${dots}</g>
    <ellipse cx="150" cy="58" rx="96" ry="20" fill="#fff" opacity=".75"/><ellipse cx="290" cy="150" rx="40" ry="10" fill="#DCE5EA" opacity=".6"/></svg>`;
}
async function runSturm(d, main) {
  const names = reelNames(d, 20);
  main.innerHTML = `<div class="kicker">Schneesturm …</div><div class="storm" id="stormBox">${names.map((n) => `<div class="sn">${esc(n)}</div>`).join("")}
    <div class="splat" id="splat">${splatSVG()}</div><div class="sn win" id="snWin"><b class="stuck">${esc(d.display || d.name)}</b></div></div>`;
  const box = $("stormBox"), els = [...box.querySelectorAll(".sn:not(.win)")], winEl = $("snWin"), splat = $("splat");
  const W = box.clientWidth, H = box.clientHeight, cx = W / 2, cy = H * .5;
  const parts = els.map((el, i) => ({ el, a: (i / els.length) * Math.PI * 2, r: rnd(.45, 1.05), w: rnd(.012, .022) * (Math.random() < .5 ? 1 : -1) * 0 + rnd(.012, .022), z: rnd(0, 6.28), zs: rnd(.02, .05), boost: 0 }));
  const air = SFX.wind();
  let nextBoost = 900;
  // 1) Sturm baut sich auf, Namen wirbeln um die Mitte
  await frames(6800, (p, dt, ms) => {
    const lvl = Math.min(1, p * 1.35); storm = .2 + lvl * .8; air.set(lvl, .12);
    const spin = 1 + p * 2.6, squeeze = 1 - p * .35;
    if (ms > nextBoost) { nextBoost = ms + rnd(500, 900); const b = pick(parts); b.boost = 1; SFX.whoosh(.45, .16 + lvl * .1); }
    for (const t of parts) {
      t.a += t.w * spin * dt; t.z += t.zs * dt; t.boost = Math.max(0, t.boost - .025 * dt);
      const depth = .5 + .5 * Math.sin(t.z) + t.boost * 1.6;
      const r = t.r * squeeze * (1 + .12 * Math.sin(t.z * 1.7));
      const x = cx + Math.cos(t.a) * r * W * .44, y = cy + Math.sin(t.a) * r * H * .4;
      t.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${Math.cos(t.a) * 14}deg) scale(${(.45 + depth * .8).toFixed(3)})`;
      t.el.style.opacity = (.25 + Math.min(1, depth) * .75).toFixed(2);
      t.el.style.filter = `blur(${(Math.abs(1 - depth) * 3.5 + t.boost * 3).toFixed(1)}px)`;
    }
  });
  // 2) Alle fliegen nach außen weg, einer kommt aus der Tiefe
  winEl.style.opacity = 0;
  SFX.whoosh(1, .3);
  await frames(800, (p) => {
    for (const t of parts) { const x = cx + Math.cos(t.a) * (1 + p * 2) * W * .42 * t.r, y = cy + Math.sin(t.a) * (1 + p * 2) * H * .34 * t.r;
      t.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${.6 + p})`; t.el.style.opacity = (1 - p).toFixed(2); t.el.style.filter = `blur(${2 + p * 8}px)`; }
    winEl.style.opacity = (p * .8).toFixed(2);
    winEl.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%) scale(${.18 + p * .08}) rotate(${p * 30}deg)`;
    winEl.style.filter = "blur(6px)";
  });
  // 3) … und klatscht gegen den Bildschirm
  SFX.whoosh(.5, .35);
  await frames(480, (p) => {
    const e = p * p * p; winEl.style.opacity = 1;
    winEl.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%) scale(${.26 + e * 1.9}) rotate(${30 - e * 34}deg)`;
    winEl.style.filter = `blur(${(6 * (1 - p)).toFixed(1)}px)`;
  });
  air.stop(1.6); storm = .06; main.querySelector(".kicker")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
  SFX.splat(); shake(1.7, 650); stageEl.classList.add("frosted");
  splat.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%) rotate(-4deg)`;
  splat.animate([{ opacity: 0, transform: `translate(${cx}px,${cy}px) translate(-50%,-50%) rotate(-4deg) scale(.6)` }, { opacity: 1, transform: `translate(${cx}px,${cy}px) translate(-50%,-50%) rotate(-4deg) scale(1.06)`, offset: .6 }, { opacity: 1, transform: `translate(${cx}px,${cy}px) translate(-50%,-50%) rotate(-4deg) scale(1)` }], { duration: 260, easing: EASE_OUT, fill: "forwards" });
  winEl.animate([
    { transform: `translate(${cx}px,${cy}px) translate(-50%,-50%) rotate(-4deg) scale(1.32,.7)` },
    { transform: `translate(${cx}px,${cy}px) translate(-50%,-50%) rotate(-4deg) scale(.92,1.08)`, offset: .45 },
    { transform: `translate(${cx}px,${cy}px) translate(-50%,-50%) rotate(-4deg) scale(1.02,.98)`, offset: .75 },
    { transform: `translate(${cx}px,${cy}px) translate(-50%,-50%) rotate(-4deg) scale(1)` },
  ], { duration: 560, easing: "ease-out", fill: "forwards" });
  winEl.style.filter = "none";
  const sp = { x: cx + box.getBoundingClientRect().left - stageEl.getBoundingClientRect().left, y: cy + box.getBoundingClientRect().top - stageEl.getBoundingClientRect().top };
  snowPuff(sp.x, sp.y, 200, { dir: 0, spread: Math.PI * 2, power: 12 });
  // langsames Herunterrutschen – klebt am Glas
  [winEl, splat].forEach((el) => el.animate([{ translate: "0 0" }, { translate: "0 1.6cqw" }], { duration: 5200, delay: 600, easing: "cubic-bezier(.5,0,.5,1)", fill: "forwards" }));
  await sleep(1200);
  return "center";
}

/* ---------------------------------------------------------- Bedienung */
async function startDraw(test) {
  if (stagePlaying) return;
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); } catch {}
  $("drawBtn").disabled = $("testDrawBtn").disabled = true;
  try {
    await tApi({ action: "showDraw", prizeId: test ? null : ($("sPrize").value || null), prize: test ? (currentPrizeLabel() || "Testgewinn") : $("sPrizeText").value.trim(), unique: $("sUnique").checked, test, anim: $("sAnim").value });
    $("sPrizeText").value = "";
  } catch (err) { alert(err.message); $("drawBtn").disabled = $("testDrawBtn").disabled = false; return; }
  poll();
}
$("drawBtn").onclick = () => startDraw(false);
$("testDrawBtn").onclick = () => startDraw(true);
$("armBtn").onclick = async () => {
  const d = (state.show?.draws || []).find((x) => x.id === state.show.currentId); if (!d?.prizeId) return;
  try { await tApi({ action: "arm", id: d.prizeId }); $("armBtn").hidden = true; alert(`„${d.prize}“ liegt im Tombola-Reiter bereit. Wenn ${d.display} am Stand ist: Ticket auf der Tombola-Liste scannen.`); } catch (err) { alert(err.message); }
  poll();
};
$("fsBtn").onclick = () => { try { stageEl.requestFullscreen ? stageEl.requestFullscreen() : stageEl.webkitRequestFullscreen?.(); } catch {} };
stageEl.ondblclick = () => (document.fullscreenElement ? document.exitFullscreen() : $("fsBtn").click());
try { $("sAnim").value = localStorage.getItem("ur_anim") || "auto"; } catch {}
$("sAnim").onchange = () => ls.set("ur_anim", $("sAnim").value);
$("sUnique").onchange = () => { poolAt = 0; refreshPool(); };
$("sPrize").onchange = $("sPrizeText").oninput = () => { if (!stagePlaying && !state.show?.currentId) { delete htmlCache.stageMain; renderStage(); } };
$("sResetBtn").onclick = async () => { if (!confirm("Liste der gezogenen Namen leeren? Danach können alle wieder gezogen werden.")) return; await tApi({ action: "showReset" }).catch(() => {}); poolAt = 0; poll(); };
document.addEventListener("click", async (e) => {
  const x = e.target.closest("[data-sdel]"); if (!x) return;
  if (!confirm("Diese Ziehung löschen? Die Person kann dann wieder gezogen werden.")) return;
  await tApi({ action: "showDelete", id: x.dataset.sdel }).catch(() => {}); poolAt = 0; poll();
});
document.addEventListener("keydown", (e) => {
  if (tab !== "S" || e.code !== "Space" || /INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || "")) return;
  e.preventDefault();
  if (state.show?.currentId && !stagePlaying) { tApi({ action: "showClear" }).then(poll); return; } // erst zurück auf „Gleich wird gezogen“
  $("drawBtn").click();
});
setInterval(() => { if (stageOn) refreshPool(); }, 5000);
if (tab === "S") stageVisible(true);
