// Mide qué tan bien reconoce la app las señas del banco LSC50, dejando una persona fuera cada vez.
// Uso: node herramientas/evaluar.mjs <carpeta con L/ y R/ de HANDS_LANDMARKS> [--banco salida.json]
import fs from 'fs';
import { frameHands, segVec, trimActive, threshold, classify, Recognizer, W } from '../reco.js';
for (const a of process.argv) { const m = /^--(\w+)=([\d.]+)$/.exec(a); if (m && m[1] in W) W[m[1]] = +m[2]; }
const NOFACE = process.argv.includes('--sincara');
const DIR = process.argv[2], outIdx = process.argv.indexOf('--banco');
const NAMES = JSON.parse(fs.readFileSync(new URL('../senas/indice.json', import.meta.url))).senas.map(s => s.n).slice(0, 50);
const ASPECT = 16 / 9, FPS = 24;
function readCsv(f) {
  const m = new Map(); if (!fs.existsSync(f)) return m;
  for (const line of fs.readFileSync(f, 'utf8').trim().split('\n').slice(1)) {
    const c = line.split(',').map(Number); if (c.length < 64 || c.slice(1).some(Number.isNaN)) continue;
    m.set(c[0], Array.from({ length: (c.length - 1) / 3 }, (_, i) => ({ x: c[1 + i * 3], y: c[2 + i * 3], z: c[3 + i * 3] })));
  }
  return m;
}
function clip(s, v, r) {
  const id = [s, v, r].map(n => String(n).padStart(4, '0')).join('_'), L = readCsv(`${DIR}/L/${id}.csv`), R = readCsv(`${DIR}/R/${id}.csv`), B = readCsv(`${DIR}/B/${id}.csv`);
  const n = Math.max(-1, ...L.keys(), ...R.keys()) + 1, fr = [];
  for (let i = 0; i < n; i++) {
    const b = B.get(i), face = b && !NOFACE ? { x: b[0].x, y: b[0].y, eye: Math.hypot((b[2].x - b[5].x) * ASPECT, b[2].y - b[5].y) } : null;
    fr.push(frameHands([L.get(i), R.get(i)].filter(Boolean), ASPECT, face));
  }
  return fr;
}
const data = [];   // {s, v, r, frames, vec}
for (let s = 0; s < 50; s++) for (let v = 0; v < 5; v++) for (let r = 0; r < 4; r++) {
  const frames = clip(s, v, r), act = trimActive(frames), vec = act && segVec(act);
  data.push({ s, v, r, frames, vec, len: act ? act.length : 0 });
}
const ok = data.filter(d => d.vec);
console.log('grabaciones:', data.length, '| con seña utilizable:', ok.length, '| por persona:', [0, 1, 2, 3, 4].map(v => ok.filter(d => d.v === v).length).join(' '));
console.log('duración media del tramo activo (cuadros):', (ok.reduce((a, d) => a + d.len, 0) / ok.length).toFixed(1));
const bankOf = list => { const b = []; for (let s = 0; s < 50; s++) { const samples = list.filter(d => d.s === s).map(d => d.vec); if (samples.length >= 3) b.push({ key: String(s), name: NAMES[s], samples, th: threshold(samples) }); } return b; };

// 1) Tramo ideal (ya recortado): ¿acierta la seña de una persona que no está en el banco?
let hit = 0, miss = 0, none = 0; const conf = {};
for (let v = 0; v < 5; v++) {
  const bank = bankOf(ok.filter(d => d.v !== v));
  for (const d of ok.filter(d => d.v === v)) {
    const r = classify(d.vec, bank, 1e9, 1);        // sin rechazo: el más cercano
    if (r.s.key === String(d.s)) hit++; else { miss++; const k = NAMES[d.s] + ' → ' + r.s.name; conf[k] = (conf[k] || 0) + 1; }
  }
}
console.log(`\n1) Más cercano, persona nueva: ${hit}/${hit + miss} = ${(100 * hit / (hit + miss)).toFixed(1)}%`);
console.log('   confusiones más frecuentes:', Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} (${n})`).join('; '));

{ // diagnóstico: acierto por persona, y dentro de la misma persona (dejando fuera una repetición)
  const per = [0, 1, 2, 3, 4].map(v => { const bank = bankOf(ok.filter(d => d.v !== v)), mine = ok.filter(d => d.v === v); return Math.round(100 * mine.filter(d => classify(d.vec, bank, 1e9, 1).s.key === String(d.s)).length / mine.length); });
  let h = 0, n = 0; for (let v = 0; v < 5; v++) for (let r = 0; r < 4; r++) { const bank = bankOf(ok.filter(d => d.v === v && d.r !== r)); if (!bank.length) continue; for (const d of ok.filter(d => d.v === v && d.r === r)) { n++; if (classify(d.vec, bank, 1e9, 1).s.key === String(d.s)) h++; } }
  const side = [0, 1, 2, 3, 4].map(v => { const m = ok.filter(d => d.v === v); let L = 0; for (const d of m) { const xs = d.frames.flat().map(h => h.fx).filter(x => x != null); if (xs.reduce((a, b) => a + b, 0) / (xs.length || 1) > 0) L++; } return Math.round(100 * L / m.length); });
  console.log('   por persona (% acierto):', per.join(' '), '| misma persona, otra repetición:', (100 * h / n).toFixed(1) + '%', '| % de clips con manos a la derecha de la nariz:', side.join(' '));
}
if (process.argv.includes('--rapido')) process.exit(0);
// 2) En continuo, como en la app: se le pasa la grabación completa (con reposo) cuadro a cuadro.
for (const factor of [0.8, 1, 1.2]) {
  let good = 0, wrong = 0, silent = 0, extra = 0, tot = 0;
  for (let v = 0; v < 5; v++) {
    const bank = bankOf(ok.filter(d => d.v !== v)), rec = new Recognizer(bank, { factor });
    for (const d of ok.filter(d => d.v === v)) {
      rec.reset(); const got = [];
      d.frames.forEach((h, i) => { const r = rec.push(i * 1000 / FPS, h); if (r) got.push(r.key); });
      for (let i = 0; i < 20; i++) { const r = rec.push((d.frames.length + i) * 1000 / FPS, d.frames.at(-1)); if (r) got.push(r.key); }
      tot++; const me = String(d.s);
      if (!got.length) silent++; else if (got[0] === me && got.length === 1) good++; else if (got.includes(me)) { good++; extra++; } else wrong++;
    }
  }
  console.log(`2) Continuo, exigencia ${factor}: acierta ${(100 * good / tot).toFixed(1)}% (con seña de más: ${(100 * extra / tot).toFixed(1)}%) | se equivoca ${(100 * wrong / tot).toFixed(1)}% | no dice nada ${(100 * silent / tot).toFixed(1)}%`);
}
if (outIdx > 0) {
  const bank = bankOf(ok).map(b => ({ n: b.name, th: +b.th.toFixed(3), s: b.samples.map(x => Array.from(x, n => Math.round(n * 100))) }));
  fs.writeFileSync(process.argv[outIdx + 1], JSON.stringify({ fuente: 'LSC50 (CC BY 4.0)', escala: 100, senas: bank }));
  console.log('banco guardado:', bank.length, 'señas,', (fs.statSync(process.argv[outIdx + 1]).size / 1e6).toFixed(2), 'MB');
}
