// sidereal.js — ELEV8MI v33 extra (drop-in ES module, no dependencies).
//
// siderealAngle(date, lonDeg = -74.006) -> local sidereal angle in RADIANS, 0..2π.
//   The rotation angle of the sky about the celestial pole for an observer at
//   east longitude lonDeg (west negative; -74.006 = New York City).
//   Degrees: siderealAngleDeg(date, lonDeg) -> 0..360.  Hours: divide degrees by 15.
//
// Formula: IAU 1982 GMST (Meeus, Astronomical Algorithms, eq. 12.4), from the
// Julian date of the instant (UT; JS Date is UTC, UT1-UTC < 0.9 s is ignored):
//   GMST° = 280.46061837 + 360.98564736629·(JD − 2451545.0)
//           + 0.000387933·T² − T³/38 710 000,   T = (JD − 2451545.0)/36525
//   LST°  = GMST° + lonDeg   (normalized to 0..360, then radians)
// Accuracy ~0.1 s of time over 1900–2100, far beyond what the scene needs.
//
// Node check:  node sidereal.js   (compares against Meeus examples 12.a/12.b)

const TAU = Math.PI * 2;

export function julianDate(date) {
  return (date instanceof Date ? date.getTime() : +date) / 86400000 + 2440587.5;
}

export function gmstDeg(date) {
  const d = julianDate(date) - 2451545.0, T = d / 36525;
  const g = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000;
  return ((g % 360) + 360) % 360;
}

export function siderealAngleDeg(date = new Date(), lonDeg = -74.006) {
  return (((gmstDeg(date) + lonDeg) % 360) + 360) % 360;
}

export function siderealAngle(date = new Date(), lonDeg = -74.006) {
  const r = siderealAngleDeg(date, lonDeg) * Math.PI / 180;
  return r >= TAU ? r - TAU : r;
}

export default siderealAngle;
