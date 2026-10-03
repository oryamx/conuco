import { SINTOMAS, sintomasDe, CULTIVOS, PARTES, EXTENSION, CLIMA, extraerDias } from './lexicon.js';
import { clasificar } from './clasificador.js';

// Umbrales de confianza del clasificador (probabilidad de la clase ganadora)
export const UMBRAL_ALTA = 0.7;
export const UMBRAL_MEDIA = 0.45;

// Errores típicos del reconocimiento de voz en palabras del campo (se amplía con las correcciones reales).
const ARREGLOS_VOZ = [[/\bmas ron\b/g, 'marron'], [/\bmar ron\b/g, 'marron'], [/\bvachac/g, 'bachac'], [/\bbroka\b/g, 'broca']];

export function normalizar(texto) {
  let t = (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, bien] of ARREGLOS_VOZ) t = t.replace(re, bien);
  return t;
}

function coincidencias(t, item) {
  return item.patrones.filter((p) => p.test(t)).length;
}

function mejor(t, lista) {
  let best = null, score = 0;
  for (const it of lista) {
    const s = coincidencias(t, it);
    if (s > score) { best = it; score = s; }
  }
  return best;
}

// Convierte lo que dijo el agricultor en un registro técnico estructurado.
// Solo puede responder con categorías de una lista fija (no inventa diagnósticos).
export function extraer(texto, cultivoPerfil = 'cafe') {
  const t = normalizar(texto);
  // Cultivo: el que se nombre en la frase (si es café o maíz); si no, el del perfil del agricultor.
  const nombrado = mejor(t, CULTIVOS);
  const cultivoId = nombrado && ['cafe', 'maiz'].includes(nombrado.id) ? nombrado.id : cultivoPerfil;
  const puntajes = sintomasDe(cultivoId)
    .map((s) => ({ s, n: coincidencias(t, s) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  const total = puntajes.reduce((a, x) => a + x.n, 0);
  const top = puntajes[0];
  let sintomaId = null, confianza = 'baja', prob = null, metodo = 'reglas', ranking = [];

  const c = clasificar(texto, cultivoId);   // modelo entrenado del cultivo (si ya cargó)
  if (c) {
    metodo = 'modelo';
    prob = c.p;
    ranking = c.ranking.slice(0, 3).map((r) => ({ id: r.clase, p: Math.round(r.p * 100) }));
    confianza = c.p >= UMBRAL_ALTA ? 'alta' : c.p >= UMBRAL_MEDIA ? 'media' : 'baja';
    sintomaId = c.mejor === 'otro' || confianza === 'baja' ? null : c.mejor;
    if (c.mejor === 'otro') confianza = 'baja';
  } else if (top) {
    const margen = top.n - (puntajes[1]?.n || 0);
    if (top.n >= 2 && margen >= 1) confianza = 'alta';
    else if (top.n >= 1 && margen >= 1) confianza = 'media';
    sintomaId = confianza !== 'baja' ? top.s.id : null;
  }
  const s = SINTOMAS.find((x) => x.id === sintomaId);

  const cultivo = CULTIVOS.find((x) => x.id === cultivoId) || CULTIVOS[0];
  const parte = mejor(t, PARTES);
  const extension = mejor(t, EXTENSION);
  const clima = mejor(t, CLIMA);
  const dias = extraerDias(t);

  return {
    texto_original: texto,
    cultivo: cultivo.id,
    cultivo_nombre: cultivo.nombre,
    sintoma: s ? s.id : 'no_claro',
    sintoma_tecnico: s ? s.tecnico : 'No queda claro: pasa a revisión del técnico',
    sintoma_sencillo: s ? s.sencillo : null,
    otros_posibles: ranking.length ? ranking.slice(1).filter((r) => r.p >= 5).map((r) => `${r.id} (${r.p}%)`) : puntajes.slice(1, 3).map((x) => x.s.id),
    probabilidad: prob !== null ? Math.round(prob * 100) : null,
    ranking,
    metodo,
    pistas: puntajes.map((x) => x.s.id),
    parte: parte?.id || null,
    parte_nombre: parte?.nombre || null,
    extension: extension?.id || null,
    extension_nombre: extension?.nombre || null,
    clima: clima?.id || null,
    clima_nombre: clima?.nombre || null,
    dias,
    confianza,
    senales: total,
  };
}

// Frase de "¿entendí bien?" en palabras sencillas, para leer en voz alta.
export function leerDeVuelta(r) {
  const partes = [];
  if (r.sintoma_sencillo && r.sintoma !== 'no_claro') partes.push(`tu ${r.cultivo_nombre.toLowerCase()} tiene ${r.sintoma_sencillo}`);
  else partes.push(`algo le pasa a tu ${r.cultivo_nombre.toLowerCase()}, pero no lo entendí bien`);
  if (r.extension_nombre) partes.push(`en ${r.extension_nombre.toLowerCase()}`);
  if (r.dias) partes.push(`desde hace unos ${r.dias} días`);
  if (r.clima_nombre) partes.push(r.clima_nombre.toLowerCase());
  let frase = `¿Entendí bien? ${partes.join(', ')}.`;
  if (r.confianza === 'baja') frase += ' No estoy seguro. Si lo confirmas, guardo tu reporte para que lo revise el técnico, o toca el dibujo que más se parezca.';
  else if (r.confianza === 'media') frase += ' No estoy del todo seguro; el técnico lo va a revisar.';
  return frase;
}

// Código corto para mandar por SMS cuando no hay datos (cabe en un SMS de 160 caracteres).
export const COD = { cogollero: 'CG', raiz_maiz: 'RZ', mazorca: 'MZ', gorgojo: 'GG', sequia_maiz: 'SQ', nutricion_maiz: 'NM', manchas_maiz: 'MM', come_hojas: 'CH', roya: 'RY', broca: 'BR', minador: 'MN', ojo_de_gallo: 'OG', mancha_hierro: 'MH', muerte_descendente: 'MD', nutricion: 'NU', no_claro: 'NC' };
export function codigoSMS(r, perfil) {
  const fecha = new Date(r.fecha).toISOString().slice(2, 10).replace(/-/g, '');
  return [
    'CNC1', perfil?.codigo || 'F000', perfil?.zona || 'ZZ', fecha,
    (r.cultivo || 'cafe').slice(0, 3).toUpperCase(), COD[r.sintoma] || 'NC',
    'E' + (r.extension || 0), 'D' + (r.dias ?? 0), (r.clima || '-').slice(0, 2).toUpperCase(),
    'C' + ({ alta: 3, media: 2, baja: 1 }[r.confianza]), r.confirmado ? 'OK' : 'REV',
  ].join(' ');
}
