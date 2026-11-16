# Entrena el modelo de la cámara con los vectores de herramientas/rasgos.mjs.
#   python3 herramientas/entrenar.py datos            -> mide con personas que el modelo no vio
#   python3 herramientas/entrenar.py datos --final senas/modelo.json   -> entrena con todo y guarda el modelo
import json, sys, collections, warnings
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import GroupKFold
warnings.filterwarnings('ignore')
B = sys.argv[1]
M = json.load(open(B + '.json')); dim = M['dim']; meta = M['meta']
X = np.fromfile(B + '.f32', dtype=np.float32).reshape(-1, dim)
y = np.array([m['sign'] for m in meta]); g = np.array([m['per'] for m in meta]); aug = np.array([m['a'] for m in meta])
keep = X.std(0) > 1e-6
mu, sd = X.mean(0), X.std(0) + 1e-3
Z = ((X - mu) / sd)[:, keep]
print('vectores', X.shape, '| clases', len(set(y)), '| nada:', int((y == 'nada').sum()), flush=True)
H = 192
mk = lambda it: MLPClassifier((H,), alpha=2e-3, batch_size=256, max_iter=it, random_state=0)
if '--final' not in sys.argv:
    pred = np.empty(len(y), dtype=object); conf = np.zeros(len(y))
    for tr, te in GroupKFold(3).split(Z, y, g):
        m = mk(25).fit(Z[tr], y[tr]); P = m.predict_proba(Z[te]); pred[te] = m.classes_[P.argmax(1)]; conf[te] = P.max(1)
        print('  parte lista', flush=True)
    pos = (y != 'nada') & (aug == 0); neg = y == 'nada'; ok = pred == y
    print('Señas de personas nuevas (sin variaciones): acierta %.1f%%' % (100 * ok[pos].mean()))
    for th in (0.5, 0.8, 0.9, 0.95):
        s = conf >= th; said = s & (pred != 'nada')
        print('  confianza >= %.2f | seña real: la dice bien %.1f%%, la dice mal %.1f%%, calla %.1f%% | cuando NO hay seña: inventa una %.1f%%' % (
            th, 100 * (said & ok)[pos].mean(), 100 * (said & ~ok)[pos].mean(), 100 * (~said)[pos].mean(), 100 * said[neg].mean()))
    per = {c: ok[pos & (y == c)].mean() for c in sorted(set(y[pos]))}
    print('  por seña:', ' '.join(f'{c}:{v*100:.0f}' for c, v in sorted(per.items(), key=lambda t: t[1])))
    cf = collections.Counter((a, b) for a, b in zip(y[pos], pred[pos]) if a != b)
    print('  confusiones:', '; '.join(f'{a}→{b} ({n})' for (a, b), n in cf.most_common(14)))
else:
    m = mk(40).fit(Z, y)
    q = lambda a, s: np.round(a * s).astype(int).ravel().tolist()
    out = {'dim': int(dim), 'cols': np.where(keep)[0].tolist(), 'mu': q(mu[keep], 1000), 'sd': q(sd[keep], 1000), 'h': H,
           'clases': m.classes_.tolist(), 'W1': q(m.coefs_[0].T, 500), 'b1': q(m.intercepts_[0], 500), 'W2': q(m.coefs_[1].T, 500), 'b2': q(m.intercepts_[1], 500), 'esc': 500}
    json.dump(out, open(sys.argv[sys.argv.index('--final') + 1], 'w'), separators=(',', ':'))
    print('modelo guardado; acierto sobre los datos de entrenamiento: %.1f%%' % (100 * (m.predict(Z) == y).mean()))
    # Filtro de "esto no se parece a nada conocido": centro de cada seña y distancia que cubre al 90% de sus ejemplos.
    cen = np.array([Z[y == c].mean(0) for c in m.classes_]); rad = [float(np.percentile(np.linalg.norm(Z[y == c] - cen[i], axis=1), 90)) for i, c in enumerate(m.classes_)]
    out['cen'] = q(cen, 200); out['rad'] = [round(r, 2) for r in rad]; out['escCen'] = 200
    json.dump(out, open(sys.argv[sys.argv.index('--final') + 1], 'w'), separators=(',', ':'))
