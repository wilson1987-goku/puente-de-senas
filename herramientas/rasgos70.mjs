// Convierte los puntos de manos extraídos de LSC70 (un JSON por línea: {p: ruta, h: [manos]}) en los
// mismos vectores que usa la app, para entrenar el modelo. Uso: node herramientas/rasgos70.mjs puntos.jsonl salida
import fs from 'fs';
import { frameHands, segVec, VEC } from '../reco.js';
const [, , IN, OUT] = process.argv, ASPECT = 4 / 3;
const seq = new Map();
for (const line of fs.readFileSync(IN, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const r = JSON.parse(line); const q = r.p.split('/'), key = q[1] + '/' + q[2] + '/' + q[3], mm = q[4].match(/(\d+)\D*\.jpg$/); if (!mm) continue; const k = +mm[1] % 10;
  if (!seq.has(key)) seq.set(key, []);
  seq.get(key)[k] = frameHands((r.h || []).map(h => Array.from({ length: 21 }, (_, i) => ({ x: h[i * 3], y: h[i * 3 + 1], z: h[i * 3 + 2] }))), ASPECT, null);
}
// Variantes de cada secuencia: completa, sin el inicio, sin el final y la seña ya formada (sostenida).
const VAR = [[0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5], [0, 1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 5, 5], [4, 5, 5, 5, 5]];
const meta = [], vecs = [];
for (const [key, fr] of seq) {
  const [sec, per, sign] = key.split('/');
  VAR.forEach((ix, vi) => {
    const f = ix.map(i => fr[i]).filter(Boolean); if (f.length < 5) return;
    const v = segVec(f); if (!v) return;
    meta.push({ sec, per, sign, v: vi }); vecs.push(v);
  });
}
const buf = new Float32Array(vecs.length * VEC); vecs.forEach((v, i) => buf.set(v, i * VEC));
fs.writeFileSync(OUT + '.f32', Buffer.from(buf.buffer)); fs.writeFileSync(OUT + '.json', JSON.stringify({ dim: VEC, meta }));
console.log('secuencias', seq.size, 'vectores', vecs.length, 'dim', VEC);
