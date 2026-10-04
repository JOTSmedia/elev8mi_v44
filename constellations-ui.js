// constellations-ui.js — ELEV8MI v34 (E8 "v34 constellations"). Self-contained ES module.
//
// John: "with the constellations, make them intermittently glow one at a time and
// the are clickable with a pop up information about the constellation, and also
// for the polaris, etc."
//
// What it does (night sky of the hero, WebGL path of photo-motion.js only):
//  1. Glow cycle: one on-screen constellation at a time brightens (lines + stars)
//     over ~3 s, holds, fades, then the next (~7 s cadence). Off by day (driven by
//     window.elev8miCelestial.daylight) and off under prefers-reduced-motion.
//  2. Click/tap/keyboard targets for each visible constellation and for the named
//     stars in constellations-info.json that exist in night-sky.json. Pointer and
//     touch use a delegated hit test (no overlay at all); keyboard uses one
//     roving-tabindex group of real <button>s in a fixed layer at z-index 0,
//     behind header/main (the layer itself has pointer-events:none).
//  3. Popup card (glass/gold, site CSS variables): constellation name, meaning,
//     myth, main stars, best season; or star facts. Closes on outside click/tap,
//     Esc or ×; returns focus; clamped on screen.
//  4. Performance: lazy init after the first requestIdleCallback; geometry is
//     recomputed at most 10 Hz (and only when rotation/size/camera band changes);
//     scrolling moves both layers with ONE transform each (sky parallax = 0.45).
//
// Projection: read from window.Elev8Sky.frame / .view, which photo-motion.js
// publishes next to its shader constants (no copies here).

const BASE = new URL('.', import.meta.url);
const VERSION = '38';
const DATA_URL = new URL(`assets/sky/night-sky.json?v=${VERSION}`, BASE).href; // same URL photo-motion.js fetches (cache hit)
const INFO_URL = new URL(`constellations-info.json?v=${VERSION}`, BASE).href;

const CYCLE = {rise: 3000, hold: 1600, fall: 2600, gap: 600}; // ~7.8 s per constellation
const d2r = Math.PI / 180;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mobileQuery = matchMedia('(max-width: 720px)');

let started = false;
export function initConstellations() {
  if (started) return; started = true;
  if (reduced.matches) { document.documentElement.dataset.constellations = 'off-reduced-motion'; return; }
  Promise.all([fetch(DATA_URL).then(r => r.ok ? r.json() : Promise.reject(new Error('sky ' + r.status))),
               fetch(INFO_URL).then(r => r.ok ? r.json() : Promise.reject(new Error('info ' + r.status)))])
    .then(([sky, info]) => build(sky, info))
    .catch(error => { document.documentElement.dataset.constellations = 'off'; console.warn('Constellations unavailable:', error.message); });
}

function build(sky, info) {
  const journey = document.getElementById('journey');
  if (!journey) return;
  if (!window.Elev8Sky?.frame || !window.Elev8Sky.view) { document.documentElement.dataset.constellations = 'off'; return; }
  const frame = () => window.Elev8Sky.frame;
  const view = () => window.Elev8Sky.view;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mobileTier = mobileQuery.matches || (coarse && Math.max(screen.width, screen.height) <= 1024); // same test as photo-motion.js
  const magLimit = mobileTier ? 4.0 : 5.0; // same star limit photo-motion.js draws

  // ---- sky-plane coordinates (degrees in the star-map texture), computed once ----
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vec = (ra, dec) => [Math.cos(dec * d2r) * Math.cos(ra * d2r), Math.cos(dec * d2r) * Math.sin(ra * d2r), Math.sin(dec * d2r)];
  const toMap = (ra, dec) => { const F = frame(), v = vec(ra, dec), z = dot(v, F.C); if (z < -0.3) return null; const k = 2 / (1 + z); return [k * dot(v, F.R) / d2r, k * dot(v, F.U) / d2r]; };

  const starByHip = new Map(sky.stars.map(s => [s[4], s]));
  const near = (a, b) => Math.abs(a[0] - b[0]) < 0.02 && Math.abs(a[1] - b[1]) < 0.02;
  const groups = Object.entries(sky.lines).filter(([abbr]) => info.constellations[abbr]).map(([abbr, polylines]) => {
    const lines = polylines.map(line => line.map(([ra, dec]) => toMap(ra, dec)).filter(Boolean)).filter(l => l.length > 1);
    // stars of the figure = dataset stars at the line vertices
    const verts = [];
    polylines.forEach(l => l.forEach(p => { if (!verts.some(q => near(p, q))) verts.push(p); }));
    const stars = verts.map(p => { const s = sky.stars.find(t => near([t[0], t[1]], p)); return s ? {m: toMap(s[0], s[1]), mag: s[2]} : {m: toMap(p[0], p[1]), mag: 4}; }).filter(s => s.m);
    return {kind: 'constellation', id: abbr, data: info.constellations[abbr], lines, stars};
  });
  const named = Object.entries(info.stars).map(([hip, data]) => ({hip: +hip, data, s: starByHip.get(+hip)}))
    .filter(x => x.s && x.s[2] <= magLimit).map(x => ({kind: 'star', id: String(x.hip), data: x.data, m: toMap(x.s[0], x.s[1]), mag: x.s[2]}))
    .filter(x => x.m);

  // ---- DOM: glow SVG inside #journey (decorative), button layer at body level ----
  const svgNS = 'http://www.w3.org/2000/svg';
  const glow = document.createElementNS(svgNS, 'svg');
  glow.id = 'constellationGlow'; glow.setAttribute('aria-hidden', 'true'); glow.setAttribute('focusable', 'false');
  const glowGroup = document.createElementNS(svgNS, 'g'); glowGroup.setAttribute('class', 'cg-figure'); glow.append(glowGroup);
  const canvas = document.getElementById('photoMotion');
  if (canvas && canvas.parentNode === journey) canvas.after(glow); else journey.insertBefore(glow, journey.querySelector('.day-sky'));

  const layer = document.createElement('div');
  layer.id = 'skyTargets'; layer.setAttribute('role', 'group'); layer.setAttribute('aria-label', 'Constellations and bright stars. Use arrow keys to move, Enter to learn more.');
  const main = document.querySelector('main');
  (main ? main.parentNode.insertBefore(layer, main) : document.body.append(layer));

  const popup = document.createElement('div');
  popup.id = 'constellationPopup'; popup.className = 'cg-popup'; popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-modal', 'false');
  popup.setAttribute('aria-labelledby', 'cgPopupTitle'); popup.hidden = true;
  document.body.append(popup);

  const items = [...groups, ...named];
  items.forEach((item, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cg-target cg-' + item.kind; b.tabIndex = -1; b.hidden = true;
    b.setAttribute('aria-label', item.kind === 'star' ? `${item.data.name}, star` : `${item.data.name}, constellation`);
    b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', () => open(item, b));
    item.button = b; item.index = i; item.screen = null; layer.append(b);
  });

  // ---- projection to screen (camera = 0), mirrors photo-motion.js's sky shader ----
  let geom = null; // {W,H,drawnX,drawnY,offX,offY,plateTop,plateH,imgW,imgH,camera}
  const plateImage = journey.querySelector('.journey-plate img');
  function measure() {
    const state = window.elev8miJourney, W = innerWidth, H = innerHeight;
    const imgW = plateImage?.naturalWidth || 941, imgH = plateImage?.naturalHeight || 1672;
    const scene = state?.scenes?.[0], plateH = scene?.height || H * 1.8, plateTop = scene?.top || 0;
    const fit = Math.max(W / imgW, plateH / imgH), drawnX = imgW * fit, drawnY = imgH * fit;
    return {W, H, imgW, imgH, plateH, plateTop, drawnX, drawnY, offX: (W - drawnX) / 2, offY: (plateH - drawnY) / 2};
  }
  // map degrees -> screen px at camera 0; returns [x, y, uvx, skyY] or null
  function project(m, rot, g, V) {
    const [px, py] = V.pole, rx = m[0] - px, ry = m[1] - py, c = Math.cos(rot), s = Math.sin(rot);
    // shader: map = pole + R(rot)·(skyDeg − pole)  =>  skyDeg = pole + R(−rot)·(map − pole)
    const sx = px + c * rx + s * ry, sy = py - s * rx + c * ry;
    const scale = typeof V.scale === 'function' ? V.scale(g.W, g.H) : V.scale;
    const skyX = sx / scale, skyY = V.origin - sy / scale;
    const uvx = skyX * g.imgH / g.imgW + 0.5;
    return [uvx * g.drawnX + g.offX, (skyY + V.top) * g.drawnY + g.offY + g.plateTop, uvx, skyY];
  }
  function onSky(p, m, g, V, camera) {
    if (!p || Math.abs(m[0]) > V.mapHalfW || Math.abs(m[1]) > V.mapHalfH) return false;
    const y = p[1] - (1 - V.parallax) * camera, x = p[0];
    if (x < -10 || x > g.W + 10 || y < -10 || y > g.H + 10) return false;
    if (y > g.plateTop + g.plateH - camera) return false;
    const hx = (p[2] - 0.5) * g.imgW / g.imgH, hz = V.horizon, horizon = hz.base + hz.radius - Math.sqrt(Math.max(0.001, hz.radius * hz.radius - hx * hx));
    const uvy = p[3] + V.top + V.parallax * camera / g.drawnY;
    return uvy < horizon - hz.fadeTo;
  }

  // ---- state & updates ----
  let night = 0, enabled = false, lastKey = '', visible = [], lastLayout = 0, focusIndex = -1, introDone=false;
  const reveal = () => document.getElementById('journey')?.dataset.photoMotion === 'gpu';
  function layout(now) {
    const state = window.elev8miJourney; if (!state) return;
    const camera = state.camera || 0, rot = +(window.Elev8Sky?.rotation) || 0;
    const clock = window.elev8miCelestial; night = 1 - (clock?.daylight ?? 0);
    const on = reveal() && night > 0.5 && !reduced.matches;
    // one transform per layer for scroll parallax (sky moves at 0.45 of the camera)
    const shift = `translate3d(0,${(-(1 - view().parallax) * camera).toFixed(1)}px,0)`;
    glow.style.transform = shift; layer.style.transform = shift;
    // full geometry at most 10 Hz, and only when something relevant changed
    const key = [innerWidth, innerHeight, rot.toFixed(4), Math.round(camera / 40), on ? 1 : 0, state.scenes?.[0]?.height | 0].join('|');
    if (key === lastKey || now - lastLayout < 100) return;
    lastKey = key; lastLayout = now;
    if (on !== enabled) { enabled = on; document.documentElement.dataset.constellations = on ? 'on' : 'idle'; if (!on) { stopGlow(); if (!popup.hidden && popupItem) close(false); } }
    geom = measure(); const V = view();
    visible = [];
    const minHit = 22; // px radius = 44 px target
    items.forEach(item => {
      let show = false;
      if (on) {
        if (item.kind === 'star') {
          const p = project(item.m, rot, geom, V);
          show = onSky(p, item.m, geom, V, camera);
          if (show) { item.screen = {x: p[0], y: p[1], r: minHit}; }
        } else {
          const pts = []; item.segs = [];
          item.lines.forEach(line => { let prev = null; line.forEach(m => { const p = project(m, rot, geom, V); const vis = onSky(p, m, geom, V, camera); const q = {x: p[0], y: p[1], vis}; if (prev && (prev.vis || vis)) item.segs.push([prev, q]); if (vis) pts.push(q); prev = q; }); });
          show = pts.length >= 2;
          if (show) {
            const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
            // anchor on the midpoint of the visible segment nearest the centroid: on the
            // figure's lines but never on a named star (stars have their own targets)
            const mids = item.segs.filter(([a, b]) => a.vis && b.vis).map(([a, b]) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}));
            const a = (mids.length ? mids : pts).reduce((best, p) => (Math.hypot(p.x - cx, p.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? p : best));
            item.screen = {x: a.x, y: a.y, r: minHit, pts};
          }
        }
      }
      if (!show) item.screen = null;
      const b = item.button;
      if (show) { b.hidden = false; b.style.transform = `translate3d(${(item.screen.x - minHit).toFixed(1)}px,${(item.screen.y - minHit).toFixed(1)}px,0)`; visible.push(item); }
      else if (!b.hidden) { if (document.activeElement === b) b.blur(); b.hidden = true; b.tabIndex = -1; }
    });
    // roving tabindex: exactly one visible target is in the Tab order
    visible.sort((a, b) => a.screen.x - b.screen.x || a.screen.y - b.screen.y);
    const current = visible.find(it => it.button === document.activeElement) || visible.find(it => it.button.tabIndex === 0) || visible[0];
    visible.forEach(it => { it.button.tabIndex = it === current ? 0 : -1; });
    if (activeGlow && !activeGlow.screen) stopGlow(); else if (activeGlow) drawFigure(activeGlow);
    if(enabled&&!introDone&&visible.filter(it=>it.kind==='constellation').length){introDone=true;const pool=visible.filter(it=>it.kind==='constellation').slice(0,12);pool.forEach((it,i)=>setTimeout(()=>{if(!enabled||!it.screen)return;activeGlow=it;drawFigure(it);glow.classList.add('is-lit');const pill=document.createElement('span');pill.className='cg-intro-pill';pill.textContent=it.data.name;pill.style.left=it.screen.x+'px';pill.style.top=it.screen.y+'px';document.body.append(pill);setTimeout(()=>{glow.classList.remove('is-lit');pill.remove()},520)},i*190));glowTimer=setTimeout(()=>{activeGlow=null;nextGlow()},pool.length*190+900);} else if (enabled && !glowTimer) glowTimer = setTimeout(nextGlow, 1200); // (re)start the cycle after a stop
  }

  // ---- glow cycle ----
  let activeGlow = null, glowTimer = 0, glowIndex = -1;
  function drawFigure(item) {
    const parts = [];
    item.segs.forEach(([a, b]) => parts.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`));
    let path = glowGroup.querySelector('path');
    if (!path) { path = document.createElementNS(svgNS, 'path'); glowGroup.append(path); }
    path.setAttribute('d', parts.join(''));
    glowGroup.querySelectorAll('circle').forEach(c => c.remove());
    const rot = +(window.Elev8Sky?.rotation) || 0, V = view();
    item.stars.forEach(s => {
      const p = project(s.m, rot, geom, V);
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', p[0].toFixed(1)); c.setAttribute('cy', p[1].toFixed(1));
      c.setAttribute('r', Math.max(1.3, (5.2 - s.mag) * (mobileTier ? 0.55 : 0.75)).toFixed(2));
      glowGroup.append(c);
    });
  }
  function stopGlow() { clearTimeout(glowTimer); glowTimer = 0; activeGlow = null; glow.classList.remove('is-lit'); }
  function nextGlow() {
    glowTimer = 0;
    if (!enabled || document.hidden || window.Elev8Motion?.paused) { glowTimer = setTimeout(nextGlow, 2000); return; }
    const pool = visible.filter(it => it.kind === 'constellation');
    if (!pool.length) { glowTimer = setTimeout(nextGlow, 2000); return; }
    glowIndex = (glowIndex + 1) % pool.length;
    activeGlow = pool[glowIndex]; drawFigure(activeGlow);
    glow.style.setProperty('--cg-rise', CYCLE.rise + 'ms'); glow.style.setProperty('--cg-fall', CYCLE.fall + 'ms');
    requestAnimationFrame(() => glow.classList.add('is-lit'));
    glowTimer = setTimeout(() => {
      glow.classList.remove('is-lit');
      glowTimer = setTimeout(() => { activeGlow = null; nextGlow(); }, CYCLE.fall + CYCLE.gap);
    }, CYCLE.rise + CYCLE.hold);
  }

  // ---- popup ----
  let popupItem = null, returnFocus = null;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function open(item, button, point) {
    popupItem = item; returnFocus = button && button.offsetParent !== null ? button : document.activeElement;
    const d = item.data;
    let html = `<button type="button" class="cg-close" aria-label="Close">×</button>`;
    if (item.kind === 'constellation') {
      html += `<p class="cg-kicker">Constellation · ${esc(item.id)}</p><h2 id="cgPopupTitle">${esc(d.name)}</h2>`
        + `<p class="cg-meaning">${esc(d.meaning)}</p><p class="cg-myth">${esc(d.myth)}</p><dl>`
        + `<dt>Main stars</dt><dd>${d.stars.map(esc).join(', ')}</dd>`
        + `<dt>Best seen</dt><dd>${esc(d.season)} evenings (Northern Hemisphere)</dd></dl>`;
    } else {
      const facts = [];
      if (d.mag !== undefined) facts.push(`<dt>Brightness</dt><dd>magnitude ${esc(d.mag)}</dd>`);
      if (d.distanceLy) facts.push(`<dt>Distance</dt><dd>${esc(d.distanceLy)} light-years</dd>`);
      if (d.spectral) facts.push(`<dt>Type</dt><dd>${esc(d.spectral)}</dd>`);
      html += `<p class="cg-kicker">Star · ${esc(d.designation || '')}</p><h2 id="cgPopupTitle">${esc(d.name)}</h2>`
        + `<p class="cg-meaning">${esc(d.what)}</p>${facts.length ? `<dl>${facts.join('')}</dl>` : ''}<p class="cg-fact"><span>Did you know?</span> ${esc(d.fact)}</p>`;
    }
    popup.innerHTML = html;
    popup.querySelector('.cg-close').addEventListener('click', () => close(true));
    popup.hidden = false; popup.classList.remove('is-open');
    place(point || (item.screen ? {x: item.screen.x, y: item.screen.y - (1 - view().parallax) * (window.elev8miJourney?.camera || 0)} : {x: innerWidth / 2, y: innerHeight / 2}));
    requestAnimationFrame(() => popup.classList.add('is-open'));
    popup.querySelector('.cg-close').focus({preventScroll: true, focusVisible: !point});
    document.documentElement.dataset.constellationPopup = item.id;
  }
  function place(pt) {
    const m = 12, w = popup.offsetWidth, h = popup.offsetHeight, W = innerWidth, H = innerHeight;
    let x, y;
    if (W <= 520) { x = (W - w) / 2; y = pt.y < H / 2 ? Math.min(pt.y + 34, H - h - m) : Math.max(pt.y - h - 34, m); }
    else { x = pt.x + 28; if (x + w > W - m) x = pt.x - w - 28; y = pt.y - h / 2; }
    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
    x = Math.max(m, Math.min(x, W - w - m)); y = Math.max(Math.max(m, Math.min(headerBottom + 8, H / 3)), Math.min(y, H - h - m));
    popup.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
  }
  function close(restore) {
    if (popup.hidden) return;
    popup.hidden = true; popup.classList.remove('is-open'); popupItem = null; delete document.documentElement.dataset.constellationPopup;
    if (restore && returnFocus && document.contains(returnFocus) && !returnFocus.hidden) returnFocus.focus({preventScroll: true});
    returnFocus = null;
  }

  // ---- input: delegated pointer hit test (no overlay), keyboard roving focus ----
  const BLOCK = 'a,button,input,select,textarea,label,summary,details,dialog,iframe,video,audio,[role],[tabindex],[contenteditable],header,footer,.hero-copy,.hero-sigil,.moon-now,.planet-detail,.solar-body,#constellationPopup';
  const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
  function hitTest(x, y) {
    if (!enabled) return null;
    const camera = window.elev8miJourney?.camera || 0, p = {x, y: y + (1 - view().parallax) * camera}; // to camera-0 coords
    // Nearest target wins (a star centre, a constellation anchor or line), so a
    // short figure such as Canis Minor stays tappable beside Procyon.
    let best = null, bestD = Infinity;
    visible.forEach(it => { if (it.kind !== 'star') return; const d = Math.hypot(p.x - it.screen.x, p.y - it.screen.y); if (d <= it.screen.r && d < bestD) { best = it; bestD = d; } });
    const lineTol = coarse ? 22 : 16;
    visible.forEach(it => { if (it.kind !== 'constellation') return; it.segs.forEach(([a, b]) => { const d = segDist(p, a, b); if (d <= lineTol && d < bestD) { best = it; bestD = d; } });
      const d = Math.hypot(p.x - it.screen.x, p.y - it.screen.y); if (d <= it.screen.r && d < bestD) { best = it; bestD = d; } });
    return best;
  }
  let down = null;
  document.addEventListener('pointerdown', e => { down = e.isPrimary ? {x: e.clientX, y: e.clientY, t: e.target} : null; }, {passive: true, capture: true});
  document.addEventListener('click', e => {
    if (e.target instanceof Element && e.target.closest('#skyTargets')) return; // keyboard activation of a target button
    if (!popup.hidden && !popup.contains(e.target)) close(false);
    if (e.defaultPrevented || e.button !== 0 || !enabled) return;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) return; // a drag or scroll, not a tap
    const t = e.target;
    if (!(t instanceof Element) || t.closest(BLOCK)) return;
    if (!(t === document.body || t === document.documentElement || t.closest('.hero') || t.closest('#journey'))) return;
    if (getSelection && String(getSelection()).length) return;
    const item = hitTest(e.clientX, e.clientY);
    if (item) open(item, item.button, {x: e.clientX, y: e.clientY});
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !popup.hidden) { e.preventDefault(); close(true); return; }
    if (!popup.hidden && e.key === 'Tab') { // keep Tab inside the small card while it is open
      const f = [...popup.querySelectorAll('button,a[href]')]; if (f.length === 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  layer.addEventListener('keydown', e => {
    const i = visible.findIndex(it => it.button === document.activeElement); if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % visible.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + visible.length) % visible.length;
    else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = visible.length - 1;
    if (j < 0) return;
    e.preventDefault(); visible[i].button.tabIndex = -1; visible[j].button.tabIndex = 0; visible[j].button.focus({preventScroll: true});
  });
  window.addEventListener('resize', () => { lastKey = ''; if (!popup.hidden) close(false); }, {passive: true});
  reduced.addEventListener?.('change', ev => { if (ev.matches) { stopGlow(); close(false); enabled = false; items.forEach(it => { it.button.hidden = true; }); glow.remove(); layer.remove(); } });

  // One cheap tick: the parallax transform each frame (two style writes), geometry <= 10 Hz.
  const tick = () => layout(performance.now());
  if (window.Elev8Motion?.add) window.Elev8Motion.add(tick, {fps: 30}); else setInterval(tick, 100);
  window.addEventListener('scroll', () => requestAnimationFrame(tick), {passive: true});
  tick();
  glowTimer = setTimeout(nextGlow, 1500);
  window.Elev8Constellations = {open: id => { const it = items.find(x => x.id === String(id)); if (it) open(it, it.button); return !!it; }, close: () => close(true),
    get visible() { return visible.map(it => it.id); }, get items() { return items.map(it => ({kind: it.kind, id: it.id, name: it.data.name})); }, get glowing() { return activeGlow?.id || null; }};
}

// Lazy start: after the first idle period (falls back to a timeout).
const kick = () => initConstellations();
if ('requestIdleCallback' in window) requestIdleCallback(kick, {timeout: 4000}); else setTimeout(kick, 1500);
