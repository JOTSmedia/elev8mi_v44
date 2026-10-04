// ELEV8MI v35 context-guard.js (drop-in, ES module). Owner: ELEV8MI Space Scene.
// John 2026-10-03 16:08: "i don't want the mobile version to degrade to 2d ever".
// So on ANY device a lost WebGL context is never answered with the 2D fallback
// and never with a reload:
//   webglcontextlost     -> preventDefault, pause that renderer, keep its canvas visible
//   webglcontextrestored -> rebuild that renderer, then resume
// Renderers covered:
//   * photo-motion.js (raw WebGL1 sky, canvas#photoMotion). Its own lost handler
//     (switches to data-photo-motion="fallback" + hides the canvas) is NOT
//     registered: the guard filters it out. On restore the guard disposes the old
//     instance (every listener / Elev8Motion subscriber it registered, its canvas,
//     its context) and re-runs photo-motion.js once into a fresh canvas that
//     takes the old canvas's exact DOM slot. Idempotent: one live instance, always.
//   * space-realism.js (three.js r169 atlas). three's own WebGLRenderer listeners
//     re-create all GPU state on restore (initGLContext: new properties, programs,
//     textures re-uploaded from the retained images, render targets re-allocated
//     lazily). The guard pauses its frame loop (via the hook) so the per-planet 2D
//     canvases keep showing the last frame, then forces a full relayout + frame.
// Creation failure: never reloads. photo-motion gets ONE delayed retry; if that
// also fails the page keeps its static photo plates (no GPU is available).
const STATE = {installed: false, entries: new Map(), log: [], restores: 0, photo: null, tracking: null, retried: false};
const PHOTO_SRC = 'photo-motion.js';
const isGLType = t => /^(webgl2?|experimental-webgl)$/.test(String(t));
const note = (msg, extra) => { STATE.log.push({t: Math.round(performance.now()), msg, ...extra}); if (STATE.log.length > 60) STATE.log.shift(); };

function scriptIsPhoto() {
  if (STATE.tracking) return true;
  const s = document.currentScript; return !!(s && s.src && s.src.includes(PHOTO_SRC));
}

function install() {
  if (STATE.installed) return; STATE.installed = true;
  const ET = EventTarget.prototype, addL = ET.addEventListener;
  // Record what photo-motion.js registers (so a rebuild can remove it all) and
  // drop its own webglcontextlost -> 2D fallback handler.
  ET.addEventListener = function (type, fn, opts) {
    if (scriptIsPhoto()) {
      if (type === 'webglcontextlost' && this instanceof HTMLCanvasElement) { note('photo: suppressed 2D-fallback lost handler'); return; }
      currentPhotoBag().listeners.push([this, type, fn, opts]);
    }
    return addL.call(this, type, fn, opts);
  };
  const proto = HTMLCanvasElement.prototype, getCtx = proto.getContext;
  proto.getContext = function (type, attrs) {
    const ctx = getCtx.call(this, type, attrs);
    if (!isGLType(type)) return ctx;
    const isPhoto = scriptIsPhoto();
    if (!ctx) { onCreationFailure(this, isPhoto ? 'photo' : 'other'); return ctx; }
    if (!STATE.entries.has(this)) {
      const entry = {canvas: this, gl: ctx, name: isPhoto ? 'photo' : 'gl', lost: false, renderer: null, onRestore: null, losses: 0, restores: 0};
      STATE.entries.set(this, entry);
      if (isPhoto) currentPhotoBag().canvas = this;
      addL.call(this, 'webglcontextlost', e => onLost(entry, e));
      addL.call(this, 'webglcontextrestored', () => onRestored(entry));
      addL.call(this, 'webglcontextcreationerror', e => onCreationFailure(this, entry.name, e.statusMessage));
    }
    return ctx;
  };
  // Elev8Motion.add subscribers registered by photo-motion.js are recorded too.
  const wrapMotion = m => {
    if (!m || m.__guarded) return; const add = m.add.bind(m);
    m.add = (fn, o) => { const off = add(fn, o); if (scriptIsPhoto()) currentPhotoBag().unsubs.push(off); return off; };
    m.__guarded = true;
  };
  wrapMotion(window.Elev8Motion);
  if (!window.Elev8Motion) document.addEventListener('DOMContentLoaded', () => wrapMotion(window.Elev8Motion), {once: true});
}

function currentPhotoBag() { return STATE.tracking || STATE.photo || (STATE.photo = {listeners: [], unsubs: [], canvas: null}); }

function onLost(entry, event) {
  if (entry.retired) return; // an old photo instance being freed on purpose
  event.preventDefault(); // ask the browser to restore this context
  entry.lost = true; entry.losses++;
  note(`${entry.name}: context lost`);
  // Canvas stays visible. three's atlas: the hook pauses frame(), the planet
  // canvases keep their last 2D copy. photo-motion: its render() would issue
  // calls into a dead context, so freeze its subscribers until the rebuild.
  if (entry.name === 'photo') { entry.canvas.style.transition = 'opacity .35s ease'; entry.canvas.style.opacity = '0'; pausePhoto(); }
  document.documentElement.dataset.glGuard = 'restoring';
}

function pausePhoto() { const bag = STATE.photo; if (!bag) return; bag.unsubs.forEach(off => { try { off(); } catch (_) {} }); bag.unsubs = []; }

function onRestored(entry) {
  if (entry.retired || !entry.lost) return;
  entry.lost = false; entry.restores++; STATE.restores++;
  note(`${entry.name}: context restored`);
  if (entry.name === 'photo') rebuildPhoto(entry);
  else if (entry.onRestore) { try { entry.onRestore(); } catch (e) { console.warn('context-guard: restore hook failed', e); } }
  if (![...STATE.entries.values()].some(e => e.lost)) document.documentElement.dataset.glGuard = 'ok';
}

let photoText = null;
async function photoSource() {
  if (photoText) return photoText;
  const tag = [...document.scripts].find(s => s.src.includes(PHOTO_SRC));
  photoText = await (await fetch(tag ? tag.src : `${PHOTO_SRC}?v=38`)).text();
  return photoText;
}

function disposePhoto(bag, keepCanvas) {
  // Every listener and Elev8Motion subscriber of the old instance goes, so its
  // closure (program, buffers, texture handles, plate copies) can be collected.
  bag.listeners.forEach(([t, type, fn, opts]) => { try { t.removeEventListener(type, fn, opts); } catch (_) {} });
  bag.unsubs.forEach(off => { try { off(); } catch (_) {} });
  bag.listeners = []; bag.unsubs = [];
  const old = bag.canvas;
  if (old) {
    const entry = STATE.entries.get(old); STATE.entries.delete(old);
    if (entry) { entry.retired = true; try { entry.gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (_) {} } // free the old context now
    if (!keepCanvas) old.remove();
  }
}

let rebuilding = null;
function rebuildPhoto(entry) {
  if (rebuilding) return rebuilding;
  rebuilding = (async () => {
    const old = STATE.photo; const slot = old?.canvas || entry.canvas;
    const text = await photoSource();
    disposePhoto(old, true);
    const bag = {listeners: [], unsubs: [], canvas: null};
    STATE.tracking = bag;
    try { new Function(text)(); } finally { STATE.tracking = null; }
    STATE.photo = bag;
    const fresh = bag.canvas;
    if (fresh && slot && slot !== fresh && slot.isConnected) {
      fresh.style.opacity = '0'; fresh.style.transition = 'opacity .35s ease';
      slot.replaceWith(fresh); // same DOM slot (constellation glow stays above it)
      requestAnimationFrame(() => requestAnimationFrame(() => { fresh.style.opacity = '1'; }));
    } else if (slot && slot !== fresh) slot.remove();
    note('photo: rebuilt');
  })().catch(e => { console.warn('context-guard: photo rebuild failed', e); }).finally(() => { rebuilding = null; });
  return rebuilding;
}

function onCreationFailure(canvas, name, why) {
  note(`${name}: context creation failed`, {why: why || ''});
  document.documentElement.dataset.glGuard = 'creation-failed';
  // Never reload. photo-motion: a single delayed retry with a fresh canvas.
  if (name === 'photo' && !STATE.retried) {
    STATE.retried = true;
    setTimeout(() => { if (!document.getElementById('photoMotion')) rebuildPhoto({canvas: null, name: 'photo'}); }, 1500);
  }
}

// init(): install the guard. Called once from index.html before photo-motion.js.
// init(rendererOrCanvas, {onRestore}): register a renderer (three.js WebGLRenderer
// or a canvas) and the function that resumes/rebuilds it after a restore.
export function init(rendererOrCanvas, options = {}) {
  install();
  if (rendererOrCanvas) {
    const canvas = rendererOrCanvas.domElement || rendererOrCanvas;
    let entry = STATE.entries.get(canvas);
    if (!entry && canvas instanceof HTMLCanvasElement) {
      // Context was created before install (should not happen with the hook order).
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); entry = STATE.entries.get(canvas);
      if (!entry && gl) { entry = {canvas, gl, name: 'gl', lost: false, losses: 0, restores: 0}; STATE.entries.set(canvas, entry);
        canvas.addEventListener('webglcontextlost', e => onLost(entry, e)); canvas.addEventListener('webglcontextrestored', () => onRestored(entry)); }
    }
    if (entry) { entry.name = options.name || entry.name; entry.renderer = rendererOrCanvas.domElement ? rendererOrCanvas : null; entry.onRestore = options.onRestore || null; }
  }
  return api;
}

const api = {
  init,
  // v35 (Web): forget a context its owner frees on purpose (space-realism's WebGL2 probe).
  release(canvas) { const e = STATE.entries.get(canvas); if (e) { e.retired = true; STATE.entries.delete(canvas); } },
  lost(canvasOrRenderer) { const c = canvasOrRenderer?.domElement || canvasOrRenderer; return !!STATE.entries.get(c)?.lost; },
  get entries() { return [...STATE.entries.values()].map(e => ({name: e.name, lost: e.lost, losses: e.losses, restores: e.restores, connected: e.canvas.isConnected, memory: e.renderer ? {...e.renderer.info.memory} : null})); },
  canvases(name) { return [...STATE.entries.values()].filter(e => !name || e.name === name).map(e => e.canvas); },
  contexts(name) { return [...STATE.entries.values()].filter(e => !name || e.name === name).map(e => e.gl); },
  renderer(name) { return [...STATE.entries.values()].find(e => e.name === name)?.renderer || null; },
  get restores() { return STATE.restores; },
  get photoInstance() { const b = STATE.photo; return b ? {listeners: b.listeners.length, subscribers: b.unsubs.length} : null; },
  get log() { return STATE.log.slice(); },
};
window.Elev8ContextGuard = api;
export default api;
