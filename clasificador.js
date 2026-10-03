// Clasificadores de Conuco en el teléfono: un modelo pequeño por cultivo ("paquete").
// TF-IDF de n-gramas de caracteres + regresión logística, réplica exacta de modelo/entrenar.py (scikit-learn).
import { normalizar } from './extract.js';

export const PAQUETES = { cafe: 'modelo_conuco.json', maiz: 'modelo_maiz.json' };
const modelos = {};

export async function cargarClasificador(cultivo = 'cafe') {
  if (modelos[cultivo]) return modelos[cultivo];
  const r = await fetch(PAQUETES[cultivo] || PAQUETES.cafe);
  modelos[cultivo] = await r.json();
  return modelos[cultivo];
}
export async function cargarTodos() { return Promise.all(Object.keys(PAQUETES).map((c) => cargarClasificador(c))); }
export function setModelo(m, cultivo = m.cultivo || 'cafe') { modelos[cultivo] = m; }
export const clasificadorListo = (cultivo = 'cafe') => !!modelos[cultivo];

// Igual que sklearn analyzer="char_wb": n-gramas dentro de cada palabra con espacios a los lados.
function ngramas(texto, minN, maxN) {
  const out = [];
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const w = ' ' + palabra + ' ';
    for (let n = minN; n <= maxN; n++) {
      let offset = 0;
      out.push(w.slice(offset, offset + n));
      while (offset + n < w.length) { offset += 1; out.push(w.slice(offset, offset + n)); }
      if (offset === 0) break;
    }
  }
  return out;
}

export function clasificar(texto, cultivo = 'cafe') {
  const modelo = modelos[cultivo];
  if (!modelo) return null;
  const t = normalizar(texto);
  const cuentas = new Map();
  for (const g of ngramas(t, modelo.ngram[0], modelo.ngram[1])) {
    const i = modelo.vocab[g];
    if (i !== undefined) cuentas.set(i, (cuentas.get(i) || 0) + 1);
  }
  const x = new Map();
  let norma = 0;
  for (const [i, c] of cuentas) { const v = (1 + Math.log(c)) * modelo.idf[i]; x.set(i, v); norma += v * v; }
  norma = Math.sqrt(norma) || 1;
  const logits = modelo.clases.map((_, k) => {
    let s = modelo.intercept[k];
    for (const [i, v] of x) s += modelo.coef[k][i] * (v / norma);
    return s;
  });
  const m = Math.max(...logits);
  const ex = logits.map((l) => Math.exp(l - m));
  const z = ex.reduce((a, b) => a + b, 0);
  const proba = ex.map((e) => e / z);
  const orden = proba.map((p, k) => ({ clase: modelo.clases[k], p })).sort((a, b) => b.p - a.p);
  return { mejor: orden[0].clase, p: orden[0].p, ranking: orden, rasgos: cuentas.size, cultivo };
}
