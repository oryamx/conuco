"""Genera reportes SINTÉTICOS para la demo del panel de la cooperativa.
Todos van marcados con "sintetico": true. No representan datos reales de ninguna finca."""
import json, random
random.seed(7)
ZONAS = {"BO": (9.2540, -70.2690), "BI": (9.3590, -69.9820), "SA": (9.7470, -69.6530), "SC": (8.4040, -71.6620)}
FRASES = {
 "roya": ["las hojas tienen como un polvillo naranja por debajo y se están cayendo",
          "el cafetal de arriba está oxidado, las hojas amarillas por debajo",
          "desde que llovió tanto las matas se están deshojando, tienen polvito anaranjado"],
 "broca": ["los granos tienen un huequito, como picados", "encontré un bichito dentro de la cereza"],
 "minador": ["las hojas se ven como quemadas, como papel", "manchas secas marrones en las hojas"],
 "ojo_de_gallo": ["manchitas redondas claras en las hojas, en la parte con mucha sombra"],
 "nutricion": ["este año no cargó, las matas están flacas y amarillas", "hojas pálidas parejas en todo el lote"],
 "muerte_descendente": ["las ramas se secan desde la punta para abajo"],
 "no_claro": ["la mata está fea, no sé qué tiene", "algo raro le pasa al café"],
}
TEC = {"roya":"Síntoma compatible con roya del café (Hemileia vastatrix)","broca":"Síntoma compatible con broca del café (Hypothenemus hampei)",
 "minador":"Síntoma compatible con minador de la hoja (Leucoptera coffeella)","ojo_de_gallo":"Síntoma compatible con ojo de gallo (Mycena citricolor)",
 "nutricion":"Posible deficiencia nutricional o de suelo (requiere revisión)","muerte_descendente":"Síntoma compatible con muerte descendente / antracnosis",
 "no_claro":"No queda claro: pasa a revisión del técnico"}
fincas = {z: [(f"F{z}{i:02d}", lat + random.uniform(-.05, .05), lng + random.uniform(-.05, .05)) for i in range(14)] for z, (lat, lng) in ZONAS.items()}
reps = []
def add(z, s, dias, conf=None, extension=None, clima=None):
    fid, lat, lng = random.choice(fincas[z])
    reps.append({"id": f"sint-{len(reps)}", "sintetico": True, "zona": z, "finca": fid, "lat": round(lat, 5), "lng": round(lng, 5),
        "hace_dias": dias, "cultivo": "cafe", "cultivo_nombre": "Café", "sintoma": s, "sintoma_tecnico": TEC[s],
        "texto_original": random.choice(FRASES[s]), "confianza": conf or random.choice(["alta", "alta", "media"]) if s != "no_claro" else "baja",
        "extension": extension or random.choice([1, 1, 2, 2, 3]), "clima": clima, "confirmado": True})
# Brote de roya empezando en Boconó tras lluvias: 4 reportes (con 1 más se dispara la alerta en la demo)
for _ in range(4): add("BO", "roya", random.randint(0, 12), clima="lluvia")
# Broca en Biscucuy: ya supera el umbral (alerta lista para aprobar)
for _ in range(6): add("BI", "broca", random.randint(0, 13))
# Ruido de fondo en todas las zonas, últimos 30 días
for _ in range(34):
    z = random.choice(list(ZONAS)); s = random.choice(["minador", "nutricion", "ojo_de_gallo", "muerte_descendente", "no_claro", "roya", "broca"])
    if s in ("roya", "broca"): s = "minador"   # el ruido de fondo no toca las señales de la demo
    add(z, s, random.randint(15, 30) if s == "no_claro" else random.randint(0, 30))
# ---------- Maíz (Portuguesa) ----------
ZONAS_MAIZ = {"TU": (9.3150, -69.1100), "GU": (9.0418, -69.7421)}
FRASES_MAIZ = {
 "cogollero": ["el cogollo está comido y tiene como aserrín", "le cayó el cogollero al maíz chiquito", "hay un gusano metido en el cogollo"],
 "mazorca": ["las mazorcas tienen la punta comida", "las mazorcas salieron podridas con tanta lluvia"],
 "sequia_maiz": ["las hojas del maíz se enrollan, no ha llovido"],
 "nutricion_maiz": ["el maíz está amarillo y chiquito", "las hojas tienen un color morado"],
 "manchas_maiz": ["las hojas tienen puntos negros como de asfalto"],
 "raiz_maiz": ["las matas se caen solas y la raíz está comida"],
}
TEC_MAIZ = {"cogollero": "Síntoma compatible con gusano cogollero (Spodoptera frugiperda)",
 "mazorca": "Mazorca dañada: compatible con gusano de la mazorca o pudrición (requiere revisión)",
 "sequia_maiz": "Estrés por falta de agua (hojas enrolladas / secas)",
 "nutricion_maiz": "Posible deficiencia nutricional o de suelo en maíz (requiere revisión)",
 "manchas_maiz": "Manchas en hojas: posible enfermedad foliar (p. ej. mancha de asfalto, tizón, roya común) — requiere revisión",
 "raiz_maiz": "Daño en raíz compatible con gallina ciega o gusano alfilerillo (Diabrotica)"}
fincas_m = {z: [(f"F{z}{i:02d}", lat + random.uniform(-.06, .06), lng + random.uniform(-.06, .06)) for i in range(14)] for z, (lat, lng) in ZONAS_MAIZ.items()}
def add_m(z, s, dias):
    fid, lat, lng = random.choice(fincas_m[z])
    reps.append({"id": f"sint-{len(reps)}", "sintetico": True, "zona": z, "finca": fid, "lat": round(lat, 5), "lng": round(lng, 5),
        "hace_dias": dias, "cultivo": "maiz", "cultivo_nombre": "Maíz", "sintoma": s, "sintoma_tecnico": TEC_MAIZ[s],
        "texto_original": random.choice(FRASES_MAIZ[s]), "confianza": random.choice(["alta", "alta", "media"]),
        "extension": random.choice([1, 2, 2, 3]), "clima": None, "confirmado": True})
for _ in range(6): add_m("TU", "cogollero", random.randint(0, 10))     # brote de cogollero en Turén → alerta lista
for _ in range(12):
    add_m(random.choice(list(ZONAS_MAIZ)), random.choice(["mazorca", "sequia_maiz", "nutricion_maiz", "manchas_maiz", "raiz_maiz"]), random.randint(0, 30))

json.dump(reps, open("reportes_sinteticos.json", "w"), ensure_ascii=False, indent=1)
print(len(reps), "reportes sintéticos")
