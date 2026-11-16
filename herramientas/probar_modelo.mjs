// Prueba el modelo tal como lo usa la app: le pasa cada secuencia de LSC70 cuadro a cuadro, como si fuera la cámara.
// Uso: node herramientas/probar_modelo.mjs puntos.jsonl   (ojo: son los mismos datos del entrenamiento; sirve para comprobar el recorrido, no la precisión)
import fs from 'fs';
import { frameHands, Recognizer, Model } from '../reco.js';
const model = new Model(JSON.parse(fs.readFileSync(new URL('../senas/modelo.json', import.meta.url))));
const seq = new Map();
for (const line of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const r = JSON.parse(line), q = r.p.split('/'), mm = q[4].match(/(\d+)\D*\.jpg$/); if (!mm) continue;
  const key = q[1] + '/' + q[2] + '/' + q[3]; if (!seq.has(key)) seq.set(key, []);
  seq.get(key)[+mm[1] % 10] = frameHands((r.h || []).map(h => Array.from({ length: 21 }, (_, i) => ({ x: h[i * 3], y: h[i * 3 + 1], z: h[i * 3 + 2] }))), 4 / 3, null);
}
for (const step of [150, 250]) {
  let good = 0, wrong = 0, silent = 0, n = 0;
  for (const [key, fr] of seq) {
    if (n++ % 4) continue;
    const rec = new Recognizer([]); rec.model = model; const got = []; let t = 0;
    const feed = (h, ms) => { for (let e = t + ms; t < e; t += 33) { const r = rec.push(t, h || []); if (r) got.push(r.key); } };
    for (let k = 0; k < 6; k++) feed(fr[k], step); feed(fr[5], 700);          // la seña y un momento sosteniéndola
    const me = 'm:' + key.split('/')[2];
    if (!got.length) silent++; else if (got.at(-1) === me || got[0] === me) good++; else wrong++;
  }
  const tot = good + wrong + silent;
  console.log(`cada cuadro ${step} ms: acierta ${(100 * good / tot).toFixed(1)}% | se equivoca ${(100 * wrong / tot).toFixed(1)}% | no dice nada ${(100 * silent / tot).toFixed(1)}%`);
}
