// =====================================================================
// hosa27 - participant app logic (runs in Safari / as an iPad home-screen app)
// Task content lives in tasks.js. Data is stored on the iPad (IndexedDB)
// after every step, then exported as one JSON file per participant.
// =====================================================================
(() => {
  "use strict";

  const $app = document.getElementById("app");
  const $help = document.getElementById("helpBtn");
  const $corner = document.getElementById("staffCorner");
  const $overlay = document.getElementById("overlay");
  const $toast = document.getElementById("toast");
  const $rbar = document.getElementById("rbar");

  const params = new URLSearchParams(location.search);
  const DEMO = params.get("demo") === "1"; // demo mode: no microphone, data marked as demo
  // Researcher mode: toolbar to skip / go back / jump, mute or speed up the voice, shorten timers.
  const R = { on: params.get("researcher") === "1", voice: "normal", short: false, mic: false };
  const noMic = () => DEMO || (R.on && !R.mic);

  let session = null;     // current session record
  let stepIndex = 0;
  let wakeLock = null;
  let abortStep = null;   // function that cancels the running step
  let persisted = false;  // storage protected from automatic clearing
  let redoReturn = false; // a single question is being redone from the quality check
  const pendingFlags = {};// flags attached to the next saved attempt of a step (e.g. restarted after a pause)
  let noVoiceStreak = 0;  // consecutive spoken answers with no speech detected (microphone problem?)
  let unexported = 0;     // real sessions on this device not yet exported

  // ---------------------------------------------------------------- icons (inline SVG, no downloads)
  const ICON = {
    logo: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="14" fill="#0e7c7b"/><path d="M24 12c-6.6 0-12 4.9-12 11 0 3.4 1.7 6.4 4.4 8.4L16 36l5-2.2c1 .2 2 .3 3 .3 6.6 0 12-4.9 12-11s-5.4-11-12-11z" fill="#fff" opacity=".95"/><path d="M17.5 23.5h3l2-4 3 8 2-4h3" stroke="#0e7c7b" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8"/></svg>`,
    ear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>`,
    replay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>`,
    erase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`,
  };

  // ---------------------------------------------------------------- utils
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const now = () => performance.now();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (id) => document.getElementById(id);
  function toast(msg, ms = 1800) {
    $toast.textContent = msg; $toast.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => $toast.classList.add("hidden"), ms);
  }
  function blobToDataURL(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  }
  function localDateInfo(d = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return {
      localDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
      month: d.toLocaleDateString("en-US", { month: "long" }),
      dayOfMonth: d.getDate(), year: d.getFullYear(),
    };
  }
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  // larger text option (saved on this device)
  const applyTextSize = () => document.body.classList.toggle("xl", store.get("hosa27.xl") === "1");
  applyTextSize();

  // ---------------------------------------------------------------- storage (IndexedDB)
  const DB = {
    _db: null,
    open() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((res, rej) => {
        const req = indexedDB.open("hosa27", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("sessions", { keyPath: "sessionId" });
        req.onsuccess = () => { this._db = req.result; res(this._db); };
        req.onerror = () => rej(req.error);
      });
    },
    async tx(mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const t = db.transaction("sessions", mode); const st = t.objectStore("sessions");
        const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error);
      });
    },
    put(s) { return this.tx("readwrite", (st) => st.put(s)); },
    del(id) { return this.tx("readwrite", (st) => st.delete(id)); },
    async all() {
      const db = await this.open();
      return new Promise((res, rej) => {
        const req = db.transaction("sessions").objectStore("sessions").getAll();
        req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error);
      });
    },
  };
  async function saveSession() {
    if (!session) return;
    session.updatedAt = new Date().toISOString();
    try { await DB.put(session); } catch (e) { console.error("save failed", e); toast("⚠️ Could not save — tell staff"); }
  }
  async function checkPersisted() {
    try { persisted = !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch (_) {}
  }
  async function requestPersist() {
    try { if (navigator.storage && navigator.storage.persist) persisted = await navigator.storage.persist(); } catch (_) {}
  }

  // ---------------------------------------------------------------- sound: chime + audio context
  let actx = null;
  function audioCtx() {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!actx && C) actx = new C();
    if (actx && actx.state === "suspended") actx.resume();
    return actx;
  }
  // soft two-note "your turn" chime (generated, no file needed)
  function chime(up = true) {
    if (muted()) return sleep(0);
    const ctx = audioCtx(); if (!ctx) return sleep(0);
    const t = ctx.currentTime;
    (up ? [660, 880] : [880, 660]).forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.14); g.gain.linearRampToValueAtTime(0.12, t + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.32);
      o.connect(g).connect(ctx.destination); o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.34);
    });
    return sleep(420);
  }

  // ---------------------------------------------------------------- voice
  // 1) Recorded voice pack (app/audio/, made with tools/make_voice_audio.py or your own recordings) - preferred.
  // 2) Otherwise the device's built-in voice; Premium/Enhanced voices are chosen first.
  const VOICE_KEY = "hosa27.voiceName";
  const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Zarvox|Junior|Ralph|Fred|Kathy|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/;
  const hasPack = () => Object.keys(RECORDED_AUDIO).length > 0;
  let voice = null;
  function voiceRank(v) {
    const n = v.name;
    return (/premium/i.test(n) ? 0 : /enhanced/i.test(n) ? 1 : VOICE.preferredNames.some((p) => n.includes(p)) ? 2 : 3) + (v.lang === VOICE.lang ? 0 : 0.5);
  }
  function englishVoices() {
    const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    return vs.filter((v) => v.lang && v.lang.startsWith("en") && !NOVELTY.test(v.name)).sort((a, b) => voiceRank(a) - voiceRank(b));
  }
  function pickVoice() {
    const vs = englishVoices(); const saved = store.get(VOICE_KEY);
    voice = (saved && vs.find((v) => v.name === saved)) || vs[0] || null;
    fillVoiceSelect();
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  const rateMult = () => (R.on && R.voice === "fast" ? 1.8 : 1);
  const sentencePause = () => (VOICE.sentencePauseMs ?? 600) / rateMult(); // calm pause between sentences
  function muted() { return R.on && R.voice === "mute"; }

  // ---------------------------------------------------------------- subtitles (captions)
  // Each screen has a <div id="cap">. The sentence being spoken is shown with the current word highlighted.
  // Items participants must memorize/repeat (words, digits, sentences, letters) are NOT shown as text -
  // that would turn a listening task into a reading task - so the caption says "Listen carefully" instead.
  const splitSentences = (t) => (String(t || "").match(/[^.!?]+[.!?]*\s*/g) || []).map((s) => s.trim()).filter(Boolean);
  function showCaption(text, { listen = false } = {}) {
    const el = $("cap"); if (!el) return null;
    el.classList.add("on");
    if (listen) { el.innerHTML = `<span class="cap-listen">🔊 Listen carefully…</span>`; return null; }
    const words = text.trim().split(/\s+/);
    el.innerHTML = `<span class="cap-ic" aria-hidden="true">🔊</span>` + words.map((w, i) => `<span class="w" data-i="${i}">${esc(w)}</span>`).join(" ");
    const spans = [...el.querySelectorAll(".w")];
    const starts = []; let pos = 0; words.forEach((w) => { const i = text.indexOf(w, pos); starts.push(i < 0 ? pos : i); pos = (i < 0 ? pos : i) + w.length; });
    let cur = -1;
    const cap = {
      word(i) { if (i === cur) return; cur = i; spans.forEach((s, k) => { s.classList.toggle("now", k === i); s.classList.toggle("past", k < i); }); },
      char(ci) { let i = 0; while (i + 1 < starts.length && starts[i + 1] <= ci) i++; cap.word(i); },
      frac(f) { cap.char(Math.max(0, Math.min(1, f)) * text.length); },
      done() { cur = spans.length; spans.forEach((s) => { s.classList.remove("now"); s.classList.add("past"); }); },
    };
    cap.word(0);
    return cap;
  }
  function clearCaption() { const el = $("cap"); if (el) { el.classList.remove("on"); el.innerHTML = ""; } }

  // ---------------------------------------------------------------- built-in voice (fallback when there is no voice pack)
  let ttsBroken = false; let ttsWarned = false; let lastUtterance = null;
  function speakText(text, { onstart, cap, rate } = {}) {
    if (muted() || !text) { onstart && onstart(now()); return sleep(muted() ? 60 : 0); }
    const readMs = 600 + text.length * 70; // time to read the caption if the voice can't play
    if (ttsBroken || !window.speechSynthesis) return readAlong(text, readMs, { onstart, cap });
    return new Promise(async (resolve) => {
      if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); await sleep(90); } // avoid cancel+speak in one tick (Chrome bug)
      const u = new SpeechSynthesisUtterance(text); lastUtterance = u; // keep a reference (Chrome can garbage-collect it mid-speech)
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : VOICE.lang; u.rate = (rate ?? VOICE.rate) * rateMult();
      let done = false, started = false, gotBoundary = false, anim = null;
      const finish = () => { if (!done) { done = true; clearInterval(anim); cap && cap.done(); resolve(); } };
      u.onstart = () => {
        started = true; onstart && onstart(now());
        const est = (text.length * 75) / (VOICE.rate * rateMult()); const t0 = now();
        anim = setInterval(() => { if (!gotBoundary && cap) cap.frac((now() - t0) / est); }, 80); // estimate if no word events
      };
      u.onboundary = (e) => { if (cap && (e.name === "word" || e.name === undefined)) { gotBoundary = true; cap.char(e.charIndex); } };
      u.onend = finish; u.onerror = finish;
      speechSynthesis.speak(u);
      // The device voice sometimes never starts (seen in Chrome on Mac). Detect it, then fall back to captions only.
      setTimeout(async () => {
        if (started || done) return;
        speechSynthesis.cancel(); ttsBroken = true;
        if (!ttsWarned) { ttsWarned = true; toast("⚠️ The device voice isn't responding — showing subtitles only. Make a voice pack (see README).", 6000); }
        await readAlong(text, readMs, { onstart: null, cap }); finish();
      }, 2500);
      setTimeout(finish, 2500 + (text.length * 110) / (VOICE.rate * rateMult())); // iOS sometimes never fires onend
    });
  }
  // No sound available: animate the caption at reading pace so the participant can read along.
  async function readAlong(text, ms, { onstart, cap } = {}) {
    onstart && onstart(now());
    const t0 = now(); const my = playGen;
    while (now() - t0 < ms && my === playGen) { cap && cap.frac((now() - t0) / ms); await sleep(60); }
    cap && cap.done();
  }

  // ---------------------------------------------------------------- voice pack playback (Web Audio: reliable on iPad + Mac, precise timing)
  const bufCache = {};
  async function loadBuf(src) {
    if (bufCache[src]) return bufCache[src];
    const ctx = audioCtx(); if (!ctx) throw new Error("no audio");
    const ab = await (await fetch(src)).arrayBuffer();
    const buf = await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
    bufCache[src] = buf; return buf;
  }
  let currentNode = null; let playGen = 0;
  function playFile(src, { onstart, cap } = {}) {
    if (muted() || !src) { onstart && onstart(now()); cap && cap.done(); return sleep(60); }
    return new Promise(async (resolve) => {
      let done = false, raf = null; let node = null;
      const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); if (currentNode === node) currentNode = null; cap && cap.done(); resolve(); };
      let buf;
      try { buf = await loadBuf(src); } catch (_) { return resolve(playHtmlAudio(src, { onstart, cap })); }
      const ctx = audioCtx();
      node = ctx.createBufferSource(); node.buffer = buf; node.playbackRate.value = rateMult(); node.connect(ctx.destination);
      node.onended = finish; node._finish = finish; currentNode = node;
      const t0 = ctx.currentTime; const dur = buf.duration / rateMult();
      node.start(); onstart && onstart(now());
      const tick = () => { if (done) return; cap && cap.frac((ctx.currentTime - t0) / dur); raf = requestAnimationFrame(tick); };
      tick();
      setTimeout(finish, dur * 1000 + 1000); // safety net
    });
  }
  function playHtmlAudio(src, { onstart, cap } = {}) { // fallback if Web Audio can't decode a file
    return new Promise((resolve) => {
      const a = new Audio(src); let done = false;
      const finish = () => { if (!done) { done = true; cap && cap.done(); resolve(); } };
      currentNode = { stop: () => a.pause(), _finish: finish };
      a.playbackRate = rateMult(); a.onplaying = () => onstart && onstart(now());
      a.ontimeupdate = () => cap && a.duration && cap.frac(a.currentTime / a.duration);
      a.onended = finish; a.onerror = finish; a.play().catch(finish);
    });
  }
  // preload a step's voice files in the background so playback starts instantly
  function prefetchStep(step) {
    const rec = step && RECORDED_AUDIO[step.id]; if (!rec || !audioCtx()) return;
    const srcs = rec.parts ? rec.parts.map((p) => p.src).concat(rec.seq || []) : [rec.src || rec];
    srcs.forEach((s) => loadBuf(s).catch(() => {}));
  }

  // Speaks a step's instructions with subtitles. Since v0.9.0 the words/numbers/sentence to remember are NOT
  // part of this: they play only after the participant taps START (playSequence), so the instructions can be
  // replayed as often as needed without extra exposure to the memory items.
  async function playInstruction(step, { withSequence = false } = {}) {
    const my = playGen; const live = () => my === playGen;
    const rec = RECORDED_AUDIO[step.id];
    if (rec && rec.parts) {                               // generated voice pack: one file per sentence
      for (const p of rec.parts) { if (!live()) return; await playFile(p.src, { cap: showCaption(p.text) }); if (!live()) return; await sleep(muted() ? 0 : sentencePause()); }
    } else if (rec && !(typeof rec === "object" && rec.includesSequence)) { // own single-file recording of the instructions
      await playFile(typeof rec === "string" ? rec : rec.src, { cap: showCaption(step.say) });
    } else {                                              // built-in device voice, sentence by sentence
      for (const s of splitSentences(step.say)) { if (!live()) return; await speakText(s, { cap: showCaption(s) }); if (!live()) return; await sleep(muted() ? 0 : sentencePause()); }
    }
    if (!live()) return;
    if (withSequence && step.sequence) await playSequence(step);
    if (live()) clearCaption();
  }
  // The words / numbers / sentence to remember or repeat: heard, never shown ("Listen carefully…" instead).
  async function playSequence(step) {
    const my = playGen; const live = () => my === playGen;
    const rec = RECORDED_AUDIO[step.id];
    await sleep(600); if (!live()) return;
    showCaption("", { listen: true }); lockPause(true); // no pausing mid-list
    if (rec && rec.parts && rec.seq && rec.seq.length) {
      for (const s of rec.seq) { if (!live()) break; await playFile(s); if (!live()) break; await sleep(muted() ? 0 : (rec.seqGapMs ?? 700)); }
    } else {
      const rate = step.seqRate ? VOICE.rate * (step.seqRate / 135) : undefined; // slower built-in voice for sentences
      for (const item of step.sequence) { if (!live()) break; await speakText(item, { rate }); if (!live()) break; await sleep(muted() ? 0 : (step.sequenceGapMs ?? 1000)); }
    }
    lockPause(false);
    if (live()) clearCaption();
  }
  function stopSpeech() {
    playGen += 1;
    try { window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending) && speechSynthesis.cancel(); } catch (_) {}
    if (currentNode) { const n = currentNode; currentNode = null; try { n.stop(); } catch (_) {} n._finish && n._finish(); }
  }

  // ---------------------------------------------------------------- microphone recording (+ live level meter)
  function pickMime() {
    if (!window.MediaRecorder) return "";
    for (const m of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) if (MediaRecorder.isTypeSupported(m)) return m;
    return "";
  }
  async function getMic() {
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  }
  // Starts recording; returns { stop(): Promise<{blob, mime, ms}>, level(): 0..1 }.
  // The mic is opened per recording and released after, so the iPad speaker stays loud between items.
  async function startRecording({ force = false } = {}) {
    if (noMic() && !force) {
      const t0 = now();
      return { level: () => 0, stop: async () => ({ blob: null, mime: "", ms: Math.round(now() - t0) }) };
    }
    const stream = await getMic();
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = []; rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    // level meter
    let analyser = null, buf = null, src = null;
    try {
      const ctx = audioCtx();
      if (ctx) { src = ctx.createMediaStreamSource(stream); analyser = ctx.createAnalyser(); analyser.fftSize = 512; src.connect(analyser); buf = new Uint8Array(analyser.fftSize); }
    } catch (_) {}
    const level = () => {
      if (!analyser) return 0;
      analyser.getByteTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      return Math.min(1, Math.sqrt(sum / buf.length) * 6);
    };
    const t0 = now(); rec.start(250);
    return {
      level,
      stop: () => new Promise((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          try { src && src.disconnect(); } catch (_) {}
          resolve({ blob: new Blob(chunks, { type: rec.mimeType || mime || "audio/mp4" }), mime: rec.mimeType || mime, ms: Math.round(now() - t0) });
        };
        if (rec.state !== "inactive") rec.stop(); else rec.onstop();
      }),
    };
  }

  // ---------------------------------------------------------------- timers (researcher "short" mode)
  const limitSec = (step) => (R.on && R.short ? Math.min(step.maxSeconds || 30, step.countdown ? 6 : 4) : (step.maxSeconds || 30));
  const trailLimitSec = (step) => (R.on && R.short ? 20 : (step.timeLimitSec || 120));

  // ---------------------------------------------------------------- wake lock (keep screen on)
  async function keepAwake() {
    try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (_) {}
  }
  document.addEventListener("visibilitychange", () => { if (session && document.visibilityState === "visible") keepAwake(); });

  // ---------------------------------------------------------------- item record helpers
  function itemBase(step) {
    return { id: step.id, type: step.type, domain: step.domain || null, max: step.max || 0, scoredBy: step.scoredBy || "none",
      prompt: step.text || "", key: step.key || null, startedAt: new Date().toISOString(), replays: 0, _t0: now() };
  }
  // Saving never silently overwrites: a redo keeps every earlier attempt in item.attempts (audit trail).
  async function storeItem(item) {
    if (item._t0 !== undefined) { item.totalMs = Math.round(now() - item._t0); delete item._t0; } // screen shown -> saved
    const prev = session.items[item.id];
    if (prev) { const { attempts, ...old } = prev; item.attempts = [...(attempts || []), old]; }
    item.attempt = (item.attempts ? item.attempts.length : 0) + 1;
    if (pendingFlags[item.id]) { item.flags = [...(item.flags || []), ...pendingFlags[item.id]]; delete pendingFlags[item.id]; }
    session.items[item.id] = item; await saveSession();
  }
  function logCorrection(type, stepId, reason, extra = {}) {
    session.corrections = session.corrections || [];
    session.corrections.push({ type, step: stepId, reason: reason || "", at: new Date().toISOString(), ...extra });
  }
  function flagNext(stepId, flag) { (pendingFlags[stepId] = pendingFlags[stepId] || []).push(flag); }
  // items where repeating gives extra exposure to material that must be remembered
  const isMemorySensitive = (step) => !!step && (!step.allowReplay && step.type === "speak" || step.id === "recall" || step.id.startsWith("learn"));
  function lockPause(on) { const b = $("pauseBtn"); if (b) { b.disabled = on; b.style.opacity = on ? 0.35 : 1; } }

  // =====================================================================
  // STAFF CONSOLE
  // =====================================================================
  function consoleShell(inner, { single = false } = {}) {
    return `<div class="console">
      <header class="chead"><div class="brand">${ICON.logo}<span>hosa27 · Staff console</span></div>
        <span class="ver">v${HOSA27_VERSION}</span><span class="spacer"></span>
        ${DEMO ? `<span class="pill warn">DEMO MODE</span>` : ""}
        <span class="pill ${hasPack() ? "good" : ""}">${hasPack() ? "Voice pack ✓" : "Built-in voice"}</span>
        <span class="pill ${persisted ? "good" : "warn"}">${persisted ? "Storage protected ✓" : "Storage not protected yet"}</span>
        <span class="pill ${unexported ? "warn" : "good"}" id="unexp">${unexported ? `${unexported} session(s) not exported` : "All sessions exported ✓"}</span>
      </header>
      <div class="cbody ${single ? "single" : ""}">${inner}</div></div>`;
  }

  function fillVoiceSelect() {
    const sel = $("voiceSel"); if (!sel) return;
    const vs = englishVoices();
    sel.innerHTML = vs.length
      ? vs.map((v) => `<option value="${esc(v.name)}" ${voice && v.name === voice.name ? "selected" : ""}>${esc(v.name)} (${esc(v.lang)})${/premium|enhanced/i.test(v.name) ? " ★ natural" : ""}</option>`).join("")
      : `<option>No voices found</option>`;
  }

  function setupScreen(prefill = {}) {
    hideSessionControls();
    const voiceBlock = hasPack()
      ? `<p class="note">✅ Recorded voice pack: <b>${esc(AUDIO_PACK_INFO.voice || "recorded voice")}</b> (${Object.keys(RECORDED_AUDIO).length} instructions). Every participant hears the identical recording.</p>`
      : `<div class="field"><label for="voiceSel">Voice (no voice pack yet — see README “Voice”)</label><select id="voiceSel"></select></div>
         <div class="actions"><button class="cbtn alt" id="preview">▶ Preview voice</button></div>`;
    $app.innerHTML = consoleShell(`
      ${DEMO ? `<div class="banner panel span2">DEMO MODE — no microphone, data marked as demo. Remove “?demo=1” from the address for real sessions.</div>` : ""}
      <section class="panel">
        <h2><span class="num">1</span> Participant</h2>
        <p class="note">Study codes only — never names.</p>
        <div class="field"><label for="code">Study code</label>
          <input id="code" placeholder="P01" autocapitalize="characters" autocomplete="off" value="${esc(prefill.code || "")}"></div>
        <p class="note" style="margin-top:4px"><b>Staff fill these in</b> (ask the participant; never shown to them or sent to the AI).</p>
        <div class="demo-row">
          <div class="field"><label for="age">Age (years)</label>
            <input id="age" type="number" inputmode="numeric" min="18" max="110" placeholder="e.g., 72" value="${esc(prefill.age ?? "")}"></div>
          <div class="field"><label for="gender">Gender</label>
            <select id="gender">${["", "Female", "Male", "Other", "Prefer not to say"].map((g) =>
              `<option value="${g}" ${prefill.gender === g ? "selected" : ""}>${g || "Choose…"}</option>`).join("")}</select></div>
          <div class="field"><label for="edu">Years of school</label>
            <input id="edu" type="number" inputmode="numeric" min="0" max="30" placeholder="e.g., 12" value="${esc(prefill.educationYears ?? "")}"></div>
        </div>
        <p class="note">Years of school: 12 = finished high school, 16 = 4-year college degree. Needed for the MoCA-style +1 point (12 or fewer years) and the SLUMS cut-offs.</p>
        <div class="field"><label>Visit order <span style="font-weight:500;color:var(--muted)">(set automatically: odd = app first)</span></label>
          <div class="seg">
            <input type="radio" name="order" id="o1" value="app_first" checked><label for="o1">App → paper SLUMS</label>
            <input type="radio" name="order" id="o2" value="slums_first"><label for="o2">Paper SLUMS → app</label>
          </div>
          <p class="note" style="margin-top:8px">The SLUMS is always given <b>on paper</b> by staff. The app guides you through the visit in this order: test → 2–3 min break → other test. Alternating the order controls for practice and fatigue effects.</p></div>
      </section>
      <section class="panel">
        <h2><span class="num">2</span> Location &amp; staff</h2>
        <p class="note">Used as the answer key for the orientation questions.</p>
        <div class="field"><label for="place">Name of this place</label>
          <input id="place" placeholder="e.g., Oak Grove Senior Center" value="${esc(prefill.place || "")}"></div>
        <div class="field"><label for="city">City</label>
          <input id="city" placeholder="e.g., Alpharetta" value="${esc(prefill.city || "")}"></div>
        <div class="field"><label for="observer">Observer initials</label>
          <input id="observer" placeholder="e.g., AG" autocapitalize="characters" value="${esc(prefill.observer || "")}"></div>
      </section>
      <section class="panel">
        <h2><span class="num">3</span> Options</h2>
        <div class="toggle"><div>🔧 Researcher mode<small>Practice walkthrough with a toolbar. Data is marked as practice and never analyzed.</small></div>
          <label class="switch"><input type="checkbox" id="rmode" ${R.on ? "checked" : ""}><span></span></label></div>
        <div class="toggle ${R.on ? "" : "hidden"}" id="rmicRow"><div>Record with the microphone<small>Only for testing recording in researcher mode.</small></div>
          <label class="switch"><input type="checkbox" id="rmic" ${R.mic ? "checked" : ""}><span></span></label></div>
        <div class="toggle"><div>Larger text<small>For participants who find the text hard to read. Makes every participant screen about 30% bigger (this staff screen stays the same).</small></div>
          <label class="switch"><input type="checkbox" id="xl" ${store.get("hosa27.xl") === "1" ? "checked" : ""}><span></span></label></div>
        <div class="xl-preview" aria-hidden="true">Participant text preview: <b>What day of the week is it today?</b></div>
        ${voiceBlock}
      </section>
      <section class="panel">
        <h2><span class="num">4</span> Tools</h2>
        <p class="note">Check sound before every participant. Export data at the end of every day.</p>
        <div class="actions">
          <button class="cbtn alt" id="mictest">🔊 Test speaker + microphone</button>
          <button class="cbtn alt" id="sessions">🗂 Saved sessions &amp; export</button>
        </div>
        <p class="note" style="margin-top:14px">During the check: tap the faint <b>“staff”</b> label (bottom-left) whenever you help. Hold the <b>top-right corner</b> for 2 seconds for the staff menu.</p>
      </section>
      <section class="panel span2">
        <h2><span class="num">5</span> Before you hand over the iPad</h2>
        <div class="checklist" style="margin-top:12px">
          <label class="check"><input type="checkbox"> Volume turned up</label>
          <label class="check"><input type="checkbox"> Guided Access on</label>
          <label class="check"><input type="checkbox"> Quiet spot, good lighting</label>
          <label class="check"><input type="checkbox"> Glasses / hearing aids on (if used)</label>
          <label class="check required" style="grid-column:1/-1"><input type="checkbox" id="consent"> <span><b>Required:</b> consent collected — signed participant consent, or caregiver consent + participant agreement (assent) — including audio recording and AI processing</span></label>
        </div>
        <div class="err" id="err"></div>
        <button class="cbtn big" id="start">Start the check ▶</button>
      </section>`);
    fillVoiceSelect();

    const setOrder = (v) => { ($(v === "slums_first" ? "o2" : "o1")).checked = true; };
    if (prefill.order) setOrder(prefill.order);
    $("rmode").onchange = (e) => {
      R.on = e.target.checked; $("rmicRow").classList.toggle("hidden", !R.on);
      $("start").textContent = R.on ? "Start the PRACTICE check ▶" : "Start the check ▶";
      if (R.on) {
        if (!$("code").value) $("code").value = "R01";
        if (!$("place").value) $("place").value = "Practice Room";
        if (!$("city").value) $("city").value = "Practice City";
        $("consent").checked = true;
      }
    };
    $("rmic").onchange = (e) => (R.mic = e.target.checked);
    $("xl").onchange = (e) => { store.set("hosa27.xl", e.target.checked ? "1" : "0"); applyTextSize(); };
    const sel = $("voiceSel");
    if (sel) sel.onchange = () => { store.set(VOICE_KEY, sel.value); voice = englishVoices().find((v) => v.name === sel.value) || voice; };
    const pv = $("preview"); if (pv) pv.onclick = () => { stopSpeech(); speakText("Hello. This is how the instructions will sound. What day of the week is it today?"); };
    $("code").addEventListener("input", () => {
      const n = parseInt($("code").value.replace(/\D/g, ""), 10);
      if (!isNaN(n)) setOrder(n % 2 === 1 ? "app_first" : "slums_first");
    });
    $("mictest").onclick = micTest;
    $("sessions").onclick = sessionsScreen;
    $("start").onclick = startSession;
    if (R.on) $("start").textContent = "Start the PRACTICE check ▶";
    refreshUnexported(); checkResumable();
  }

  // Step 1: check the setup form, then show the review screen (nothing is saved yet).
  function startSession() {
    const v = (id) => $(id).value.trim();
    const err = $("err");
    const practice = DEMO || R.on;
    const c = v("code").toUpperCase() || (practice ? "R01" : "");
    if (!practice && !/^P\d{2,3}$/.test(c)) return (err.textContent = "Study code must look like P01.");
    if (!v("place") || !v("city")) return (err.textContent = "Enter the place name and city (needed to score orientation).");
    const age = v("age") === "" ? null : Number(v("age"));
    const edu = v("edu") === "" ? null : Number(v("edu"));
    const gender = $("gender").value;
    if (!practice) {
      if (age === null || !Number.isFinite(age)) return (err.textContent = "Enter the participant's age.");
      if (age < 60) return (err.textContent = "Participants must be 60 or older (see the eligibility checklist).");
      if (!gender) return (err.textContent = "Choose the participant's gender (or “Prefer not to say”).");
      if (edu === null || !Number.isFinite(edu) || edu < 0 || edu > 30) return (err.textContent = "Enter years of school (0–30; 12 = finished high school).");
    }
    if (!$("consent").checked) return (err.textContent = "Confirm consent first.");
    reviewScreen({ code: c, practice, order: document.querySelector('input[name="order"]:checked').value,
      place: v("place"), city: v("city"), observer: v("observer").toUpperCase(), age, gender, educationYears: edu });
  }

  // Step 2: review everything before the participant starts (catches typos, duplicate codes, wrong order, mic problems).
  async function reviewScreen(cfg) {
    hideSessionControls();
    const all = await DB.all();
    const dupes = all.filter((s) => !s.demo && s.code === cfg.code);
    const n = parseInt(cfg.code.replace(/\D/g, ""), 10);
    const expected = isNaN(n) ? cfg.order : (n % 2 === 1 ? "app_first" : "slums_first");
    const orderOverride = !cfg.practice && cfg.order !== expected;
    const orderName = (o) => (o === "app_first" ? "App → paper SLUMS" : "Paper SLUMS → app");
    const d = new Date();
    const needMic = !noMic();
    let micOk = !needMic, micSkipped = false, micResult = null;
    $app.innerHTML = consoleShell(`
      <section class="panel">
        <h2>✅ Check before you begin</h2>
        ${cfg.practice ? `<div class="banner" style="margin-top:10px">🔧 PRACTICE MODE — this session is marked as practice and will <b>not</b> be used in the results.</div>`
                       : `<div class="banner ok-banner" style="margin-top:10px">🟢 REAL SESSION — data will be used in the study.</div>`}
        <div class="kv" style="margin-top:14px">
          <div>Study code</div><div><b style="font-size:22px">${esc(cfg.code)}</b></div>
          <div>Age / gender / school</div><div>${esc(cfg.age ?? "—")} years · ${esc(cfg.gender || "—")} · ${esc(cfg.educationYears ?? "—")} years of school</div>
          <div>Visit order</div><div>${orderName(cfg.order)}${orderOverride ? ` <span class="status-pill warn">differs from odd/even rule</span>` : ""}</div>
          <div>Place / city</div><div>${esc(cfg.place)} / ${esc(cfg.city)}</div>
          <div>Observer</div><div>${esc(cfg.observer || "—")}</div>
          <div>iPad date &amp; time</div><div><b>${esc(d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}</b>, ${esc(d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}
            <br><span style="color:var(--muted)">Must be correct — it is the answer key for the date questions.</span></div>
        </div>
        ${dupes.length ? `<div class="banner" style="margin-top:14px">⚠️ Code <b>${esc(cfg.code)}</b> already has ${dupes.length} saved session(s) on this iPad (${dupes.map((x) => `${esc(x.localDate)} ${x.completed ? "complete" : "incomplete"}`).join(", ")}).
            Use a new code unless this is a deliberate re-test.
            <label class="check" style="margin-top:10px;background:#fff"><input type="checkbox" id="dupOk"> This is a deliberate re-test of the same person (keep both)</label></div>` : ""}
        ${orderOverride ? `<div class="banner" style="margin-top:14px">⚠️ By the odd/even rule ${esc(cfg.code)} should be <b>${orderName(expected)}</b>. Continue only if this is intentional — it will be logged.</div>` : ""}
      </section>
      <section class="panel">
        <h2>🎤 Microphone check ${needMic ? "" : `<span class="status-pill muted">not needed (no recording)</span>`}</h2>
        ${needMic ? `<p class="note">Ask the participant to say their favourite color (or say something yourself). Takes 3 seconds.</p>
        <div class="meter mic-meter" id="mm"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div id="micRes" class="note" style="font-weight:700">Not checked yet.</div>
        <div class="actions"><button class="cbtn" id="micGo">🎤 Run mic check</button><button class="cbtn alt" id="micSkip">Skip (not recommended)</button></div>` : ""}
      </section>
      <section class="panel span2">
        <div class="err" id="rerr"></div>
        <div class="actions">
          <button class="cbtn alt" id="edit">◀ Edit details</button>
          <button class="cbtn big" id="begin" style="flex:1">Everything is correct — begin ▶</button>
        </div>
      </section>`);
    const refresh = () => {
      const dupOk = !dupes.length || ($("dupOk") && $("dupOk").checked);
      $("begin").disabled = !(dupOk && (micOk || micSkipped));
    };
    refresh();
    if ($("dupOk")) $("dupOk").onchange = refresh;
    $("edit").onclick = () => setupScreen(cfg);
    if (needMic) {
      $("micGo").onclick = async () => {
        const btn = $("micGo"); btn.disabled = true; $("micRes").textContent = "Listening for 3 seconds…";
        audioCtx();
        try {
          const r = await startRecording({ force: true }); let max = 0; const bars = [...$("mm").children]; const t0 = now();
          while (now() - t0 < 3000) { const lv = r.level(); max = Math.max(max, lv); bars.forEach((b, i) => (b.style.height = `${10 + Math.round(lv * 46 * (0.6 + 0.4 * Math.sin(now() / 120 + i)))}px`)); await sleep(50); }
          await r.stop();
          micOk = max > 0.12; micResult = { passed: micOk, maxLevel: Math.round(max * 100) / 100, at: new Date().toISOString() };
          $("micRes").innerHTML = micOk ? `<span style="color:var(--ok)">✓ Microphone working</span>` : `<span style="color:var(--bad)">✗ No speech detected — check the microphone permission and try again.</span>`;
        } catch (e) { $("micRes").innerHTML = `<span style="color:var(--bad)">✗ Microphone not available: ${esc(e.message)}. Allow it in Settings › Safari › Microphone.</span>`; }
        btn.disabled = false; refresh();
      };
      $("micSkip").onclick = () => { micSkipped = true; $("micRes").textContent = "Mic check skipped (will be logged)."; refresh(); };
    }
    $("begin").onclick = async () => {
      const btn = $("begin"); if (btn.disabled) return; btn.disabled = true; // no double-start
      audioCtx(); // unlocks sound on iPad (must happen inside this tap)
      if (!hasPack() && window.speechSynthesis && !ttsBroken) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); }
      prefetchStep(STEPS[0]); prefetchStep(STEPS[1]);
      requestPersist();
      if (needMic) {
        try { (await getMic()).getTracks().forEach((t) => t.stop()); }
        catch (e) { btn.disabled = false; return ($("rerr").textContent = "Microphone permission is needed. Allow it in the Safari prompt (or Settings › Safari › Microphone)."); }
      }
      const t = new Date();
      session = {
        app: "hosa27", version: HOSA27_VERSION, demo: cfg.practice, researcher: R.on,
        sessionId: `${cfg.practice ? "DEMO-" : ""}${cfg.code}_${t.getTime()}`,
        code: cfg.code, order: cfg.order, place: cfg.place, city: cfg.city, observer: cfg.observer,
        age: cfg.age, gender: cfg.gender || null, educationYears: cfg.educationYears,
        startedAt: t.toISOString(), ...localDateInfo(t), userAgent: navigator.userAgent,
        largeText: store.get("hosa27.xl") === "1",
        voice: hasPack() ? { pack: AUDIO_PACK_INFO } : { builtIn: voice ? voice.name : null },
        micCheck: needMic ? (micResult || { passed: false, skipped: micSkipped }) : { notNeeded: true },
        retest: dupes.length > 0,
        steps: STEPS.map((s) => ({ id: s.id, type: s.type, domain: s.domain || null, max: s.max || 0, scoredBy: s.scoredBy || "none", key: s.key || null, prompt: s.text || "", countOnly: !!s.countOnly, practice: !!s.practice })),
        items: {}, helpEvents: [], pauses: [], corrections: [], completed: false,
      };
      if (orderOverride) logCorrection("order_override", null, `expected ${expected}`);
      if (micSkipped) logCorrection("mic_check_skipped", null, "");
      if (dupes.length) logCorrection("retest_same_code", null, `${dupes.length} earlier session(s)`);
      noVoiceStreak = 0;
      await saveSession();
      keepAwake();
      stepIndex = 0;
      // Paper SLUMS first -> staff screen for the SLUMS, then a break, then the app.
      if (cfg.order === "slums_first") slumsScreen("before");
      else startApp();
    };
  }

  // Hand the iPad to the participant and begin the app part of the visit.
  function startApp() {
    hideSessionControls();
    if (!R.on) { $help.classList.remove("hidden"); $corner.classList.remove("hidden"); }
    runStep();
  }

  // ---------------------------------------------------------------- guided visit: paper SLUMS + break (staff screens)
  function visitSteps(active) {
    const names = session.order === "slums_first" ? ["Paper SLUMS", "Break", "App"] : ["App", "Break", "Paper SLUMS"];
    return `<div class="visit-steps">${names.map((n, i) =>
      `<span class="vstep ${i < active ? "done" : i === active ? "now" : ""}">${i < active ? "✓" : `${i + 1}.`} ${n}</span>`).join('<span class="varrow">→</span>')}</div>`;
  }
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // phase "before" = SLUMS is the first test; "after" = SLUMS follows the app.
  function slumsScreen(phase) {
    hideSessionControls();
    const first = phase === "before";
    let t0 = null, tick = null;
    $app.innerHTML = consoleShell(`
      <section class="panel">
        ${visitSteps(first ? 0 : 2)}
        <h2 style="margin-top:14px">📝 Give the paper SLUMS now</h2>
        <p class="note">Participant <b>${esc(session.code)}</b>. The SLUMS is given on paper by staff — the app only times and records it.</p>
        <ol class="steps-list">
          <li>${first ? "Keep the iPad with you (screen down) until the SLUMS is finished." : "Take the iPad back from the participant and keep it screen down."}</li>
          <li>Write study code <b>${esc(session.code)}</b> on the SLUMS form — no name.</li>
          <li>Tap <b>Start SLUMS timer</b>, then read the official SLUMS instructions exactly as written.</li>
          <li>Score it on paper. Enter the total (and sub-scores) in <b>paper_scores.csv</b> later.</li>
        </ol>
        <div class="timer" id="stime">0:00</div>
        <div class="actions">
          <button class="cbtn" id="sStart">▶ Start SLUMS timer</button>
          <button class="cbtn" id="sDone" disabled>✓ SLUMS finished</button>
          <button class="cbtn alt" id="sSkip">Not completed (declined / stopped)</button>
        </div>
      </section>`, { single: true });
    $("sStart").onclick = () => {
      t0 = new Date(); $("sStart").disabled = true; $("sDone").disabled = false;
      tick = setInterval(() => ($("stime").textContent = mmss((Date.now() - t0) / 1000)), 500);
    };
    const record = async (status) => {
      clearInterval(tick);
      const end = new Date();
      session.slums = { status, position: first ? "first" : "second", startedAt: t0 ? t0.toISOString() : null,
        endedAt: end.toISOString(), minutes: t0 ? Math.round(((end - t0) / 60000) * 10) / 10 : null };
      await saveSession();
      if (first) breakScreen(1, startApp); else finishSession();
    };
    $("sDone").onclick = () => record("completed");
    $("sSkip").onclick = () => confirmPanel("SLUMS not completed?", "Record that the SLUMS was not completed for this participant (for example, they declined or needed to stop).", "Record as not completed", () => record("not_completed"));
  }

  // 2-3 minute break between the two tests (staff screen).
  function breakScreen(active, then) {
    hideSessionControls();
    const nextIsApp = session.order === "slums_first";
    const t0 = Date.now(); const target = 150;
    $app.innerHTML = consoleShell(`
      <section class="panel">
        ${visitSteps(active)}
        <h2 style="margin-top:14px">☕ Short break (2–3 minutes)</h2>
        <p class="note">Offer water, chat, let the participant rest. Breaks reduce fatigue between the two tests.</p>
        <div class="timer" id="btime">0:00</div>
        <p class="note" id="bnote">Suggested: about 2½ minutes.</p>
        <div class="actions">
          <button class="cbtn big" id="bNext">${nextIsApp ? "Start the app ▶ (hand the iPad to the participant)" : "Continue to the paper SLUMS ▶"}</button>
        </div>
      </section>`, { single: true });
    const tick = setInterval(() => {
      const s = (Date.now() - t0) / 1000; const el = $("btime"); if (!el) return clearInterval(tick);
      el.textContent = mmss(s); if (s >= target) $("bnote").textContent = "✓ Break time reached — continue when the participant is ready.";
    }, 500);
    $("bNext").onclick = async () => {
      audioCtx(); // keep sound unlocked (inside the tap)
      clearInterval(tick);
      session.breakMinutes = Math.round(((Date.now() - t0) / 60000) * 10) / 10; await saveSession();
      then();
    };
  }

  async function refreshUnexported() {
    try {
      const all = await DB.all();
      unexported = all.filter((x) => !x.demo && !x.exportedAt).length;
      const el = $("unexp");
      if (el) { el.className = `pill ${unexported ? "warn" : "good"}`; el.textContent = unexported ? `${unexported} session(s) not exported` : "All sessions exported ✓"; }
    } catch (_) {}
  }

  // If the app was closed, reloaded or crashed mid-visit, offer to continue where it stopped.
  async function checkResumable() {
    let all = []; try { all = await DB.all(); } catch (_) { return; }
    const recent = (x) => Date.now() - new Date(x.startedAt) < 4 * 3600e3;
    const cand = all.filter((x) => !x.demo && recent(x) && ((!x.completed && !x.endedEarlyAt) || (x.completed && x.order === "app_first" && !x.slums)))
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
    if (!cand || !$("code")) return;
    const panel = document.createElement("section");
    if (DEMO) { // never continue a REAL participant in demo mode (no microphone) - it would save silent answers
      panel.className = "panel span2 resume-panel";
      panel.innerHTML = `<h2>⏯ Unfinished real visit: ${esc(cand.code)}</h2><p class="note">Open the app <b>without “?demo=1”</b> to continue it (demo mode has no microphone).</p>`;
      document.querySelector(".cbody").prepend(panel); return;
    }
    panel.className = "panel span2 resume-panel";
    panel.innerHTML = `<h2>⏯ Unfinished visit found</h2>
      <p class="note"><b>${esc(cand.code)}</b> started at ${esc(new Date(cand.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))} and stopped
        ${cand.completed ? "after the app, before the paper SLUMS" : `after ${Object.keys(cand.items).length} saved items`} (the app was closed, reloaded or crashed).
        Continue where it stopped? Everything already saved is kept, and the interrupted question restarts from the beginning (logged).</p>
      <div class="actions"><button class="cbtn" id="resumeGo">⏯ Continue ${esc(cand.code)}</button><button class="cbtn alt" id="resumeNo">Not now</button></div>`;
    document.querySelector(".cbody").prepend(panel);
    $("resumeNo").onclick = () => panel.remove();
    $("resumeGo").onclick = () => { audioCtx(); requestPersist(); resumeSession(cand); };
  }
  async function resumeSession(s) {
    session = s; noVoiceStreak = 0;
    logCorrection("resume", null, "app reopened mid-visit");
    keepAwake();
    if (s.completed) { await saveSession(); return continueVisit(); }           // app done; SLUMS still to do
    if (s.order === "slums_first" && !s.slums) { await saveSession(); return slumsScreen("before"); }
    let idx = STEPS.findIndex((st, i) => i > 0 && st.type !== "end" && !s.items[st.id]);
    if (idx < 0) idx = STEPS.length - 1;
    flagNext(STEPS[idx].id, "restarted after the app was reopened");
    stepIndex = idx; await saveSession();
    startApp();
  }

  function hideSessionControls() {
    $help.classList.add("hidden"); $corner.classList.add("hidden"); $rbar.classList.add("hidden"); $overlay.classList.add("hidden");
  }

  async function micTest() {
    toast("Playing a test sentence…", 2600);
    audioCtx();
    const w = RECORDED_AUDIO.welcome;
    if (w) await playFile(w.parts ? w.parts[0].src : (w.src || w));
    else await speakText("This is a sound check. If you can hear me clearly, the volume is good.");
    try {
      await chime(true);
      toast("Recording 3 seconds — say something", 3200);
      const r = await startRecording({ force: true }); await sleep(3000); const out = await r.stop();
      toast("Playing your recording back…", 3000);
      await playFile(URL.createObjectURL(out.blob));
      toast(`Microphone OK (${out.mime || "audio"})`);
    } catch (e) { toast("Microphone not available: " + e.message, 4000); }
  }

  async function sessionsScreen() {
    hideSessionControls();
    const all = (await DB.all()).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    let est = "";
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); est = `${(e.usage / 1e6).toFixed(1)} MB used`; } } catch (_) {}
    const real = all.filter((s) => !s.demo).length;
    $app.innerHTML = consoleShell(`
      <section class="panel">
        <h2>🗂 Saved sessions</h2>
        <p class="note">${all.length} on this device (${real} real, ${all.length - real} practice/demo)${est ? " · " + est : ""}.
          Export sends one file per participant — AirDrop it to the Mac and put it in <b>hosa27/data/raw/</b>. Practice/demo sessions are ignored by the scoring tools.</p>
        <p class="note">⚠️ Data lives in this browser's storage on this device. Clearing Safari website data or deleting the app icon can erase it — <b>export at the end of every testing day.</b></p>
        <div class="actions">
          <button class="cbtn" id="exportAll" ${all.length ? "" : "disabled"}>Export all (${all.length})</button>
          <button class="cbtn alt" id="csvAll" ${all.length ? "" : "disabled"}>Summary spreadsheet (CSV)</button>
          <button class="cbtn alt" id="back">◀ Back to setup</button>
        </div>
      </section>
      <section class="panel">
        ${all.length ? all.map((s) => `
          <div class="scard">
            <div class="code">${esc(s.code)}</div>
            <div class="info"><b>${esc(s.localDate)}</b> · ${Object.keys(s.items || {}).length} items · ${s.order === "app_first" ? "app first" : "SLUMS first"}<br>
              ${s.completed ? `<span class="status-pill ok">Complete</span>` : `<span class="status-pill warn">Incomplete</span>`}
              ${s.researcher ? `<span class="status-pill muted">Practice</span>` : s.demo ? `<span class="status-pill muted">Demo</span>` : ""}
              ${!s.demo ? (s.exportedAt ? `<span class="status-pill ok">Exported</span>` : `<span class="status-pill warn">Not exported</span>`) : ""}
              ${(s.corrections || []).length ? `<span class="status-pill muted">${s.corrections.length} correction(s)</span>` : ""}</div>
            <button class="cbtn" data-view="${esc(s.sessionId)}">View</button>
            <button class="cbtn alt" data-exp="${esc(s.sessionId)}">Export</button>
            <button class="cbtn danger" data-del="${esc(s.sessionId)}">Delete</button>
          </div>`).join("") : `<p class="note">No sessions yet.</p>`}
      </section>`, { single: true });
    $("back").onclick = () => setupScreen();
    $("exportAll").onclick = () => exportSessions(all);
    $("csvAll").onclick = () => exportSummaryCSV(all);
    $app.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => sessionDetail(all.find((s) => s.sessionId === b.dataset.view))));
    $app.querySelectorAll("[data-exp]").forEach((b) => (b.onclick = () => exportSessions(all.filter((s) => s.sessionId === b.dataset.exp))));
    $app.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
      const x = all.find((y) => y.sessionId === b.dataset.del);
      const go = async () => { await DB.del(x.sessionId); await refreshUnexported(); sessionsScreen(); };
      if (x.demo) return confirmPanel("Delete this practice session?", "This removes it from this iPad.", "Delete", go);
      typedConfirm(`Delete real session ${x.code}?`,
        `This permanently removes ${x.code} (${x.localDate}) from this iPad${x.exportedAt ? "" : " — it has NOT been exported yet"}. Type the study code to confirm.`, x.code, go);
    }));
  }
  function typedConfirm(title, body, word, onOk) {
    $overlay.innerHTML = `<div class="panel"><h2>${esc(title)}</h2><p>${esc(body)}</p>
      <div class="field"><input id="tc" placeholder="${esc(word)}" autocapitalize="characters" autocomplete="off"></div>
      <div class="actions"><button class="cbtn danger" id="ok" disabled>Delete permanently</button><button class="cbtn alt" id="cancel">Cancel</button></div></div>`;
    $overlay.classList.remove("hidden");
    $("tc").oninput = () => ($("ok").disabled = $("tc").value.trim().toUpperCase() !== word);
    $("cancel").onclick = () => $overlay.classList.add("hidden");
    $("ok").onclick = async () => { $overlay.classList.add("hidden"); await onOk(); };
  }

  function slumsText(s) {
    const x = s && s.slums;
    if (!x) return "not recorded";
    return `${x.status === "completed" ? "completed" : "not completed"} (${x.position === "first" ? "given first" : "given second"}${x.minutes != null ? `, ${x.minutes} min` : ""})`;
  }

  // One-line description of what was saved for an item (no media).
  function itemSummary(it) {
    const b = [];
    if (it.skipped) return `SKIPPED (${it.skipReason || "no reason"}) — counted as missing`;
    if (it.attempt > 1) b.push(`attempt ${it.attempt}`);
    if (it.recordMs !== undefined) b.push(`${it.audio ? "recording" : "no audio"} ${(it.recordMs / 1000).toFixed(1)} s`);
    if (it.stopReason) b.push(`ended: ${it.stopReason.replace("_", " ")}`);
    if (it.image) b.push(`drawing (${it.strokes ?? "?"} strokes, ${it.clears ?? 0} clears)`);
    if (it.appScore !== undefined && it.appScore !== null) b.push(`auto score ${it.appScore}/${it.max}`);
    if (it.completed !== undefined) b.push(it.completed ? "completed" : "not completed");
    if (it.errors !== undefined) b.push(`errors ${it.errors}`);
    if (it.hits !== undefined) b.push(`hits ${it.hits}, misses ${it.misses}, false taps ${it.falseAlarms}`);
    if (it.durationMs) b.push(`${(it.durationMs / 1000).toFixed(1)} s`);
    if (it.latencyMs != null) b.push(`started answering after ${(it.latencyMs / 1000).toFixed(1)} s`);
    if (it.rtMs != null) b.push(`${it.correct ? "correct" : "wrong"} in ${(it.rtMs / 1000).toFixed(1)} s`);
    if (it.meanHitRtMs != null) b.push(`mean reaction ${it.meanHitRtMs} ms`);
    if (it.replays) b.push(`replayed ${it.replays}×`);
    if (it.voiceDetected === false) b.push("no speech detected");
    if (it.error) b.push(`⚠️ ${it.error}`);
    if (it.flags && it.flags.length) b.push(`flags: ${it.flags.join("; ")}`);
    return b.join(" · ");
  }

  // Full view of one session: every step, playable recordings, drawings, automatic scores, help log.
  function sessionDetail(s) {
    if (!s) return sessionsScreen();
    const helpBy = {}; (s.helpEvents || []).forEach((h) => (helpBy[h.step] = (helpBy[h.step] || 0) + 1));
    const pauseBy = {}; (s.pauses || []).forEach((p) => (pauseBy[p.step] = (pauseBy[p.step] || 0) + 1));
    const rows = (s.steps || STEPS).map((st) => {
      const it = (s.items || {})[st.id];
      if (st.type === "intro" || st.type === "end") return "";
      const media = !it ? "" : it.audio ? `<audio controls preload="none" src="${it.audio}" style="width:100%;max-width:320px"></audio>`
        : it.image ? `<img src="${it.image}" alt="drawing" style="width:180px;border:1px solid var(--line);border-radius:10px">` : "";
      return `<tr><td><b>${esc(st.id)}</b><br><span style="color:var(--muted)">${esc(st.domain || "")}${st.max ? ` · ${st.max} pt` : ""}</span></td>
        <td>${it ? esc(itemSummary(it)) || "saved" : `<span class="status-pill warn">not done</span>`}
        ${helpBy[st.id] ? `<br>🙋 staff helped ×${helpBy[st.id]}` : ""}${pauseBy[st.id] ? `<br>⏸ paused ×${pauseBy[st.id]}` : ""}
        ${media ? `<div style="margin-top:8px">${media}</div>` : ""}</td></tr>`;
    }).join("");
    const done = Object.keys(s.items || {}).length;
    const auto = Object.values(s.items || {}).filter((i) => typeof i.appScore === "number");
    $app.innerHTML = consoleShell(`
      <section class="panel">
        <h2>${esc(s.code)} ${s.completed ? `<span class="status-pill ok">Complete</span>` : `<span class="status-pill warn">Incomplete</span>`}
          ${s.researcher ? `<span class="status-pill muted">Practice</span>` : s.demo ? `<span class="status-pill muted">Demo</span>` : ""}</h2>
        <div class="kv" style="margin-top:12px">
          <div>Date</div><div>${esc(s.localDate)} (${esc(s.weekday)}) · started ${esc(new Date(s.startedAt).toLocaleTimeString())}</div>
          <div>Status</div><div>${s.completed ? "complete" : `incomplete${s.endedEarlyAt ? " — ended at " + esc(s.endedEarlyAt) : ""}`} · ${done} items saved</div>
          <div>Age / gender / school</div><div>${esc(s.age ?? "—")} years · ${esc(s.gender || "—")} · ${esc(s.educationYears ?? "—")} years of school</div>
          <div>Test order</div><div>${s.order === "app_first" ? "App first, then SLUMS" : "SLUMS first, then app"}</div>
          <div>Place / city</div><div>${esc(s.place)} / ${esc(s.city)}</div>
          <div>Observer</div><div>${esc(s.observer || "—")}</div>
          <div>Staff help / pauses</div><div>${(s.helpEvents || []).length} / ${(s.pauses || []).length}</div>
          <div>Paper SLUMS</div><div>${slumsText(s)}${s.breakMinutes != null ? ` · break ${s.breakMinutes} min` : ""}</div>
          <div>Automatic scores</div><div>${auto.map((i) => `${esc(i.id)} ${i.appScore}/${i.max}`).join(", ") || "—"} <span style="color:var(--muted)">(spoken items + box drawing are scored later on the Mac)</span></div>
          <div>Mic check</div><div>${s.micCheck ? (s.micCheck.notNeeded ? "not needed" : s.micCheck.passed ? "passed ✓" : s.micCheck.skipped ? "skipped ⚠️" : "failed ⚠️") : "—"}</div>
          <div>Exported</div><div>${s.exportedAt ? esc(new Date(s.exportedAt).toLocaleString()) : "not yet"}</div>
          <div>App version</div><div>${esc(s.version)}${s.largeText ? " · larger text" : ""}${s.retest ? " · re-test of an existing code" : ""}</div>
        </div>
        ${(s.corrections || []).length ? `<h2 style="margin-top:18px;font-size:18px">Corrections log</h2><table class="list">${s.corrections.map((c) =>
          `<tr><td>${esc(new Date(c.at).toLocaleTimeString())}</td><td><b>${esc(c.type)}</b>${c.step ? " · " + esc(c.step) : ""}${c.from ? ` (from ${esc(c.from)})` : ""}</td><td>${esc(c.reason)}</td></tr>`).join("")}</table>` : ""}
        <div class="actions"><button class="cbtn" id="expOne">Export this session</button><button class="cbtn alt" id="backList">◀ Back to list</button></div>
      </section>
      <section class="panel"><h2>Every step</h2><table class="list">${rows}</table></section>`, { single: true });
    $("expOne").onclick = () => exportSessions([s]);
    $("backList").onclick = sessionsScreen;
    window.scrollTo(0, 0);
  }

  // One "reaction time" per item, measured from when the participant could start answering (after START):
  // spoken = START/chime -> first speech; shapes = choices shown -> tap; trail = START -> first circle;
  // drawing = START -> first line; letters = mean time from each A appearing -> tap.
  function reactionMs(st, it) {
    if (!it || it.skipped) return null;
    if (st.type === "speak") return it.latencyMs ?? null;
    if (st.type === "rotate") return it.rtMs ?? null;
    if (st.type === "trail") return it.firstTapMs ?? null;
    if (st.type === "draw") return it.firstStrokeMs ?? null;
    if (st.type === "vigilance") return it.meanHitRtMs ?? null;
    return null;
  }
  // Spreadsheet of everything except the media: one row per participant x step.
  function exportSummaryCSV(list) {
    const cols = ["code", "practice", "date", "age", "gender", "education_years", "order", "completed", "ended_early_at", "observer", "help_events_total", "pauses_total",
      "slums_status", "slums_position", "slums_minutes", "break_minutes", "corrections_total", "mic_check",
      "step_id", "domain", "max_points", "saved", "auto_score", "recording_seconds", "has_audio", "has_drawing",
      "duration_seconds", "errors", "hits", "misses", "false_taps", "replays", "stop_reason", "staff_help_on_step",
      "attempt", "skipped", "voice_detected", "flags",
      "reaction_time_seconds", "start_tap_seconds", "instruction_seconds",
      "latency_seconds", "speech_end_seconds", "response_seconds", "total_seconds", "rt_seconds", "correct", "mean_hit_rt_ms"];
    const q = (v) => { const t = v === undefined || v === null ? "" : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const sec = (ms) => (ms === undefined || ms === null ? "" : (ms / 1000).toFixed(2));
    const lines = [cols.join(",")];
    for (const s of list) {
      for (const st of s.steps || []) {
        if (st.type === "intro" || st.type === "end") continue;
        const it = (s.items || {})[st.id] || {};
        const help = (s.helpEvents || []).filter((h) => h.step === st.id).length;
        lines.push([s.code, s.demo ? "yes" : "no", s.localDate, s.age ?? "", s.gender ?? "", s.educationYears ?? "", s.order, s.completed, s.endedEarlyAt || "", s.observer,
          (s.helpEvents || []).length, (s.pauses || []).length,
          s.slums ? s.slums.status : "", s.slums ? s.slums.position : "", s.slums ? s.slums.minutes ?? "" : "", s.breakMinutes ?? "",
          (s.corrections || []).length, s.micCheck ? (s.micCheck.notNeeded ? "not_needed" : s.micCheck.passed ? "passed" : s.micCheck.skipped ? "skipped" : "failed") : "", st.id, st.domain, st.max, it.id ? "yes" : "no", it.appScore ?? "",
          it.recordMs !== undefined ? (it.recordMs / 1000).toFixed(1) : "", it.audio ? "yes" : "no", it.image ? "yes" : "no",
          it.durationMs ? (it.durationMs / 1000).toFixed(1) : "", it.errors ?? "", it.hits ?? "", it.misses ?? "",
          it.falseAlarms ?? "", it.replays ?? "", it.stopReason ?? "", help,
          it.attempt ?? "", it.skipped ? "yes" : "", it.voiceDetected === undefined ? "" : it.voiceDetected ? "yes" : "no", (it.flags || []).join("; "),
          sec(reactionMs(st, it)), sec(it.startTapMs), sec(it.instructionMs),
          sec(it.latencyMs), sec(it.speechEndMs), sec(it.responseMs ?? it.drawMs), sec(it.totalMs), sec(it.rtMs),
          it.correct === undefined ? "" : it.correct ? "yes" : "no", it.meanHitRtMs ?? ""].map(q).join(","));
      }
    }
    const file = new File([lines.join("\n")], `hosa27_summary_${localDateInfo().localDate}.csv`, { type: "text/csv" });
    shareOrDownload([file]);
  }

  async function shareOrDownload(files) { // returns true if the files were shared/saved
    try {
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title: "hosa27 data" }); return true; }
    } catch (e) { if (e.name === "AbortError") return false; }
    for (const f of files) {
      const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove(); await sleep(400);
    }
    return true;
  }
  function fileFor(s) {
    const name = `hosa27_${s.code}_${s.localDate}_${s.sessionId.split("_").pop()}.json`;
    return new File([JSON.stringify(s)], name, { type: "application/json" });
  }
  async function exportSessions(list) {
    if (!list.length) return;
    if (await shareOrDownload(list.map(fileFor))) {
      const at = new Date().toISOString();
      for (const x of list) { x.exportedAt = at; await DB.put(x); }
      toast(`Exported ${list.length} session(s) ✓`); await refreshUnexported();
      if ($("exportAll")) sessionsScreen();
    }
  }

  function confirmPanel(title, body, okLabel, onOk) {
    $overlay.innerHTML = `<div class="panel"><h2>${esc(title)}</h2><p>${esc(body)}</p>
      <div class="actions"><button class="cbtn danger" id="ok">${esc(okLabel)}</button><button class="cbtn alt" id="cancel">Cancel</button></div></div>`;
    $overlay.classList.remove("hidden");
    $("cancel").onclick = () => $overlay.classList.add("hidden");
    $("ok").onclick = async () => { $overlay.classList.add("hidden"); await onOk(); };
  }

  // staff: log help
  // (press and hold ~0.7 s so a participant can't log help by accident)
  let helpTimer = null;
  $help.addEventListener("pointerdown", () => {
    helpTimer = setTimeout(async () => {
      if (!session) return;
      session.helpEvents.push({ step: STEPS[stepIndex]?.id, at: new Date().toISOString() });
      await saveSession(); toast("Help noted");
    }, 700);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => $help.addEventListener(ev, () => clearTimeout(helpTimer)));
  // staff: hold top-right corner 2 s to pause / end
  let holdTimer = null;
  $corner.addEventListener("pointerdown", () => { holdTimer = setTimeout(staffMenu, 2000); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => $corner.addEventListener(ev, () => clearTimeout(holdTimer)));
  function staffMenu() {
    if (!session) return;
    if (STEPS[stepIndex]?.type === "end") { stopSpeech(); afterApp(); return; } // app finished: next part of the visit
    const step = STEPS[stepIndex];
    const scored = STEPS.filter((s) => s.type !== "intro" && s.type !== "end");
    const pos = scored.findIndex((s) => s.id === step.id);
    const mins = Math.round((Date.now() - new Date(session.startedAt)) / 6000) / 10;
    $overlay.innerHTML = `<div class="panel"><h2>Staff menu</h2>
      <p>Participant <b>${esc(session.code)}</b> · ${pos >= 0 ? `Question ${pos + 1} of ${scored.length} (<b>${esc(step.id)}</b>)` : esc(step.id)} · ${mins} min</p>
      <p class="note">Corrections never delete anything: the earlier attempt is kept and the change is logged with your reason.</p>
      <div class="menu-grid">
        <button class="cbtn" id="resume">▶ Resume</button>
        <button class="cbtn alt" id="mBack" ${stepIndex <= 1 ? "disabled" : ""}>◀ Previous question</button>
        <button class="cbtn alt" id="mRedo">↺ Redo this question</button>
        <button class="cbtn alt" id="mSkip">Skip this question ▶</button>
        <button class="cbtn danger" id="endNow">End session &amp; save</button>
      </div></div>`;
    $overlay.classList.remove("hidden");
    $("resume").onclick = () => $overlay.classList.add("hidden");
    $("mRedo").onclick = () => reasonPanel("Redo this question?", step, (reason) => {
      abortStep && abortStep(); stopSpeech(); logCorrection("redo", step.id, reason); flagNext(step.id, `redone: ${reason}`); runStep();
    });
    $("mBack").onclick = () => {
      const prevIdx = Math.max(1, stepIndex - 1); const prev = STEPS[prevIdx];
      reasonPanel(`Go back to the previous question (${prev.id})?`, prev, (reason) => {
        abortStep && abortStep(); stopSpeech(); logCorrection("back", prev.id, reason, { from: step.id }); flagNext(prev.id, `redone after going back: ${reason}`);
        stepIndex = prevIdx; runStep();
      });
    };
    $("mSkip").onclick = () => reasonPanel("Skip this question?", null, async (reason) => {
      abortStep && abortStep(); stopSpeech(); logCorrection("skip", step.id, reason);
      if (step.max || step.type === "speak" || step.type === "draw") {
        const it = itemBase(step); it.skipped = true; it.skipReason = reason; await storeItem(it); // scored as MISSING, not as 0
      }
      next();
    }, "Skipped questions are treated as missing data (not as a wrong answer).");
    $("endNow").onclick = () => { $overlay.classList.add("hidden"); endEarly(); };
  }

  // Ask why a correction is being made (stored in the data), with a warning for memory-sensitive items.
  function reasonPanel(title, step, onOk, extraNote = "") {
    const warn = step && isMemorySensitive(step)
      ? `<div class="banner" style="margin:10px 0">⚠️ <b>${esc(step.id)}</b> involves remembering words or numbers. Repeating it gives extra exposure, which can raise later memory scores. It will be flagged in the data so it can be considered in the analysis.</div>` : "";
    $overlay.innerHTML = `<div class="panel"><h2>${esc(title)}</h2>${warn}
      ${extraNote ? `<p class="note">${esc(extraNote)}</p>` : ""}
      <div class="field"><label for="why">Reason (saved with the data)</label>
        <select id="why">
          <option>Participant didn't hear / was interrupted</option>
          <option>Staff mistake</option>
          <option>Technical problem (sound, mic, screen)</option>
          <option>Participant asked to repeat or skip</option>
          <option>Participant distressed or tired</option>
          <option>Other</option>
        </select></div>
      <div class="actions"><button class="cbtn" id="rOk">Confirm</button><button class="cbtn alt" id="rCancel">Cancel</button></div></div>`;
    $overlay.classList.remove("hidden");
    $("rCancel").onclick = () => $overlay.classList.add("hidden");
    $("rOk").onclick = async () => { const r = $("why").value; $overlay.classList.add("hidden"); await onOk(r); saveSession(); };
  }

  async function endEarly() {
    abortStep && abortStep(); stopSpeech();
    if (STEPS[stepIndex]?.type !== "end") { session.endedEarlyAt = STEPS[stepIndex]?.id; session.completed = false; }
    await saveSession(); afterApp();
  }
  // After the app part: quality check (real sessions), then App-first visits continue to a break + paper SLUMS.
  function afterApp() {
    if (!R.on) return qualityCheck();
    continueVisit();
  }
  function continueVisit() {
    if (session.order === "app_first" && !session.slums) breakScreen(1, () => slumsScreen("after"));
    else finishSession();
  }

  // Lists anything worth a second look before the participant leaves; each can be redone (logged).
  function qualityIssues(s) {
    const out = [];
    for (const st of STEPS) {
      if (st.type === "intro" || st.type === "end" || st.practice) continue;
      const it = s.items[st.id];
      if (!it) { out.push({ st, why: "not done" }); continue; }
      if (it.skipped) { out.push({ st, why: `skipped (${it.skipReason})` }); continue; }
      if (it.error) out.push({ st, why: `error: ${it.error}` });
      if (st.type === "speak" && it.audio === null && !s.demo) out.push({ st, why: "no recording saved" });
      if (st.type === "speak" && it.voiceDetected === false && !s.demo) out.push({ st, why: "no speech detected (silent answer or mic problem)" });
      if (st.type === "speak" && it.stopReason === "done_button" && it.recordMs < 1800) out.push({ st, why: `very short answer (${(it.recordMs / 1000).toFixed(1)} s) — “I'm done” may have been tapped too early` });
      if (st.type === "trail" && !it.completed) out.push({ st, why: "connect-the-dots not finished in time" });
      if (st.type === "draw" && (it.strokes || 0) < 3) out.push({ st, why: "very little drawing" });
      if (st.type === "rotate" && it.stopReason === "time_limit") out.push({ st, why: "no answer tapped in time" });
    }
    return out;
  }
  function qualityCheck() {
    hideSessionControls();
    const issues = qualityIssues(session);
    const corr = session.corrections || [];
    session.qualityCheck = { at: new Date().toISOString(), issues: issues.map((x) => ({ step: x.st.id, why: x.why })) };
    saveSession();
    $app.innerHTML = consoleShell(`
      <section class="panel">
        <h2>🔍 Quality check — before you finish</h2>
        <p class="note">Take the iPad back from the participant. Review anything flagged below. Redo only if something went wrong (not because an answer seemed incorrect) — every redo is logged and the first attempt is kept.</p>
        ${issues.length ? `<table class="list">${issues.map((x, i) => `<tr><td><b>${esc(x.st.id)}</b><br><span style="color:var(--muted)">${esc(x.st.domain || "")}</span></td>
            <td>${esc(x.why)}${isMemorySensitive(x.st) ? `<br><span class="status-pill warn">memory item — redo adds exposure</span>` : ""}</td>
            <td><button class="cbtn alt" data-redo="${i}">↺ Redo</button></td></tr>`).join("")}</table>`
          : `<div class="banner ok-banner">✓ No problems detected — every question has a saved answer.</div>`}
        <div class="kv" style="margin-top:14px">
          <div>Corrections so far</div><div>${corr.length ? corr.map((c) => `${esc(c.type)}${c.step ? " " + esc(c.step) : ""}`).join(", ") : "none"}</div>
          <div>Staff help / pauses</div><div>${(session.helpEvents || []).length} / ${(session.pauses || []).length}</div>
        </div>
        <div class="actions"><button class="cbtn big" id="qcOk">Looks good — continue ▶</button></div>
      </section>`, { single: true });
    $app.querySelectorAll("[data-redo]").forEach((b) => (b.onclick = () => {
      const st = issues[Number(b.dataset.redo)].st;
      reasonPanel(`Redo ${st.id}?`, st, (reason) => {
        logCorrection("redo_from_quality_check", st.id, reason); flagNext(st.id, `redone at quality check: ${reason}`);
        redoReturn = true; stepIndex = STEPS.indexOf(st); startApp();
      });
    }));
    $("qcOk").onclick = () => continueVisit();
  }

  // ---------------------------------------------------------------- researcher toolbar
  function renderToolbar() {
    if (!R.on || !session) { $rbar.classList.add("hidden"); return; }
    $rbar.classList.remove("hidden");
    $rbar.innerHTML = `
      <span class="rtag">🔧 RESEARCHER</span>
      <button data-r="prev">◀ Back</button>
      <select id="rjump" aria-label="Jump to step">${STEPS.map((s, i) =>
        `<option value="${i}" ${i === stepIndex ? "selected" : ""}>${i}. ${esc(s.id)}${s.max ? ` (${s.max} pt)` : ""}</option>`).join("")}</select>
      <button data-r="next">Skip ▶</button>
      <button data-r="voice">🔊 Voice: ${R.voice}</button>
      <button data-r="short">⏱ Timers: ${R.short ? "short" : "real"}</button>
      <button data-r="data">📋 Saved data</button>
      <button data-r="exit">✕ Exit</button>`;
    const go = (i) => { abortStep && abortStep(); stopSpeech(); $overlay.classList.add("hidden"); stepIndex = Math.max(0, Math.min(STEPS.length - 1, i)); runStep(); };
    $rbar.querySelector('[data-r="prev"]').onclick = () => go(stepIndex - 1);
    $rbar.querySelector('[data-r="next"]').onclick = () => go(stepIndex + 1);
    $rbar.querySelector("#rjump").onchange = (e) => go(Number(e.target.value));
    $rbar.querySelector('[data-r="voice"]').onclick = () => {
      R.voice = { normal: "fast", fast: "mute", mute: "normal" }[R.voice];
      if (R.voice === "mute") stopSpeech();
      renderToolbar(); toast(`Voice: ${R.voice}`);
    };
    $rbar.querySelector('[data-r="short"]').onclick = () => { R.short = !R.short; renderToolbar(); toast(`Timers: ${R.short ? "short (applies from next step)" : "real"}`); };
    $rbar.querySelector('[data-r="data"]').onclick = showStepData;
    $rbar.querySelector('[data-r="exit"]').onclick = async () => { // researcher: leave immediately
      abortStep && abortStep(); stopSpeech();
      if (STEPS[stepIndex]?.type !== "end") { session.endedEarlyAt = STEPS[stepIndex]?.id; session.completed = false; }
      await saveSession(); finishSession();
    };
  }
  function showStepData() {
    const shown = STEPS.map((s) => {
      const it = session.items[s.id]; if (!it) return null;
      return `<tr><td><b>${esc(s.id)}</b></td><td>${esc(itemSummary(it) || "saved")}</td></tr>`;
    }).filter(Boolean).join("");
    $overlay.innerHTML = `<div class="panel" style="width:min(100%,720px)"><h2>Saved in this session</h2>
      <table class="list">${shown || "<tr><td>Nothing saved yet</td></tr>"}</table>
      <div class="actions"><button class="cbtn" id="closeData">Close</button></div></div>`;
    $overlay.classList.remove("hidden");
    $("closeData").onclick = () => $overlay.classList.add("hidden");
  }

  // =====================================================================
  // PARTICIPANT SCREENS
  // =====================================================================
  function shell(inner, { pause = true, progress = true, howto = true } = {}) {
    const step = STEPS[stepIndex];
    const how = howto ? howToFor(step) : null;
    const scored = STEPS.filter((s) => s.type !== "intro" && s.type !== "end");
    const pos = scored.findIndex((s) => s.id === step.id);
    const pct = step.type === "end" ? 100 : pos < 0 ? 0 : Math.round((pos / scored.length) * 100);
    return `<div class="pshell">
      <header class="pbar">
        <div class="brand">${ICON.logo}<span>${esc(STUDY.appName)}</span></div>
        <div class="pprog">${progress ? `<div class="pprog-track"><div class="pprog-fill" style="width:${pct}%"></div></div>
          <div class="pprog-label">${pos >= 0 ? `Question ${pos + 1} of ${scored.length}` : step.type === "end" ? "Finished" : ""}</div>` : ""}</div>
        ${pause && pos >= 0 ? `<button class="pause-btn" id="pauseBtn" aria-label="Pause">${ICON.pause}<span>Pause</span></button>` : `<span></span>`}
      </header>
      <main class="stage ${how ? "with-howto" : ""}">${how ? howToPanel(step, how) : ""}<div class="card">${inner}</div></main>
      <footer class="pfoot">${esc(STUDY.footer)}</footer>
    </div>`;
  }
  // No topic label (e.g. "Memory") on participant screens: it can change how people answer.
  const chip = () => "";

  // "What to do" steps that stay on screen for the whole question, so nobody has to memorize instructions.
  function howToFor(step) {
    if (!step) return null;
    if (step.howTo) return step.howTo;
    if (step.type === "speak") return step.sequence
      ? ["Tap the green START button.", "Listen carefully.", "Wait for the chime and SPEAK NOW.", "Say your answer out loud, slowly and clearly.", "Tap I'M DONE."]
      : ["Listen to the question.", "Tap the green START button.", "Wait for the chime and SPEAK NOW.", "Say your answer out loud, slowly and clearly.", "Tap I'M DONE."];
    if (step.type === "rotate") return ["Look at the shape at the TOP.", "Tap the green START button. Three shapes appear.",
      "Only ONE of them is the same shape, just turned.", "The other two are FLIPPED, like a mirror. They are NOT the same.", "Tap the one that is the same."];
    return null;
  }
  function howToPanel(step, how) {
    return `<aside class="howto" aria-label="What to do"><h3>What to do</h3>
      <ol style="--rows:${Math.ceil(how.length / 2)}">${how.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>
      ${step.type === "rotate" ? rotLegend() : ""}</aside>`;
  }

  // Big green START button, shown after the instructions have been heard. Nothing is timed or played
  // (words, numbers, letters, circles, shapes) until the participant taps it. The instructions can be
  // heard again first as often as needed - the memory items are not part of them.
  function startGate(step, item, { label = "Start", hint = false } = {}) {
    const box = $("gate");
    return new Promise((resolve) => {
      if (!box) return resolve();
      const t0 = now(); const card = document.querySelector(".card");
      card && card.classList.add("gating");                  // hide the big speaker icon to make room
      box.innerHTML = `${hint ? `<div class="gate-hint">When you are ready, tap <b>START</b></div>` : ""}
        <div class="row"><button class="btn-primary btn-start" id="startBtn">${ICON.play} ${esc(label)}</button>
        <button class="btn-ghost" id="instrAgain">${ICON.replay} Hear the instructions again</button></div>`;
      box.classList.remove("hidden");
      const again = $("instrAgain");
      again.onclick = async () => {
        item.replays = (item.replays || 0) + 1; again.disabled = true; stopSpeech();
        await playInstruction(step);
        if ($("instrAgain") === again) again.disabled = false;
      };
      $("startBtn").onclick = () => {
        stopSpeech(); item.startTapMs = Math.round(now() - t0); // time from "tap START" prompt to the tap
        card && card.classList.remove("gating");
        box.classList.add("hidden"); box.innerHTML = ""; resolve();
      };
    });
  }
  const gateHtml = `<div class="gate hidden" id="gate"></div>`;
  function wirePause() { const b = $("pauseBtn"); if (b) b.onclick = pauseNow; }

  // "Pause / I need a break": stops the current question; Continue restarts it from the beginning.
  function pauseNow() {
    if (!session) return;
    abortStep && abortStep(); stopSpeech();
    session.pauses = session.pauses || [];
    session.pauses.push({ step: STEPS[stepIndex]?.id, at: new Date().toISOString() });
    flagNext(STEPS[stepIndex]?.id, "restarted after pause");
    saveSession();
    $app.innerHTML = shell(`
      <div class="orb listen">${ICON.pause}</div>
      <h2 class="prompt">Take a break</h2>
      <p class="sub">Take as long as you need.\nWhen you're ready, tap Continue to start this question again.</p>
      <button class="btn-primary" id="resume">Continue ${ICON.play}</button>`, { pause: false, howto: false });
    $("resume").onclick = () => runStep();
  }

  // brief, neutral "Thank you ✓" between questions (not about right or wrong)
  async function thanks() {
    const el = document.createElement("div");
    el.className = "flash-ok"; el.innerHTML = `<div>${ICON.check}<span>Thank you</span></div>`;
    document.body.appendChild(el);
    await sleep(R.on && R.short ? 250 : 650); el.remove();
  }
  async function next() {
    if (redoReturn) { redoReturn = false; stopSpeech(); return qualityCheck(); } // single redo finished
    stepIndex += 1; runStep();
  }

  function runStep() {
    abortStep = null; stopSpeech(); $overlay.classList.add("hidden");
    const step = STEPS[stepIndex];
    if (!step) return finishSession();
    renderToolbar();
    prefetchStep(STEPS[stepIndex + 1]);
    const runners = { intro: introStep, speak: speakStep, trail: trailStep, draw: drawStep, rotate_intro: rotateIntroStep, rotate: rotateStep, vigilance: vigilanceStep, end: endStep };
    (runners[step.type] || next)(step);
    window.scrollTo(0, 0);
  }

  // --- welcome
  function introStep(step) {
    $app.innerHTML = shell(`
      <div class="hero-logo">${ICON.logo}</div>
      <h1 class="title">${esc(STUDY.appName)}</h1>
      <p class="sub">${esc(STUDY.tagline)}</p>
      <div class="caption" id="cap" aria-live="polite"></div>
      <div class="meta-line"><span class="meta-pill">⏱ About ${STUDY.minutes} minutes</span><span class="meta-pill">✓ No wrong answers</span></div>
      <div class="tips">
        <div class="tip"><span class="ic">👂</span><b>1. Listen</b><span>to the instructions (they are also written on the screen)</span></div>
        <div class="tip"><span class="ic">▶️</span><b>2. Tap START</b><span>when you are ready</span></div>
        <div class="tip"><span class="ic">🗣️</span><b>3. Answer</b><span>out loud after the chime, or tap / draw</span></div>
      </div>
      <button class="btn-primary" id="go" disabled>Start ${ICON.play}</button>`, { progress: false });
    const go = $("go");
    playInstruction(step).then(() => (go.disabled = false));
    setTimeout(() => (go.disabled = false), R.on ? 300 : 4000);
    go.onclick = () => { stopSpeech(); next(); };
  }

  // --- spoken answer (orientation, naming, digits, sentences, fluency, abstraction, recall)
  const pendingReplayCount = {};
  async function speakStep(step) {
    let cancelled = false; let recorder = null; let timer = null; let raf = null;
    abortStep = () => { cancelled = true; clearInterval(timer); cancelAnimationFrame(raf); stopSpeech(); recorder && recorder.stop(); };
    const item = itemBase(step);
    const maxS = limitSec(step);
    const C = 2 * Math.PI * 52;
    const visual = step.image
      ? `<img class="naming-img" src="${esc(step.image)}" alt="" onerror="this.outerHTML='<div class=&quot;naming-emoji&quot;>${step.emoji || "?"}</div>'">`
      : step.emoji ? `<div class="naming-emoji" aria-hidden="true">${step.emoji}</div>` : "";
    $app.innerHTML = shell(`
      ${chip(step)}
      ${visual}
      <h2 class="prompt">${esc(step.text)}</h2>
      <div class="caption" id="cap" aria-live="polite"></div>
      <div class="voice-state">
        ${step.countdown
          ? `<div class="ring hidden" id="ring"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52" stroke-width="12" fill="none"/>
              <circle class="bar" id="ringBar" cx="60" cy="60" r="52" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
              <div class="num" id="cd">${maxS}</div></div>`
          : ""}
        <div class="orb listen" id="orb">${ICON.ear}</div>
        <div class="status" id="status">Listen to the instructions…</div>
        <div class="meter hidden" id="meter"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="hint" id="hint"></div>
      </div>
      ${gateHtml}
      <div class="row">
        ${step.allowReplay ? `<button class="btn-ghost hidden" id="replay">${ICON.replay} Hear the question again</button>` : ""}
        ${step.countdown ? "" : `<button class="btn-primary hidden" id="done">${ICON.check} I'm done</button>`}
      </div>`);
    wirePause();
    const $orb = $("orb"), $status = $("status"), $meter = $("meter"), $hint = $("hint");
    const $done = $("done"), $replay = $("replay"), $cd = $("cd"), $ring = $("ring"), $ringBar = $("ringBar");

    item.replays = pendingReplayCount[step.id] || 0;
    if ($replay) $replay.onclick = () => {
      // Restart this step (discarding any partial recording) and remember how many replays were used.
      pendingReplayCount[step.id] = item.replays + 1; abortStep(); runStep();
    };

    await playInstruction(step);
    if (cancelled) return;
    item.instructionMs = Math.round(now() - item._t0);
    $status.textContent = "Tap START when you are ready";
    await startGate(step, item);
    if (cancelled) return;
    if (step.sequence) {                       // words / numbers / sentence: heard only now, after START
      $status.textContent = "Listen carefully…";
      const s0 = now(); await playSequence(step); item.sequenceMs = Math.round(now() - s0);
      if (cancelled) return;
    }
    await chime(true);
    if (cancelled) return;
    try { recorder = await startRecording(); }
    catch (e) { $status.textContent = "Microphone problem — please tell the staff member"; item.error = "mic: " + e.message; await storeItem(item); return; }
    if (cancelled) { recorder.stop(); return; }
    $orb.className = "orb speak live"; $orb.innerHTML = ICON.mic;
    if ($ring) { $orb.classList.add("hidden"); $ring.classList.remove("hidden"); } // timed task: show the countdown ring instead
    $status.className = "status speak"; $status.textContent = step.countdown ? "SPEAK NOW — say P words until the timer ends" : "SPEAK NOW — say your answer";
    $meter.classList.remove("hidden");
    if ($replay) $replay.classList.remove("hidden");
    item.recordStartedAt = new Date().toISOString();
    const respOpen = now();
    // speech timing: onset = first sound lasting >= 150 ms after "Your turn"; end = last sound heard
    let voiceStart = null, onsetAt = null, lastVoiceAt = null;

    // live sound meter + gentle "take your time" prompt
    const bars = [...$meter.children]; let lastVoice = now(); let heard = false; let maxLevel = 0;
    const tick = () => {
      if (cancelled || finished) return;
      const lv = recorder.level(); maxLevel = Math.max(maxLevel, lv);
      bars.forEach((b, i) => { const wobble = 0.55 + 0.45 * Math.sin(now() / 120 + i * 1.3); b.style.height = `${10 + Math.round(lv * 46 * wobble)}px`; });
      if (lv > 0.12) {
        lastVoice = now(); lastVoiceAt = lastVoice;
        if (voiceStart === null) voiceStart = lastVoice;
        if (onsetAt === null && lastVoice - voiceStart >= 150) onsetAt = voiceStart;
        if (!heard) { heard = true; $hint.textContent = "We can hear you ✓"; }
      } else {
        voiceStart = null;
        if (!step.countdown && now() - lastVoice > 7000) $hint.textContent = "Take your time — answer whenever you're ready.";
      }
      raf = requestAnimationFrame(tick);
    };
    let finished = false;
    raf = requestAnimationFrame(tick);

    const finish = async (reason) => {
      if (finished || cancelled) return; finished = true; clearInterval(timer); cancelAnimationFrame(raf);
      $meter.classList.add("hidden"); $status.className = "status"; $status.textContent = "Saving…";
      item.responseMs = Math.round(now() - respOpen);
      item.latencyMs = onsetAt !== null ? Math.round(onsetAt - respOpen) : null;
      item.speechEndMs = lastVoiceAt !== null && onsetAt !== null ? Math.round(lastVoiceAt - respOpen) : null;
      const out = await recorder.stop();
      item.stopReason = reason; item.recordMs = out.ms; item.audioMime = out.mime;
      if (!noMic()) {
        item.voiceDetected = heard; item.maxLevel = Math.round(maxLevel * 100) / 100;
        noVoiceStreak = heard ? 0 : noVoiceStreak + 1;
        if (noVoiceStreak === 2) toast("⚠️ Staff: no speech detected in the last 2 answers — check the microphone (staff menu → Redo).", 7000);
      }
      item.audio = out.blob ? await blobToDataURL(out.blob) : null;
      delete pendingReplayCount[step.id];
      if (cancelled) return;
      await storeItem(item); await thanks(); if (STEPS[stepIndex] === step) next();
    };
    const limit = maxS * 1000; const t0 = now();
    timer = setInterval(() => {
      const left = Math.max(0, limit - (now() - t0));
      if ($cd) { $cd.textContent = Math.ceil(left / 1000); $ringBar.setAttribute("stroke-dashoffset", String(C * (1 - left / limit))); }
      if (left <= 0) finish("time_limit");
    }, 200);
    if ($done) { setTimeout(() => !finished && !cancelled && $done.classList.remove("hidden"), R.on ? 200 : 1500); $done.onclick = () => finish("done_button"); }
  }

  // --- trail (tap 1-A-2-B ...)
  function trailStep(step) {
    const item = itemBase(step);
    item.taps = []; item.errors = 0; item.completed = false;
    $app.innerHTML = shell(`
      ${chip(step)}
      <h2 class="prompt" style="font-size:calc(clamp(26px,3.4vw,36px) * var(--fs))">${esc(step.text)}</h2>
      <div class="caption" id="cap" aria-live="polite"></div>
      <div class="trail-area" id="area">${step.circles.map((c, i) =>
        // positions are mapped into an inner margin so circles never poke out of the box on any screen shape
        `<div class="trail-dot" data-i="${i}" style="left:calc(9% + ${(c.x * 0.82).toFixed(1)}%);top:calc(12% + ${(c.y * 0.76).toFixed(1)}%)">${esc(c.label)}</div>`).join("")}</div>
      <p class="sub" id="trailHint">Listen to the instructions first…</p>
      ${gateHtml}`);
    wirePause();
    let nextIdx = 0, t0 = null, timer = null, finished = false;
    const area = $("area"); const dots = [...area.children];
    area.style.pointerEvents = "none"; area.classList.add("waiting");
    const cue = () => { if (step.practice) dots.forEach((d, k) => d.classList.toggle("cue", k === nextIdx)); }; // hint only in practice
    abortStep = () => { finished = true; clearTimeout(timer); };
    const finish = async (reason) => {
      if (finished) return; finished = true; clearTimeout(timer);
      item.durationMs = t0 ? Math.round(now() - t0) : null; item.stopReason = reason;
      item.firstTapMs = item.taps.length ? item.taps[0].t : null;
      item.completed = nextIdx === step.circles.length;
      item.appScore = step.practice ? null : (item.completed ? 1 : 0) + (item.completed && item.errors <= 1 ? 1 : 0);
      await storeItem(item); await sleep(500);
      if (STEPS[stepIndex] === step) { await thanks(); if (STEPS[stepIndex] === step) next(); }
    };
    (async () => {
      await playInstruction(step); if (finished) return;
      item.instructionMs = Math.round(now() - item._t0);
      $("trailHint").textContent = "Tap START when you are ready";
      await startGate(step, item); if (finished) return;
      area.style.pointerEvents = "auto"; area.classList.remove("waiting"); t0 = now(); cue();
      $("trailHint").textContent = step.practice ? "Practice — the next circle is highlighted. Start at 1." : "Start at 1";
      timer = setTimeout(() => finish("time_limit"), trailLimitSec(step) * 1000);
    })();
    area.addEventListener("pointerdown", (e) => {
      const dot = e.target.closest(".trail-dot"); if (!dot || finished || t0 === null) return;
      const i = Number(dot.dataset.i); const t = Math.round(now() - t0);
      if (i === nextIdx) {
        dot.classList.add("done"); item.taps.push({ label: step.circles[i].label, t, correct: true });
        nextIdx += 1; cue(); if (nextIdx === step.circles.length) finish("completed");
      } else if (!dot.classList.contains("done")) {
        item.errors += 1; item.taps.push({ label: step.circles[i].label, t, correct: false });
        dot.classList.remove("wrong"); void dot.offsetWidth; dot.classList.add("wrong");
      }
    });
  }

  // --- drawing (copy a figure)
  function drawStep(step) {
    const item = itemBase(step); item.clears = 0; item.strokes = 0;
    const extra = R.on ? 52 : 0;
    const fig = step.figure && FIGURES[step.figure];
    $app.innerHTML = shell(`
      ${chip(step)}
      <h2 class="prompt" style="font-size:calc(clamp(24px,3.2vw,34px) * var(--fs))">${esc(step.text)}</h2>
      <div class="caption" id="cap" aria-live="polite"></div>
      ${gateHtml}
      <div class="draw-layout" id="dlayout">
        <div class="draw-pair">
          ${fig ? `<div class="copy-figure" aria-hidden="true">${fig}</div>` : ""}
          <canvas class="draw waiting" id="cv" width="520" height="520" style="width:260px;height:260px"></canvas>
        </div>
        <div class="draw-btns hidden" id="dbtns">
          <button class="btn-primary" id="done" disabled>${ICON.check} Done</button>
          <button class="btn-secondary" id="clear">${ICON.erase} Erase</button>
          ${step.allowReplay ? `<button class="btn-ghost" id="replay">${ICON.replay} Hear it again</button>` : ""}
        </div>
      </div>`);
    wirePause();
    const cv = $("cv"), ctx = cv.getContext("2d");
    // size the drawing space to the room that is left (the "What to do" panel takes some of the screen)
    const card = document.querySelector(".card"), cs = getComputedStyle(card);
    const innerW = card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const how = document.querySelector(".howto");
    const howBeside = how && how.getBoundingClientRect().top < card.getBoundingClientRect().bottom - 40 && how.getBoundingClientRect().right <= card.getBoundingClientRect().left + 4;
    const howH = how && !howBeside ? how.offsetHeight + 16 : 0;
    const figEl = document.querySelector(".copy-figure"); const figW = figEl ? figEl.offsetWidth + 28 : 0;
    const land = innerW - figW - 250 >= 320;              // room for the buttons beside the drawing space?
    $("dlayout").classList.toggle("land", land);
    const size = Math.round(Math.max(240, Math.min(innerW - figW - (land ? 250 : 0), window.innerHeight - (land ? 330 : 430) - extra - howH, 680)));
    cv.width = size * 2; cv.height = size * 2; cv.style.width = `${size}px`; cv.style.height = `${size}px`;
    const blank = () => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); };
    const pen = () => { ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = "#111"; };
    blank(); pen();
    let drawing = false, t0 = null, firstStroke = null, active = false, cancelled = false;
    abortStep = () => { cancelled = true; stopSpeech(); };
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
    cv.addEventListener("pointerdown", (e) => { if (!active) return; if (firstStroke === null) firstStroke = now(); drawing = true; cv.setPointerCapture(e.pointerId); const [x, y] = pt(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke(); item.strokes += 1; $("done").disabled = false; });
    cv.addEventListener("pointermove", (e) => { if (!drawing) return; const [x, y] = pt(e); ctx.lineTo(x, y); ctx.stroke(); });
    ["pointerup", "pointercancel"].forEach((ev) => cv.addEventListener(ev, () => (drawing = false)));
    $("clear").onclick = () => { blank(); pen(); item.clears += 1; item.strokes = 0; $("done").disabled = true; };
    const rp = $("replay"); if (rp) rp.onclick = () => { item.replays += 1; stopSpeech(); playInstruction(step); };
    $("done").onclick = async () => {
      stopSpeech(); item.durationMs = Math.round(now() - t0); item.image = cv.toDataURL("image/png");
      item.firstStrokeMs = firstStroke !== null ? Math.round(firstStroke - t0) : null;
      item.latencyMs = item.firstStrokeMs;                   // START tap -> first line drawn
      item.drawMs = firstStroke !== null ? Math.round(now() - firstStroke) : null;
      await storeItem(item); await thanks(); if (STEPS[stepIndex] === step) next();
    };
    (async () => {
      await playInstruction(step); if (cancelled) return;
      item.instructionMs = Math.round(now() - item._t0);
      await startGate(step, item, { hint: true }); if (cancelled) return;
      active = true; t0 = now(); cv.classList.remove("waiting"); $("dbtns").classList.remove("hidden");
    })();
  }

  // figures to copy (draw steps with `figure`)
  const FIGURES = {
    box: `<svg viewBox="0 0 120 100" class="fig-svg"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <rect x="10" y="36" width="64" height="58"/><rect x="42" y="8" width="64" height="58"/>
      <path d="M10 36 L42 8 M74 36 L106 8 M10 94 L42 66 M74 94 L106 66"/></g></svg>`,
  };

  // --- shape turning (mental rotation): tap the choice that is the same shape, just turned
  function shapeSVG(cells, rot = 0, mirror = false) {
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    const rects = cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`).join("");
    return `<svg viewBox="${cx - 2} ${cy - 2} 4 4" class="shape-svg" aria-hidden="true"><g transform="rotate(${rot} ${cx} ${cy}) translate(${cx} ${cy}) scale(${mirror ? -1 : 1} 1) translate(${-cx} ${-cy})">${rects}</g></svg>`;
  }
  const practiceRetried = {};
  // small reminder that stays on screen during every shape question
  function rotLegend() {
    const L = SHAPES.L;
    return `<div class="rot-legend" aria-hidden="true">
      <span class="ok"><i>${shapeSVG(L)}</i>→<i>${shapeSVG(L, 90)}</i><b>✓ Turned = same</b></span>
      <span class="no"><i>${shapeSVG(L)}</i>→<i>${shapeSVG(L, 0, true)}</i><b>✗ Flipped = not the same</b></span></div>`;
  }
  // how-it-works screen: one shape keeps turning (same), one keeps flipping like a mirror (not the same)
  function rotateIntroStep(step) {
    const item = itemBase(step); const cells = SHAPES[step.shape];
    $app.innerHTML = shell(`
      <h2 class="prompt">${esc(step.text)}</h2>
      <div class="caption" id="cap" aria-live="polite"></div>
      <div class="rot-demo">
        <div class="demo-card ok"><div class="demo-shape"><div class="spin">${shapeSVG(cells)}</div></div>
          <b>✓ Turned</b><span>Still the SAME shape</span></div>
        <div class="demo-card no"><div class="demo-shape mirror-line"><div class="flip">${shapeSVG(cells)}</div></div>
          <b>✗ Flipped</b><span>Like a mirror — NOT the same</span></div>
      </div>
      <div class="row">
        <button class="btn-ghost" id="replay">${ICON.replay} Hear it again</button>
        <button class="btn-primary" id="go" disabled>I understand — Continue ${ICON.play}</button>
      </div>`);
    wirePause();
    let done = false; abortStep = () => { done = true; stopSpeech(); };
    const go = $("go");
    const play = () => playInstruction(step).then(() => { if (!done) go.disabled = false; });
    $("replay").onclick = () => { item.replays += 1; stopSpeech(); play(); };
    setTimeout(() => (go.disabled = false), R.on ? 300 : 15000); // never stuck if the audio fails
    go.onclick = async () => { if (done) return; done = true; stopSpeech(); await storeItem(item); next(); };
    play();
  }
  function rotateStep(step) {
    const item = itemBase(step);
    const cells = SHAPES[step.shape]; const correctIdx = step.choices.findIndex((c) => !c.mirror);
    $app.innerHTML = shell(`
      ${chip(step)}
      <h2 class="prompt">${esc(step.text)}</h2>
      <div class="caption" id="cap" aria-live="polite"></div>
      <div class="rot-target-wrap"><span class="rot-tag">Top shape</span><div class="rot-target">${shapeSVG(cells)}</div></div>
      <div class="status" id="status">Listen to the instructions…</div>
      ${gateHtml}
      <div class="rot-choices waiting" id="rchoices" style="--n:${step.choices.length}">${step.choices.map((c, i) =>
        `<button class="rot-choice" data-i="${i}" disabled aria-label="choice ${i + 1}">${shapeSVG(cells, c.rot, c.mirror)}</button>`).join("")}</div>`);
    wirePause();
    const btns = [...document.querySelectorAll(".rot-choice")], $status = $("status");
    let t0 = null, finished = false, cancelled = false, timer = null;
    abortStep = () => { cancelled = true; finished = true; clearTimeout(timer); stopSpeech(); };
    const finish = async (i, reason) => {
      if (finished) return; finished = true; clearTimeout(timer);
      btns.forEach((b) => (b.disabled = true));
      item.choice = i; item.correct = i === correctIdx; item.stopReason = reason;
      item.rtMs = i === null ? null : Math.round(now() - t0);
      item.appScore = step.practice ? null : (item.correct ? 1 : 0);
      if (step.practice) { // show the right answer so everyone understands the task before it counts
        btns[correctIdx].classList.add("right");
        if (i !== null && !item.correct) btns[i].classList.add("wrong");
        const retry = !item.correct && !practiceRetried[step.id];
        $status.textContent = item.correct ? "Yes! That is the same shape, just turned."
          : `The green one is the same shape, just turned. The others are flipped, like a mirror.${retry ? " Let's try once more." : ""}`;
        await sleep(R.on && R.short ? 600 : 5000); if (cancelled) return;
        if (retry) { practiceRetried[step.id] = true; item.retried = true; await storeItem(item); return runStep(); } // one more practice
        delete practiceRetried[step.id];
      }
      await storeItem(item); await thanks(); if (STEPS[stepIndex] === step) next();
    };
    btns.forEach((b) => b.addEventListener("click", () => { if (t0 !== null) finish(Number(b.dataset.i), "tapped"); }));
    (async () => {
      await playInstruction(step); if (finished) return;
      item.instructionMs = Math.round(now() - item._t0);
      $status.textContent = "Tap START when you are ready";
      await startGate(step, item); if (finished) return;
      $("rchoices").classList.remove("waiting");           // choices appear only after START (clean reaction time)
      btns.forEach((b) => (b.disabled = false)); t0 = now();
      $status.textContent = "Tap the shape that is the same";
      timer = setTimeout(() => finish(null, "time_limit"), (R.on && R.short ? 8 : (step.timeLimitSec || 60)) * 1000);
    })();
  }

  // --- letter tap (vigilance): letters are SHOWN one at a time (not spoken); tap for the target letter
  function vigilanceStep(step) {
    const item = itemBase(step); item.onsets = []; item.taps = [];
    const showMs = step.showMs ?? 2000, gapMs = step.gapMs ?? 300, interval = showMs + gapMs;
    item.mode = "visual"; item.showMs = showMs; item.gapMs = gapMs;
    $app.innerHTML = shell(`
      ${chip(step)}
      <h2 class="prompt">${esc(step.text)}</h2>
      <div class="caption" id="cap" aria-live="polite"></div>
      <div class="vig-row">
        <div class="letter-box" id="lbox" aria-live="off"></div>
        <button class="tap-target" id="tap" disabled>TAP</button>
      </div>
      <div class="status" id="status">Listen to the instructions…</div>
      ${gateHtml}`);
    wirePause();
    const $tap = $("tap"), $status = $("status"), $lbox = $("lbox");
    let cancelled = false, t0 = 0; abortStep = () => { cancelled = true; stopSpeech(); };
    const waitUntil = async (t) => { const w = t - now(); if (w > 0) await sleep(w); };
    $tap.addEventListener("pointerdown", () => {
      if ($tap.disabled) return; item.taps.push(Math.round(now() - t0));
      $tap.classList.add("flash"); setTimeout(() => $tap.classList.remove("flash"), 150);
    });
    (async () => {
      await playInstruction(step); if (cancelled) return;
      clearCaption(); item.instructionMs = Math.round(now() - item._t0);
      $status.textContent = "Tap START when you are ready";
      await startGate(step, item); if (cancelled) return;
      $status.textContent = "Get ready…"; $lbox.classList.add("ready"); await sleep(1500); if (cancelled) return;
      $lbox.classList.remove("ready");
      $tap.disabled = false; $status.textContent = `Tap when you see ${step.target}`; t0 = now();
      for (let i = 0; i < step.letters.length; i++) {
        if (cancelled) return;
        const due = t0 + i * interval; await waitUntil(due); if (cancelled) return;
        const letter = step.letters[i]; const rec = { letter, scheduled: Math.round(due - t0), onset: null };
        item.onsets.push(rec);
        $lbox.textContent = letter; $lbox.classList.add("on");
        requestAnimationFrame(() => { rec.onset = Math.round(now() - t0); }); // when the letter is actually painted
        await waitUntil(due + showMs); if (cancelled) return;
        $lbox.textContent = ""; $lbox.classList.remove("on");
      }
      await waitUntil(t0 + step.letters.length * interval + 400); if (cancelled) return;
      $tap.disabled = true;
      // score: a tap from when an M appears until the next letter appears = hit; any other tap = false alarm
      const windowMs = interval; const used = new Set(); let hits = 0, misses = 0; const rts = [];
      item.onsets.forEach((o) => {
        if (o.letter !== step.target) return;
        const start = o.onset ?? o.scheduled;
        const idx = item.taps.findIndex((t, k) => !used.has(k) && t >= start && t <= start + windowMs);
        if (idx >= 0) { used.add(idx); hits += 1; rts.push(item.taps[idx] - start); } else misses += 1;
      });
      // taps that were not hits: was a look-alike letter (e.g. N, W) on screen?
      item.lureTaps = item.taps.filter((t, k) => {
        if (used.has(k)) return false;
        const o = [...item.onsets].reverse().find((x) => (x.onset ?? x.scheduled) <= t);
        return !!o && step.lures && step.lures.includes(o.letter);
      }).length;
      item.hitRtsMs = rts; item.meanHitRtMs = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;
      item.hits = hits; item.misses = misses; item.falseAlarms = item.taps.length - used.size;
      item.errors = item.misses + item.falseAlarms;
      item.appScore = item.errors <= 1 ? 1 : 0;
      await storeItem(item); await thanks(); if (STEPS[stepIndex] === step) next();
    })();
  }

  // --- finished
  async function endStep(step) {
    session.completed = true; session.completedAt = new Date().toISOString(); await saveSession();
    $app.innerHTML = shell(`
      <div class="big-check">${ICON.check}</div>
      <h1 class="title">All done — thank you!</h1>
      <p class="sub">Thank you for helping with our research.\nPlease hand the tablet back to the staff member.</p>
      <div class="caption" id="cap" aria-live="polite"></div>`, { pause: false });
    chime(true).then(() => playInstruction(step));
    $help.classList.add("hidden");
    // Staff: hold the top-right corner for 2 s to return to the staff console (researcher mode: ✕ Exit).
  }

  function finishSession() {
    hideSessionControls();
    const last = session;
    session = null; redoReturn = false;
    if (params.get("researcher") !== "1") { R.on = false; R.mic = false; } // never carry practice mode into a real participant
    try { wakeLock && wakeLock.release(); } catch (_) {}
    $app.innerHTML = consoleShell(`
      <section class="panel">
        <h2>✅ Session saved</h2>
        <div class="kv" style="margin-top:12px">
          <div>Code</div><div><b>${esc(last?.code)}</b>${last?.researcher ? " (practice)" : ""}</div>
          <div>Status</div><div>${last?.completed ? "complete" : "ended early at " + esc(last?.endedEarlyAt)}</div>
          <div>Items stored</div><div>${Object.keys(last?.items || {}).length} on this iPad</div>
          <div>Staff help / pauses</div><div>${(last?.helpEvents || []).length} / ${(last?.pauses || []).length}</div>
          <div>Paper SLUMS</div><div>${slumsText(last)}</div>
        </div>
        ${!last?.slums ? `<div class="banner" style="margin-top:14px">The paper SLUMS has not been recorded for this participant yet.</div>` : ""}
        <div class="actions">
          ${!last?.slums ? `<button class="cbtn" id="doSlums">📝 Give / record the paper SLUMS now</button>` : ""}
          <button class="cbtn ${last?.slums ? "" : "alt"}" id="new">Next participant ▶</button>
          <button class="cbtn alt" id="sess">🗂 Saved sessions &amp; export</button></div>
      </section>`, { single: true });
    $("new").onclick = () => setupScreen({ place: last?.place, city: last?.city, observer: last?.observer });
    $("sess").onclick = sessionsScreen;
    const ds = $("doSlums"); if (ds) ds.onclick = () => { session = last; slumsScreen("after"); };
    refreshUnexported();
  }

  // ---------------------------------------------------------------- boot
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  checkPersisted().then(() => setupScreen());
})();
