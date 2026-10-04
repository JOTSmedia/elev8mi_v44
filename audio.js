(() => {
'use strict';
  const FREQ = 528;
  // Measured: amplitude 0.07 = -23.7 LUFS. 0.135 (+5.7 dB) matches the
  // instrument loops' shared -18 LUFS level.
  const DRONE_LEVEL = 0.135;
  let audioCtx = null;
  let osc = null;
  let gain = null;
  let lfo = null;
  let lfoGain = null;
  let toneOn = false;

  function buildTone() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audioCtx = audioCtx || new Ctx();
    if (osc) return true;
    osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = FREQ;
    gain = audioCtx.createGain();
    gain.gain.value = 0;
    lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    lfo.start();
    return true;
  }

  // Instrument loops (528 Hz, 2:00, seamless), listed in sound-config.js.
  // v35 LAZY SOUND: nothing is requested or decoded at page load. A track is
  // fetched only when the user picks it, and it STREAMS through ONE <audio>
  // element (no decodeAudioData: a decoded 2:00 stereo loop is ~42-46 MB of
  // RAM; v34 kept every chosen track decoded). Picking a different source frees
  // the previous one (pause, removeAttribute('src'), load()). While a picked
  // track loads its menu option (and the menu button) shows a loader; a failed
  // load shows an error state, and picking the option again retries.
  // Instrument files are normalised to about -18 LUFS and share one gain.
  const SHARED_GAIN = Number(window.Elev8SoundConfig?.sharedGain) || 1;
  const instruments = ((window.Elev8SoundConfig && window.Elev8SoundConfig.instruments) || [])
    .filter(item => item && /^[a-z0-9-]+$/.test(item.id))
    .map(item => ({id: item.id, label: item.label || item.id, gain: item.gain}));
  const menuButton = document.getElementById('soundMenuButton');
  const menu = document.getElementById('soundMenu');
  const menuLabel = document.getElementById('soundMenuLabel');
  let mode = 'tone';
  const find = id => instruments.find(item => item.id === id);
  // OGG (Vorbis) loops gaplessly with <audio loop>; the MP3 fallback (Safari
  // without Vorbis) may leave a tiny gap at the loop point (encoder padding).
  function sources(id) {
    const probe = document.createElement('audio');
    const ogg = probe.canPlayType && probe.canPlayType('audio/ogg; codecs="vorbis"');
    const base = `elev8mi-528hz-${id}`;
    return ogg ? [`${base}.ogg`, `${base}.mp3`] : [`${base}.mp3`];
  }
  const levelFor = item => typeof item.gain === 'number' ? item.gain : SHARED_GAIN;
  // Over http(s) the element runs through one MediaElementSource + gain on the
  // single shared AudioContext, so fades also work on iOS (element.volume is
  // fixed there). On file:// Web Audio would treat the media as cross-origin
  // and play silence, so the element volume is faded instead (as in v34).
  const useGain = location.protocol !== 'file:';
  let el = null, elGain = null, loadedId = null, ready = false, playing = false, token = 0, op = 0, fadeTimer = 0;
  const status = {};
  function player() {
    if (!el) { el = new Audio(); el.loop = true; el.preload = 'none'; el.volume = 0; }
    if (useGain && !elGain && audioCtx && audioCtx.createMediaElementSource) {
      try {
        const node = audioCtx.createMediaElementSource(el);
        elGain = audioCtx.createGain(); elGain.gain.value = 0;
        node.connect(elGain); elGain.connect(audioCtx.destination);
        el.volume = 1;
      } catch (_) { elGain = null; }
    }
    return el;
  }
  function fadeTo(to, seconds) {
    clearTimeout(fadeTimer);
    if (!el) return;
    if (elGain) {
      const now = audioCtx.currentTime, g = elGain.gain;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(to, now + seconds);
      return;
    }
    const target = Math.max(0, Math.min(1, to)), from = el.volume, start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / (seconds * 1000));
      el.volume = from + (target - from) * t;
      if (t < 1) fadeTimer = setTimeout(step, 40);
    };
    step();
  }
  function setStatus(id, state) {
    if (state) status[id] = state; else delete status[id];
    paintStatus();
  }
  function paintStatus() {
    menu?.querySelectorAll('[role="menuitemradio"]').forEach(li => {
      const state = status[li.dataset.sound] || '';
      if (state) li.dataset.state = state; else delete li.dataset.state;
      if (state === 'loading') li.setAttribute('aria-busy', 'true'); else li.removeAttribute('aria-busy');
      li.title = state === 'error' ? 'Could not load. Tap to try again.' : '';
    });
    if (menuButton) {
      const state = status[mode] || '';
      if (state) menuButton.dataset.state = state; else delete menuButton.dataset.state;
      if (state === 'loading') menuButton.setAttribute('aria-busy', 'true'); else menuButton.removeAttribute('aria-busy');
    }
  }
  // Free the current source completely.
  function release() {
    token++; op++; clearTimeout(fadeTimer);
    if (loadedId && status[loadedId] === 'loading') setStatus(loadedId, null);
    loadedId = null; ready = false; playing = false;
    if (!el) return;
    el.oncanplay = el.oncanplaythrough = el.onerror = null;
    if (elGain) { const now = audioCtx.currentTime; elGain.gain.cancelScheduledValues(now); elGain.gain.setValueAtTime(0, now); }
    else el.volume = 0;
    try { el.pause(); } catch (_) {}
    el.removeAttribute('src');
    try { el.load(); } catch (_) {}
  }
  function play(item) {
    if (loadedId !== item.id || playing) return; // play() also starts the fetch on iOS
    player(); playing = true;
    const t = token, p = el.play();
    const fadeIn = () => { if (t === token) fadeTo(levelFor(item), 1.2); };
    if (p && p.then) p.then(fadeIn).catch(() => { if (t === token) playing = false; });
    else fadeIn();
  }
  // Load (stream) the picked track; plays as soon as it can if the sound is on.
  function load(item) {
    release();
    const t = token, urls = sources(item.id);
    loadedId = item.id;
    setStatus(item.id, 'loading');
    const audio = player();
    const next = () => {
      if (t !== token) return;
      const url = urls.shift();
      if (!url) { release(); setStatus(item.id, 'error'); return; }
      audio.src = url;
      audio.load();
    };
    audio.onerror = () => {
      if (t !== token) return;
      playing = false; next();
      if (t === token && toneOn && mode === item.id) play(item);
    };
    audio.oncanplay = audio.oncanplaythrough = audio.onplaying = () => {
      if (t !== token || ready) return;
      ready = true; setStatus(item.id, null);
    };
    // iOS ignores preload until play(): if the sound is off, drop the loader
    // when the browser parks the fetch; it resumes when the sound is turned on.
    audio.onsuspend = () => { if (t === token && !ready && !playing && status[item.id] === 'loading') setStatus(item.id, null); };
    audio.preload = 'auto';
    next();
    if (toneOn && mode === item.id) play(item); // inside the tap, so mobile allows it
  }
  function stopLoop(fade) {
    if (!el || !loadedId) return;
    const t = ++op;
    if (!playing) {
      if (mode !== loadedId) release();
      return;
    }
    fadeTo(0, fade);
    setTimeout(() => {
      if (t !== op) return;
      if (mode !== loadedId) release(); // switched away: free the source
      else { try { el.pause(); } catch (_) {} playing = false; } // sound off: keep the one stream for a quick resume
    }, fade * 1000 + 80);
  }
  function startLoop(item) {
    if (loadedId === item.id && status[item.id] !== 'error') {
      op++; // cancel a pending stop
      if (!ready) setStatus(item.id, 'loading');
      if (playing) fadeTo(levelFor(item), 1.2); else play(item);
      return;
    }
    if (playing && loadedId) {
      // Switching tracks: short fade of the old one, free it, then load the new one.
      const t = ++op;
      fadeTo(0, .4);
      setTimeout(() => { if (t === op && toneOn && mode === item.id) load(item); }, 440);
      return;
    }
    load(item);
  }
  function setDrone(on) {
    const now = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(on ? DRONE_LEVEL : 0, now + 0.9);
    lfoGain.gain.cancelScheduledValues(now);
    lfoGain.gain.setValueAtTime(lfoGain.gain.value, now);
    lfoGain.gain.linearRampToValueAtTime(on ? DRONE_LEVEL * .17 : 0, now + 0.7);
  }
  const labelOf = id => id === 'tone' ? 'Tone' : (find(id)?.label || id);
  const spoken = id => id === 'tone' ? '528 Hz tone' : `528 Hz ${labelOf(id).toLowerCase()}`;
  function syncLabels() {
    const btn = document.getElementById('toneBtn');
    btn.setAttribute('aria-label', toneOn ? `Stop ${spoken(mode)}` : `Play ${spoken(mode)}`);
    if (menuLabel) menuLabel.textContent = labelOf(mode);
    if (menuButton) menuButton.setAttribute('aria-label', `Sound: ${labelOf(mode)}. Choose a 528 Hz sound`);
    menu?.querySelectorAll('[role="menuitemradio"]').forEach(item => item.setAttribute('aria-checked', String(item.dataset.sound === mode)));
  }
  function options() { return [...instruments.map(item => item.id), 'tone']; }
  function renderMenu() {
    if (!menu || !menuButton) return;
    const list = options();
    menu.replaceChildren(...list.map(id => {
      const item = document.createElement('li');
      item.setAttribute('role', 'menuitemradio'); item.tabIndex = -1; item.dataset.sound = id;
      item.textContent = labelOf(id);
      item.addEventListener('click', () => { choose(id); closeMenu(true); });
      return item;
    }));
    // With only Tone available there is nothing to choose; keep the label.
    menuButton.disabled = list.length < 2;
    syncLabels();
    paintStatus();
  }
  function items() { return [...menu.querySelectorAll('[role="menuitemradio"]')]; }
  function openMenu(focusLast) {
    if (!menu || menuButton.disabled) return;
    menu.hidden = false; menuButton.setAttribute('aria-expanded', 'true');
    const all = items(), current = all.find(item => item.dataset.sound === mode);
    (focusLast ? all.at(-1) : current || all[0])?.focus();
  }
  function closeMenu(restore) {
    if (!menu || menu.hidden) return;
    menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false');
    if (restore) menuButton.focus();
  }
  function choose(id) {
    const item = find(id);
    if (id === mode) {
      if (item && status[id] === 'error') load(item); // retry after a failed load
      return;
    }
    mode = id;
    if (toneOn) setTone(true);
    else {
      syncLabels();
      if (item) { if (loadedId !== id) load(item); } // fetch only on pick
      else release(); // Tone (live synth): no file, free any instrument source
      paintStatus();
    }
  }
  menuButton?.addEventListener('click', () => menu.hidden ? openMenu(false) : closeMenu(false));
  menuButton?.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openMenu(event.key === 'ArrowUp'); }
  });
  menu?.addEventListener('keydown', event => {
    const all = items(), index = all.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); all[(index + 1) % all.length].focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); all[(index - 1 + all.length) % all.length].focus(); }
    else if (event.key === 'Home') { event.preventDefault(); all[0].focus(); }
    else if (event.key === 'End') { event.preventDefault(); all.at(-1).focus(); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (index >= 0) { choose(all[index].dataset.sound); closeMenu(true); } }
    else if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); }
    else if (event.key === 'Tab') closeMenu(false);
  });
  document.addEventListener('pointerdown', event => { if (menu && !menu.hidden && !event.target.closest('#soundPicker')) closeMenu(false); });

  function setTone(on) {
    try { if (!buildTone()) return; } catch (_) { return; }
    audioCtx.resume().catch(()=>{});
    toneOn = on;
    setDrone(on && mode === 'tone');
    const item = find(mode);
    if (on && item) startLoop(item); else stopLoop(0.9);
    paintStatus();
    document.getElementById('tuner').classList.toggle('on', on);
    document.getElementById('toneBtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    syncLabels();
  }
  renderMenu(); // no audio is requested until a sound is picked
  document.getElementById('toneBtn').addEventListener('click', () => setTone(!toneOn));
  const heroTone=document.getElementById('heroTone');
  if(heroTone) heroTone.addEventListener('click', () => setTone(!toneOn));

})();
