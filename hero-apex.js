// ELEV8MI v35 hero-apex.js (drop-in, ES module). Owner: ELEV8MI Space Scene.
// John: "the moon and sun should orbit above the logo in the middle of the top of
// the hero logo and underneath the bottom of the top nav pill- so the climax of
// the orbit should be centered horizontally and also vertically in between the
// bottom of the top nav and the top of the logo".
// Apex (page-top layout, document px):  x = logo centre,  y = (navPill.bottom + logo.top) / 2
// Clamp: a body's top edge stays >= navPill.bottom + MARGIN (radius-aware).
// The existing Moon arc (solar-system.js) and Sun arc (#horizonSun, same file)
// read this through two hook lines; their paths are not rewritten, only their
// apex: the Moon ellipse keeps its bottom (Earth-limb clip unchanged) and
// stretches up to the apex; the Sun keeps its horizon rise and climbs to it.
// Both bodies are DOM elements in the WebGL and 2D paths alike, so the same
// hooks serve both (space-realism.js only paints the Moon disc's pixels).
const MARGIN = 8;
const NAV_SEL = 'header .header-content';
const LOGO_SEL = '#heroLogo';
const A = {x: 0, y: 0, navBottom: 0, logoTop: 0, docX: 0, docY: 0, ready: false, sunGap: null, debug: false};

function sunRadius() { return Math.max(34, Math.min(62, innerWidth * .046)) / 2; } // = solar-system.js
function moonRadius() { const c = document.querySelector('.orbit-moon-disc'); return ((c && c.offsetWidth) || 58) / 2; }

function measure() {
  const nav = document.querySelector(NAV_SEL) || document.querySelector('header');
  const logo = document.querySelector(LOGO_SEL);
  if (!nav || !logo) { A.ready = false; return; }
  const n = nav.getBoundingClientRect(), l = logo.getBoundingClientRect();
  if (!l.width || !n.height) { A.ready = false; return; }
  const sx = scrollX, sy = scrollY;
  // A fixed/sticky header stays at its viewport position; a static one scrolls.
  let fixed = false; for (let e = nav; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') { fixed = true; break; } }
  A.navBottom = n.bottom + (fixed ? 0 : sy);       // document px at page top
  A.logoTop = l.top + sy;
  A.docX = l.left + sx + l.width / 2;
  A.docY = (A.navBottom + A.logoTop) / 2;
  A.ready = true; A.sunGap = null;
  window.dispatchEvent(new CustomEvent('elev8mi:hero-apex', {detail: snapshot()}));
  if (A.debug) drawCrosshair();
}
// Apex y for a body of radius r: never closer than MARGIN under the nav pill.
const apexYFor = r => Math.max(A.docY, A.navBottom + MARGIN + r);
function snapshot() { return {x: A.docX, y: A.docY, navBottom: A.navBottom, logoTop: A.logoTop, sunY: apexYFor(sunRadius()), moonY: apexYFor(moonRadius()), sunR: sunRadius(), moonR: moonRadius()}; }

let queued = 0;
const queue = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; measure(); }); };
addEventListener('resize', queue, {passive: true});
addEventListener('orientationchange', () => { queue(); setTimeout(queue, 350); }, {passive: true});
document.fonts?.ready.then(queue);
addEventListener('load', queue);
const logoImg = document.querySelector(LOGO_SEL);
if (logoImg && !logoImg.complete) logoImg.addEventListener('load', queue, {once: true});
if ('ResizeObserver' in window) { const ro = new ResizeObserver(queue); [document.querySelector(NAV_SEL), logoImg].forEach(e => e && ro.observe(e)); }
measure();

function drawCrosshair() {
  let el = document.getElementById('heroApexDebug');
  if (!el) { el = document.createElement('div'); el.id = 'heroApexDebug'; el.style.cssText = 'position:absolute;width:0;height:0;z-index:99999;pointer-events:none';
    el.innerHTML = '<i style="position:absolute;left:-30px;top:-1px;width:60px;height:2px;background:#f0f"></i><i style="position:absolute;left:-1px;top:-30px;width:2px;height:60px;background:#f0f"></i><i style="position:absolute;left:-6px;top:-6px;width:10px;height:10px;border:1px solid #0ff;border-radius:50%"></i>';
    document.body.append(el); }
  el.style.left = `${A.docX}px`; el.style.top = `${A.docY}px`;
}

window.Elev8HeroApex = {
  get ready() { return A.ready; },
  get apex() { return snapshot(); },
  recompute: measure,
  debug(on = true) { A.debug = on; if (on) drawCrosshair(); else document.getElementById('heroApexDebug')?.remove(); },
  // Moon (solar-system.js draw): root-local ellipse. Keeps the bottom (cy+ry,
  // near Earth's limb) and lifts the top (angle -90deg) to the apex.
  moonArc(cx, cy, rx, ry, rootTop, rootLeft) {
    if (!A.ready) return null;
    const rootDocTop = rootTop + scrollY, rootDocLeft = rootLeft + scrollX;
    // solar-system.js places the Moon button at (mx-22, my-22) while its disc is
    // 58/50 px wide, so the visible disc centre sits (r-22) px right of and below
    // (mx,my). Compensate so the VISIBLE Moon centre lands on the apex.
    const r = moonRadius(), off = r - 22;
    const top = apexYFor(r) - rootDocTop - off, bottom = cy + ry;
    if (!(bottom - top > 8)) return null;
    return {cx: A.docX - rootDocLeft - off, cy: (top + bottom) / 2, rx, ry: (bottom - top) / 2};
  },
  // Sun (#horizonSun): rise height above the horizon so the centre peaks at the
  // apex. Measured once at page top (horizon and apex share that frame) and kept
  // while scrolling, so the Sun still travels with the horizon.
  sunRise(horizon, radius) {
    if (!A.ready) return null;
    if (A.sunGap === null || scrollY < 1) A.sunGap = horizon - (apexYFor(radius) - scrollY);
    return Math.max(0, A.sunGap + radius);
  },
  // Sun horizontal position: apex x at azimuth .5, same east/west swing as before.
  sunLeft(azimuth) { return A.ready ? `${A.docX - scrollX + (azimuth - .5) * innerWidth}px` : null; },
};
export default window.Elev8HeroApex;
