// Reconocimiento de señas a partir de los puntos de las manos (21 puntos por mano, de MediaPipe).
// Lo usan la app (index.html) y los scripts de entrenamiento y evaluación (herramientas/).
export const T = 8, HAND = 70, VEC = T * HAND * 2;
// Pesos de cada parte del vector (ajustados con herramientas/evaluar.mjs).
export const W = { shape: 0.5, traj: 0.6, inter: 0.4, loc: 0.5, flag: 2.5 };

// Una mano detectada -> forma normalizada (sin posición ni tamaño) + dónde está y qué tan grande se ve.
// face (opcional): { x, y, eye } = nariz y distancia entre los ojos, en coordenadas de imagen (0 a 1).
export function handFeat(lm, aspect, face) {
  const w = lm[0], sc = Math.hypot((lm[9].x - w.x) * aspect, lm[9].y - w.y) || 1e-6, v = new Float32Array(63);
  for (let i = 0; i < 21; i++) { v[i * 3] = (lm[i].x - w.x) * aspect / sc; v[i * 3 + 1] = (lm[i].y - w.y) / sc; v[i * 3 + 2] = (lm[i].z || 0) * aspect / sc * 0.5; }
  const h = { v, x: w.x * aspect, y: w.y, sc, fx: null, fy: null };
  if (face && face.eye > 1e-4) { const c = lm[9]; h.fx = (c.x - face.x) * aspect / face.eye; h.fy = (c.y - face.y) / face.eye; }   // centro de la palma respecto a la nariz
  return h;
}
export const frameHands = (lms, aspect, face) => lms.slice(0, 2).map(lm => handFeat(lm, aspect, face));

// Sigue cada mano a lo largo de los cuadros (para no confundirlas cuando una desaparece un instante).
function tracks(frames) {
  const tr = [[], []], last = [null, null], d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const hs of frames) {
    let a = null, b = null;
    if (hs.length >= 2) {
      const [p, q] = hs[0].x <= hs[1].x ? [hs[0], hs[1]] : [hs[1], hs[0]];
      if (last[0] && last[1] && d(p, last[1]) + d(q, last[0]) < d(p, last[0]) + d(q, last[1])) { a = q; b = p; } else { a = p; b = q; }
    } else if (hs.length === 1) {
      const h = hs[0];
      if (!last[0] && !last[1]) a = h;
      else if (last[0] && last[1]) { if (d(h, last[0]) <= d(h, last[1])) a = h; else b = h; }
      else { const k = last[0] ? 0 : 1; if (d(h, last[k]) < 3.5 * h.sc) (k ? (b = h) : (a = h)); else (k ? (a = h) : (b = h)); }
    }
    tr[0].push(a); tr[1].push(b); if (a) last[0] = a; if (b) last[1] = b;
  }
  return tr;
}
function stats(t) {
  const p = t.filter(Boolean); if (!p.length) return null;
  let path = 0; for (let i = 1; i < p.length; i++) path += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y) / p[i].sc;
  const m = k => p.reduce((s, h) => s + h[k], 0) / p.length;
  return { n: p.length, path, x: m('x'), y: m('y'), sc: m('sc') };
}
// Resume un tramo de cuadros en un vector fijo. La mano que descansa quieta y abajo no cuenta.
export function segVec(frames) {
  if (frames.length < 5) return null;
  const tr = tracks(frames), st = tr.map(stats), need = frames.length * 0.5;
  const okT = [0, 1].filter(k => st[k] && st[k].n >= need); if (!okT.length) return null;
  const dom = okT.length === 1 ? okT[0] : (st[0].y <= st[1].y ? 0 : 1), oth = 1 - dom;
  const both = okT.length === 2 && (st[oth].path > 1.2 || st[oth].y - st[dom].y < 2.5 * st[dom].sc);
  const order = both ? (st[0].x <= st[1].x ? [0, 1] : [1, 0]) : [dom];
  const out = new Float32Array(VEC), N = frames.length;
  for (let k = 0; k < T; k++) {
    const c = Math.round(k * (N - 1) / (T - 1));
    const pick = t => { for (let r = 0; r <= 2; r++) for (const i of [c - r, c + r]) if (t[i]) return t[i]; return null; };
    const hs = order.map(i => pick(tr[i]));
    order.forEach((ti, s) => {
      const h = hs[s], o = (k * 2 + s) * HAND; if (!h) return;
      for (let i = 0; i < 63; i++) out[o + i] = h.v[i] * W.shape;
      out[o + 63] = (h.x - st[ti].x) / st[ti].sc * W.traj; out[o + 64] = (h.y - st[ti].y) / st[ti].sc * W.traj;
      if (s === 1 && hs[0]) { out[o + 65] = (h.x - hs[0].x) / st[ti].sc * W.inter; out[o + 66] = (h.y - hs[0].y) / st[ti].sc * W.inter; }
      if (h.fx != null) { out[o + 67] = h.fx * W.loc; out[o + 68] = h.fy * W.loc; }
      out[o + 69] = W.flag;
    });
  }
  return out;
}
// Quita el reposo del inicio y del final de una grabación (las manos vuelven al punto de partida).
export function trimActive(frames) {
  const tr = tracks(frames), first = tr.map(t => t.find(Boolean));
  const act = frames.map((_, i) => [0, 1].some(k => tr[k][i] && first[k] && Math.hypot(tr[k][i].x - first[k].x, tr[k][i].y - first[k].y) > 1.5 * first[k].sc));
  const a = act.indexOf(true), b = act.lastIndexOf(true);
  return a < 0 || b - a < 5 ? null : frames.slice(Math.max(0, a - 1), b + 2);
}
export function dist(a, b) { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s / T); }
export function threshold(samples, lo = 0.9, hi = 2.6) {
  let mx = 0; for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) mx = Math.max(mx, dist(samples[i], samples[j]));
  return Math.min(hi, Math.max(lo, mx * 1.2));
}
// bank: [{key, name, samples:[Float32Array], th}]. Devuelve la seña más cercana o null si no hay una clara.
export function classify(vec, bank, factor = 1, ratio = 0.9) {
  let best = null, second = Infinity;
  for (const s of bank) {
    let d = Infinity; for (const x of s.samples) { const q = dist(vec, x); if (q < d) d = q; }
    if (!best || d < best.d) { if (best) second = best.d; best = { s, d }; } else if (d < second) second = d;
  }
  if (!best || best.d > best.s.th * factor) return null;
  if (second < Infinity && best.d > second * ratio) return null;
  return best;
}
// Modelo entrenado (red pequeña de una capa oculta) con el banco LSC70: abecedario, números y diez palabras.
const NOMBRE = { NN: 'Ñ', MIL: 'mil', MILLON: 'millón', ANNOS: 'años', BUENAS: 'buenas', DIAS: 'días', TARDES: 'tardes', NOCHES: 'noches', GUSTAR: 'gustar', HOLA: 'hola', LICOR: 'licor', NOMBRE: 'nombre', YO: 'yo' };
export class Model {
  constructor(j) {
    const f = (a, s) => Float32Array.from(a, x => x / s);
    this.cols = j.cols; this.mu = f(j.mu, 1000); this.sd = f(j.sd, 1000); this.h = j.h; this.n = j.cols.length;
    this.W1 = f(j.W1, j.esc); this.b1 = f(j.b1, j.esc); this.W2 = f(j.W2, j.esc); this.b2 = f(j.b2, j.esc);
    this.signs = j.clases.map(c => ({ key: 'm:' + c, name: NOMBRE[c] || c }));
    this.cen = j.cen ? f(j.cen, j.escCen) : null; this.rad = j.rad || null;
  }
  // Devuelve la seña más probable y su probabilidad (0 a 1).
  predict(vec) {
    const { n, h, cols, mu, sd, W1, b1, W2, b2 } = this, z = new Float32Array(n), a = new Float32Array(h), k = this.signs.length;
    for (let i = 0; i < n; i++) z[i] = (vec[cols[i]] - mu[i]) / sd[i];
    for (let j = 0; j < h; j++) { let t = b1[j]; const o = j * n; for (let i = 0; i < n; i++) t += W1[o + i] * z[i]; a[j] = t > 0 ? t : 0; }
    let best = 0, bv = -Infinity, mx = -Infinity; const out = new Float32Array(k);
    for (let c = 0; c < k; c++) { let t = b2[c]; const o = c * h; for (let j = 0; j < h; j++) t += W2[o + j] * a[j]; out[c] = t; if (t > bv) { bv = t; best = c; } if (t > mx) mx = t; }
    let sum = 0; for (let c = 0; c < k; c++) sum += Math.exp(out[c] - mx);
    let far = 0;                                       // qué tan lejos está de los ejemplos de esa seña (1 = en el borde)
    if (this.cen) { let d = 0; const o = best * n; for (let i = 0; i < n; i++) { const e = z[i] - this.cen[o + i]; d += e * e; } far = Math.sqrt(d) / this.rad[best]; }
    return { s: this.signs[best], p: 1 / sum, far };
  }
}
// Reconocedor continuo: prueba ventanas de varias duraciones que terminan "ahora".
export class Recognizer {
  constructor(bank, opts = {}) { this.bank = bank; this.model = null; this.o = { wins: [800, 1200, 1700, 2300], every: 200, need: 2, needModel: 4, factor: 1, pmin: 0.9, far: 1.05, ...opts }; this.reset(); }
  reset() { this.buf = []; this.cand = null; this.n = 0; this.last = null; this.lastCheck = -1e9; this.seen = -1e9; this.pending = null; }
  // t en milisegundos; hands = frameHands(...). Devuelve la seña reconocida en este instante, o null.
  // this.pending = { s, n, need } mientras una seña se está confirmando (para mostrar el avance).
  push(t, hands) {
    const o = this.o, maxW = o.wins[o.wins.length - 1];
    if (hands.length) this.seen = t;
    this.buf.push({ t, h: hands }); while (this.buf.length && this.buf[0].t < t - maxW) this.buf.shift();
    if (t - this.seen > 700) { this.last = null; this.cand = null; this.n = 0; this.buf = []; this.pending = null; return null; }
    if (t - this.lastCheck < o.every || (!this.bank.length && !this.model)) return null; this.lastCheck = t;
    let best = null, mb = null, votes = 0, wins = 0;
    for (const w of o.wins) {
      const fr = this.buf.filter(b => b.t >= t - w); if (fr.length < 6 || fr[0].t > t - w * 0.8) continue;
      const withH = fr.filter(b => b.h.length); if (withH.length < fr.length * 0.7) continue;
      const v = segVec(withH.map(b => b.h)); if (!v) continue;
      const r = this.bank.length ? classify(v, this.bank, o.factor) : null; if (r && (!best || r.d / r.s.th < best.d / best.s.th)) best = r;
      if (this.model) { const m = this.model.predict(v); wins++; if (m.s.key !== 'm:nada' && m.far <= o.far) { votes++; if (!mb || m.p > mb.p) mb = m; } }
    }
    // Las señas enseñadas por la persona mandan. Si no hay ninguna clara, decide el modelo, pero solo cuando está
    // seguro y la mayoría de las ventanas ve una seña (y no "nada").
    if (!best && mb && votes * 2 >= wins && mb.p >= Math.min(0.985, 1 - (1 - o.pmin) * o.factor)) best = mb;
    if (!best) { this.cand = null; this.n = 0; this.pending = null; return null; }
    if (this.cand === best.s.key) this.n++; else { this.cand = best.s.key; this.n = 1; }
    const need = best.p != null ? o.needModel : o.need;       // al modelo se le pide más tiempo sosteniendo la seña
    if (this.last === best.s.key) { this.pending = null; return null; }
    this.pending = { s: best.s, n: this.n, need };
    if (this.n >= need) { this.last = best.s.key; this.pending = null; return best.s; }
    return null;
  }
}
