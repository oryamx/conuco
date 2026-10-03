# 🌱 Conuco — cuaderno de campo por voz, sin internet ni luz

**Hack-Nation 7th Global AI Hackathon · World Bank "Small AI for Development" · Track B: Agriculture**

> *Conuco* es la palabra venezolana para la parcelita de siembra.

## El problema
En los Andes venezolanos, los caficultores viven con apagones diarios, poca señal y un técnico que, con suerte, pasa dos veces al año.
Cuando una plaga empieza, nadie se entera a tiempo: el agricultor la ve, pero no tiene a quién contarle ni las palabras técnicas para hacerlo, y no existe un registro de lo que pasa en el campo.

## La solución
1. El agricultor **habla** en sus palabras: *"las hojas están como oxidadas por debajo y se están cayendo"*.
2. La IA **en el teléfono, sin internet** transcribe la voz (Whisper) y la convierte en una **ficha técnica** (cultivo, síntoma compatible, parte de la planta, extensión, desde cuándo, clima).
3. Conuco **le repite en voz alta lo que entendió**; el agricultor confirma o corrige tocando un dibujo.
4. El reporte se guarda en el teléfono y **se envía solo cuando vuelve la señal** (o cabe en un SMS de ~50 caracteres).
5. La cooperativa ve un **mapa** y recibe **alertas tempranas** cuando varias fincas de una zona reportan lo mismo.
6. Un **técnico o promotor de la cooperativa revisa y aprueba** el aviso, que llega en palabras sencillas a las fincas de la zona.

Conuco **no diagnostica ni receta**: anota lo que la persona ve y avisa a una persona. Si no está seguro, lo dice.

## Cómo probarlo
- App del agricultor: `index.html` (la primera vez descarga el modelo de voz; luego funciona en modo avión).
- Panel de la cooperativa: `cooperativa.html`.
- Demo: en Boconó hay 4 reportes sintéticos de roya; al grabar el 5.º desde la app, aparece la alerta de brote.
- `?modelo=tiny` usa Whisper tiny (~40 MB) para teléfonos básicos; por defecto Whisper base (~80 MB).

## Quién lo usa y quién lo administra
| Rol | Herramienta | Qué hace |
|---|---|---|
| Agricultor | App en su teléfono (offline) | Habla, confirma, adjunta foto opcional, reporta |
| Técnico / promotor de la cooperativa | Panel (`cooperativa.html`) | Revisa, valida o corrige reportes; aprueba alertas |
| Coordinador regional (cooperativa / federación) | `modelo/entrenar.py` | Reentrena el "paquete regional" con lo validado y lo publica |

La cooperativa es dueña de sus datos. La infraestructura mínima: una laptop o mini PC en la oficina y un teléfono Android como receptor de SMS (opcional: panel solar).

![Arquitectura](arquitectura.png)

## Arquitectura (todo en el navegador)
| Pieza | Tecnología | Dónde corre |
|---|---|---|
| Voz → texto | Whisper (base/tiny, cuantizado q8) con transformers.js + ONNX WebAssembly, en un Web Worker | Teléfono, offline |
| Texto → ficha técnica | **Clasificador propio** (TF-IDF de n-gramas de caracteres + regresión logística, 114 KB, `modelo_conuco.json`), con umbrales de confianza; el diccionario `lexicon.js` extrae parte de la planta, extensión, tiempo y clima y explica qué palabras reconoció | Teléfono, offline |
| Foto (opcional) | Comprimida a 640 px JPEG (~40–80 KB), como evidencia para el técnico (no se diagnostica con IA) | Teléfono → cooperativa |
| Lectura en voz alta | Web Speech API (voz del sistema) | Teléfono, offline |
| App offline | Service Worker + Cache Storage | Teléfono |
| Envío diferido | Cola local (store-and-forward) + código SMS | Teléfono |
| Panel y alertas | Leaflet + regla de brote (≥5 reportes, ≥3 fincas, 14 días, misma zona y síntoma) | Oficina de la cooperativa |

En este prototipo la "cooperativa" es el panel del mismo sitio (almacenamiento compartido del navegador). En producción el envío iría a un servidor de la cooperativa o a una pasarela SMS.

## Conuco aprende con el uso
1. El agricultor corrige tocando un dibujo, o el técnico valida/corrige el reporte en el panel.
2. El panel acumula esas frases validadas y permite descargarlas (`frases_validadas.txt`).
3. `python3 modelo/entrenar.py --entrenar-con frases_validadas.txt` reentrena el modelo con la jerga real de la zona.
4. El nuevo `modelo_conuco.json` (~100 KB) se envía a los teléfonos cuando hay señal.

Métrica actual: 20/20 en un set de prueba aparte (**escrito por el mismo equipo, por lo que es optimista**); ver `modelo/entrenar.py` para reproducir.

## Datos
- `reportes_sinteticos.json` y `generar_sinteticos.py`: **datos sintéticos** para la demo, marcados como tales.
- El diccionario campesino es un **borrador hecho para el hackathon**: debe validarse con caficultores y agrónomos de cada zona.
- Contexto del problema: crisis eléctrica 2026 (Infobae, sep 2026); rendimientos de café de 4–8 qq/ha vs 25–30 ideales (Fedeagro vía Crónica Uno).

## Lo que no cubre (todavía)
- No hay datos reales de agricultores; el diccionario y los reportes son de prueba.
- Necesita un smartphone (aunque sea compartido). Siguiente paso: línea de voz para teléfonos básicos.
- Whisper funciona bien en español, pero no en lenguas indígenas sin más datos (p. ej. Common Voice / MMS).

## Responsable por diseño
- La última palabra la tiene una persona (agricultor confirma; técnico aprueba alertas).
- Lista fija de respuestas: no puede inventar diagnósticos ni recetar agroquímicos.
- Las notas de voz **no salen del teléfono**; solo viaja la ficha, sin nombre del agricultor y con su consentimiento.
