"""Entrena el clasificador de Conuco: frase del agricultor -> categoría de la lista fija.
Modelo: TF-IDF de n-gramas de caracteres (2-4) + regresión logística. Se exporta a JSON para correr en el teléfono.
Uso:
  python3 modelo/entrenar.py                                  # entrena con frases sintéticas
  python3 modelo/entrenar.py frases_prueba.txt                # además evalúa con frases reales (categoria | frase)
  python3 modelo/entrenar.py --entrenar-con frases_validadas.txt   # reentrena sumando lo validado por técnicos (descargado del panel)"""
import json, random, re, sys, unicodedata
from pathlib import Path
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score

sys.path.insert(0, str(Path(__file__).parent))
import frases
from frases import INICIOS

# --cultivo cafe|maiz  (por defecto café)
CULTIVO = "cafe"
if "--cultivo" in sys.argv:
    i = sys.argv.index("--cultivo"); CULTIVO = sys.argv[i + 1]; del sys.argv[i:i + 2]
if CULTIVO == "maiz":
    SINTOMAS, SUJETOS, CONTEXTOS, PRUEBA = frases.SINTOMAS_MAIZ, frases.SUJETOS_MAIZ, frases.CONTEXTOS_MAIZ, frases.PRUEBA_MAIZ
else:
    SINTOMAS, SUJETOS, CONTEXTOS, PRUEBA = frases.SINTOMAS, frases.SUJETOS, frases.CONTEXTOS, frases.PRUEBA

random.seed(42)

def normalizar(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9ñ\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    # mismos arreglos de errores de voz que extract.js
    for mal, bien in [(r"\bmas ron\b", "marron"), (r"\bmar ron\b", "marron"), (r"\bvachac", "bachac"), (r"\bbroka\b", "broca")]:
        t = re.sub(mal, bien, t)
    return t

def generar(n_por_clase=260):
    X, y = [], []
    for clase, frases in SINTOMAS.items():
        for f in frases:  # cada frase base al menos una vez sola
            X.append(f); y.append(clase)
        for _ in range(n_por_clase):
            partes = [random.choice(INICIOS), random.choice(SUJETOS), random.choice(frases), random.choice(CONTEXTOS)]
            if random.random() < 0.15 and clase != "otro":  # a veces mencionan dos cosas de la misma clase
                partes.append("y " + random.choice(frases))
            X.append(" ".join(p for p in partes if p)); y.append(clase)
    return X, y

def leer_pares(ruta):
    pares = []
    for linea in Path(ruta).read_text(encoding="utf-8").splitlines():
        if "|" in linea:
            c, f = linea.split("|", 1); pares.append((f.strip(), c.strip()))
    return pares

args = sys.argv[1:]
extra, evaluacion = [], None
if "--entrenar-con" in args:
    i = args.index("--entrenar-con"); extra = leer_pares(args[i + 1]); del args[i:i + 2]
if args and Path(args[0]).exists():
    evaluacion = leer_pares(args[0])

X, y = generar()
for f, c in extra:          # lo validado por técnicos pesa más: se repite 3 veces
    for _ in range(3): X.append(f); y.append(c)
if extra: print(f"+ {len(extra)} frases validadas por técnicos agregadas al entrenamiento")
vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=2, sublinear_tf=True, preprocessor=normalizar)
Xv = vec.fit_transform(X)
clf = LogisticRegression(C=4.0, max_iter=2000)
clf.fit(Xv, y)

def evaluar(nombre, pares):
    if not pares: return None
    textos, reales = zip(*pares)
    proba = clf.predict_proba(vec.transform(textos))
    pred = clf.classes_[proba.argmax(1)]
    conf = proba.max(1)
    acc = accuracy_score(reales, pred)
    print(f"\n=== {nombre}: {len(pares)} frases · exactitud {acc:.0%} ===")
    for t, r, p, c in zip(textos, reales, pred, conf):
        marca = "OK " if r == p else "XX "
        print(f"{marca}{c:.2f}  real={r:<18} pred={p:<18} {t}")
    return acc

acc_prueba = evaluar("Prueba (frases escritas aparte, no usadas para entrenar)", PRUEBA)

# Frases de Gabi (formato: categoria | frase), si se pasan
acc_gabi = evaluar("Frases reales (hablante venezolana)", evaluacion) if evaluacion else None

# Exportar: vocabulario, idf, pesos (redondeados y podados) e interceptos
vocab = vec.vocabulary_
idx = sorted(vocab.items(), key=lambda kv: kv[1])
coef = clf.coef_
keep = np.where(np.abs(coef).max(0) >= 0.0)[0]
mapa_nuevo = {old: new for new, old in enumerate(keep)}
modelo = {
    "version": 1,
    "cultivo": CULTIVO,
    "tipo": "tfidf_char_wb_2_4 + logistic_regression",
    "clases": list(clf.classes_),
    "ngram": [2, 4],
    "vocab": {g: mapa_nuevo[i] for g, i in idx if i in mapa_nuevo},
    "idf": [round(float(vec.idf_[i]), 4) for i in keep],
    "coef": [[round(float(w), 3) for w in coef[c, keep]] for c in range(coef.shape[0])],
    "intercept": [round(float(b), 4) for b in clf.intercept_],
    "metricas": {"exactitud_prueba": acc_prueba, "exactitud_gabi": acc_gabi, "n_entrenamiento": len(X), "n_prueba": len(PRUEBA)},
    "nota": "Entrenado con frases sintéticas. Reentrenar con reportes reales confirmados por técnicos.",
}
salida = Path(__file__).parent.parent / ("modelo_maiz.json" if CULTIVO == "maiz" else "modelo_conuco.json")
salida.write_text(json.dumps(modelo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"\nModelo exportado: {salida} · {salida.stat().st_size/1024:.0f} KB · {len(keep)} rasgos · {len(X)} frases de entrenamiento")

# Casos de verificación para comparar Python vs JavaScript
casos = [t for t, _ in PRUEBA[:3]]
ver = {t: [round(float(p), 4) for p in clf.predict_proba(vec.transform([t]))[0]] for t in casos}
(Path(__file__).parent / f"verificacion_{CULTIVO}.json").write_text(json.dumps(ver, ensure_ascii=False), encoding="utf-8")
