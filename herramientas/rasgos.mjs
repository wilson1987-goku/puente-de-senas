// Genera los vectores de entrenamiento del modelo, con los mismos rasgos que usa la app (reco.js).
//   - Señas (positivos): puntos de manos de las imágenes de LSC70 (un JSON por línea: {p: ruta, h: [manos]}).
//   - "nada" (negativos): tramos de las grabaciones de LSC50 con manos en reposo, transiciones y otras señas,
//     para que el modelo aprenda a callar cuando lo que ve no es una de sus señas.
// Uso: node herramientas/rasgos.mjs puntos70.jsonl carpetaLSC50(con L/ y R/) salida
import fs from 'fs';
import { frameHands, segVec, VEC } from '../reco.js';
const [, , IN70, DIR50, OUT] = process.argv;
let seed = 12345; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
// Variación de una secuencia: giro, estiramiento, ruido y (opcional) espejo para personas zurdas.
function vary(frames, aspect, { rot = 0, sx = 1, noise = 0, mirror = false }) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return frames.map(hs => hs.map(lm => {
    const size = Math.hypot((lm[9].x - lm[0].x) * aspect, lm[9].y - lm[0].y);
    return lm.map(p => {
      let x = (p.x - 0.5) * aspect, y = p.y - 0.5; if (mirror) x = -x;
      const X = (x * c - y * s) * sx + gauss() * noise * size, Y = x * s + y * c + gauss() * noise * size;
      return { x: X / aspect + 0.5, y: Y + 0.5, z: p.z };
    });
  }));
}
const randAug = (wide, mirror) => ({ rot: (rnd() - 0.5) * (wide ? 1.2 : 0.5), sx: 0.9 + rnd() * 0.2, noise: 0.03, mirror });
const meta = [], vecs = [];
const add = (frames, aspect, m) => { const v = segVec(frames.map(hs => frameHands(hs, aspect, null))); if (v) { vecs.push(v); meta.push(m); } };

// ---------- positivos: LSC70 ----------
const seq = new Map();
for (const line of fs.readFileSync(IN70, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const r = JSON.parse(line); const q = r.p.split('/'), mm = q[4].match(/(\d+)\D*\.jpg$/); if (!mm) continue;
  const key = q[1] + '/' + q[2] + '/' + q[3]; if (!seq.has(key)) seq.set(key, []);
  seq.get(key)[+mm[1] % 10] = (r.h || []).map(h => Array.from({ length: 21 }, (_, i) => ({ x: h[i * 3], y: h[i * 3 + 1], z: h[i * 3 + 2] })));
}
// completa, sin el inicio, sin el final y la seña ya formada (sostenida)
const VAR = [[0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5], [0, 1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 5, 5], [4, 5, 5, 5, 5]];
for (const [key, fr] of seq) {
  const [sec, per, sign] = key.split('/');
  VAR.forEach((ix, vi) => {
    const f = ix.map(i => fr[i]).filter(Boolean); if (f.length < 5) return;
    add(f, 4 / 3, { per, sign, v: vi, a: 0 });
    add(vary(f, 4 / 3, randAug(false, false)), 4 / 3, { per, sign, v: vi, a: 1 });
    add(vary(f, 4 / 3, randAug(false, false)), 4 / 3, { per, sign, v: vi, a: 1 });
    add(vary(f, 4 / 3, randAug(false, true)), 4 / 3, { per, sign, v: vi, a: 2 });
  });
}
const nPos = vecs.length;

// ---------- negativos: LSC50 ----------
const MISMAS = new Set([1, 2, 3, 5, 30, 38]);        // buenos días/tardes/noches, nombre, hola, yo: también están en el modelo
function readCsv(f) {
  const m = new Map(); if (!fs.existsSync(f)) return m;
  for (const line of fs.readFileSync(f, 'utf8').trim().split('\n').slice(1)) {
    const c = line.split(',').map(Number); if (c.length < 64 || c.slice(1, 64).some(Number.isNaN)) continue;
    m.set(c[0], Array.from({ length: 21 }, (_, i) => ({ x: c[1 + i * 3], y: c[2 + i * 3], z: c[3 + i * 3] })));
  }
  return m;
}
for (let s = 0; s < 50; s++) for (let v = 0; v < 5; v++) for (let r = 0; r < 4; r++) {
  if (MISMAS.has(s)) continue;
  const id = [s, v, r].map(n => String(n).padStart(4, '0')).join('_'), L = readCsv(`${DIR50}/L/${id}.csv`), R = readCsv(`${DIR50}/R/${id}.csv`);
  const n = Math.max(-1, ...L.keys(), ...R.keys()) + 1; if (n < 12) continue;
  const fr = Array.from({ length: n }, (_, i) => [L.get(i), R.get(i)].filter(Boolean)), m = { per: 'V' + v, sign: 'nada' };
  for (let k = 0; k < 6; k++) {                       // tramos al azar: reposo, subida, otra seña, bajada
    const len = 8 + Math.floor(rnd() * Math.min(40, n - 8)), a = Math.floor(rnd() * (n - len)), ix = Array.from({ length: 6 }, (_, j) => a + Math.round(j * (len - 1) / 5));
    add(vary(ix.map(i => fr[i]), 16 / 9, randAug(true, rnd() < 0.5)), 16 / 9, { ...m, v: 0, a: 1 });
  }
  for (const i of [0, 1, n - 2, n - 1, Math.floor(rnd() * n), Math.floor(rnd() * n)]) {   // una postura quieta (reposo o instante cualquiera)
    add(vary([fr[i], fr[i], fr[i], fr[i], fr[i]], 16 / 9, randAug(true, rnd() < 0.5)), 16 / 9, { ...m, v: 5, a: 1 });
  }
}
const buf = new Float32Array(vecs.length * VEC); vecs.forEach((v, i) => buf.set(v, i * VEC));
fs.writeFileSync(OUT + '.f32', Buffer.from(buf.buffer)); fs.writeFileSync(OUT + '.json', JSON.stringify({ dim: VEC, meta }));
console.log('señas:', nPos, '| nada:', vecs.length - nPos, '| dim', VEC);
