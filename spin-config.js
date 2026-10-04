// spin-config.js — ELEV8MI v33 extra (drop-in ES module, no dependencies).
//
// SPIN[name] = { periodSec, dir }
//   periodSec: seconds of SCENE time (window.Elev8Motion / elev8miCelestial.time)
//              for one full axial turn, always within 40–120 s.
//   dir:       1 = prograde, -1 = retrograde (Venus, Uranus).
// Names match solar-system.js `planets` / button[data-planet] and the 'Moon'
// key used by space-realism.js TURN; 'Sun' is included for completeness.
//
// Real sidereal rotation periods (hours; NASA/NSSDCA fact sheets):
//   Jupiter   9.925   (System III)        Saturn  10.656 (System III)
//   Neptune  16.11                        Uranus  17.24  (retrograde)
//   Earth    23.9345                      Mars    24.6229
//   Sun     609.12    (25.38 d, Carrington sidereal)
//   Moon    655.72    (27.32 d, synchronous) Mercury 1407.6
//   Venus  5832.5     (243.0 d, retrograde)
//
// Mapping (monotonic, logarithmic): with Pmin = 9.925 h (Jupiter) and
// Pmax = 5832.5 h (Venus),
//   periodSec = 40 + 80 · ln(P / Pmin) / ln(Pmax / Pmin)
// so the fastest real rotator turns once per 40 s and the slowest once per
// 120 s; ordering of real periods is preserved exactly (rounded to 0.1 s).
// Result: Jupiter 40.0, Saturn 40.9, Neptune 46.1, Uranus 46.9, Earth 51.0,
// Mars 51.4, Sun 91.7, Moon 92.6, Mercury 102.2, Venus 120.0.

export const REAL_HOURS = {
  Sun: 609.12, Mercury: 1407.6, Venus: 5832.5, Earth: 23.9345, Moon: 655.72,
  Mars: 24.6229, Jupiter: 9.925, Saturn: 10.656, Uranus: 17.24, Neptune: 16.11,
};
const RETROGRADE = new Set(['Venus', 'Uranus']);
export const MIN_SEC = 40, MAX_SEC = 120;
const hours = Object.values(REAL_HOURS), PMIN = Math.min(...hours), PMAX = Math.max(...hours);

export function scenePeriod(realHours) {
  const t = Math.log(realHours / PMIN) / Math.log(PMAX / PMIN);
  return Math.round((MIN_SEC + (MAX_SEC - MIN_SEC) * Math.min(1, Math.max(0, t))) * 10) / 10;
}

export const SPIN = Object.freeze(Object.fromEntries(Object.entries(REAL_HOURS).map(
  ([name, h]) => [name, Object.freeze({periodSec: scenePeriod(h), dir: RETROGRADE.has(name) ? -1 : 1})])));

// v33 hook shape: window.Elev8SpinTable = {Name: signedSeconds} (negative =
// retrograde), read by space-realism.js (TURN, line ~54) and planet-spin.js
// (line ~62). Earth/Sun entries are harmless there (neither file spins them).
export function toSpinTable(spin = SPIN) {
  return Object.fromEntries(Object.entries(spin).map(([n, s]) => [n, s.periodSec * s.dir]));
}

export default SPIN;
