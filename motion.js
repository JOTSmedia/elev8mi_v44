(() => {
  'use strict';
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const subscribers = new Map();
  function renderAll(dt) {
    subscribers.forEach((entry, render) => {
      entry.elapsed = dt === 0 ? 0 : entry.elapsed + dt;
      if (dt === 0 || entry.elapsed >= entry.interval) {
        try { render(time, entry.elapsed); }
        catch (error) { subscribers.delete(render); console.error('An optional animation stopped:', error); }
        entry.elapsed = 0;
      }
    });
  }
  let reduced = preference.matches;
  let bootHold = !!window.Elev8Boot?.hold;
  let time = 0, previous = 0, frame = 0;

  function tick(now) {
    frame = 0;
    if (reduced || bootHold || document.hidden) return;
    if (!previous) previous = now;
    const elapsed = now - previous;
    if (elapsed > 0) {
      const dt = Math.min(.1, elapsed / 1000);
      previous = now;
      time += dt;
      renderAll(dt);
    }
    frame = requestAnimationFrame(tick);
  }
  function synchronize() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previous = 0;
    const stopped = reduced || bootHold || document.hidden;
    document.documentElement.dataset.motion = stopped ? 'paused' : 'playing';
    window.dispatchEvent(new CustomEvent('elev8mi:motion', {detail:{paused:stopped}}));
    if (!bootHold) renderAll(0);
    if (!stopped) frame = requestAnimationFrame(tick);
  }
  window.Elev8Motion = {
    add(render, {fps = 0} = {}) { subscribers.set(render, {interval: fps > 0 ? 1/fps : 0, elapsed:0}); if (!bootHold) render(time, 0); return () => subscribers.delete(render); },
    releaseBoot() {
      if (!bootHold) return;
      bootHold = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0; previous = 0;
      const stopped = reduced || document.hidden;
      document.documentElement.dataset.motion = stopped ? 'paused' : 'playing';
      window.dispatchEvent(new CustomEvent('elev8mi:motion', {detail:{paused:stopped}}));
      if (!stopped) frame = requestAnimationFrame(tick);
    },
    get paused() { return reduced || bootHold || document.hidden; },
    get bootHeld() { return bootHold; },
    get time() { return time; }
  };
  preference.addEventListener('change', event => { reduced = event.matches; synchronize(); });
  document.addEventListener('visibilitychange', synchronize);
  synchronize();
})();
