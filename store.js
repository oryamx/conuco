// Almacenamiento local: el teléfono guarda todo y lo envía cuando vuelve la señal ("store-and-forward").
// En este prototipo la "cooperativa" es el panel del mismo sitio (localStorage compartido + BroadcastChannel).
// En producción, el envío iría a un servidor de la cooperativa o por SMS / llamada.
import { validarReporte, verificarSMS, nuevaClave, MAX_POR_FINCA_DIA } from './seguridad.js';
import { COD } from './extract.js';
import { SINTOMAS } from './lexicon.js';

const K_PERFIL = 'conuco.perfil';
const K_COLA = 'conuco.cola';          // reportes guardados en el teléfono, sin enviar
const K_COOP = 'conuco.cooperativa';   // reportes que ya llegaron a la cooperativa
const K_ALERTAS = 'conuco.alertas';    // alertas aprobadas por el técnico
const K_CORR = 'conuco.correcciones';  // validaciones/correcciones del técnico (alimentan el reentrenamiento)
const K_REG = 'conuco.registro';       // registro de fincas de la cooperativa (código → zona, cultivo, clave)
const K_RECH = 'conuco.rechazados';    // bitácora de reportes rechazados (auditoría)
const K_FIRMAS = 'conuco.firmas';      // firmas de SMS ya usadas (anti-repetición)

const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('conuco') : null;

function leer(k, def) {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    if (v == null) return def;
    if (Array.isArray(def) !== Array.isArray(v) || typeof v !== typeof def) return def; // datos corruptos → valor por defecto
    return v;
  } catch { return def; }
}
function escribir(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn('No se pudo guardar', e); return false; }
}

export const ZONAS = {
  BO: { nombre: 'Boconó (Trujillo)', lat: 9.2540, lng: -70.2690 },
  BI: { nombre: 'Biscucuy (Portuguesa)', lat: 9.3590, lng: -69.9820 },
  SA: { nombre: 'Sanare (Lara)', lat: 9.7470, lng: -69.6530 },
  SC: { nombre: 'Santa Cruz de Mora (Mérida)', lat: 8.4040, lng: -71.6620 },
  TU: { nombre: 'Turén (Portuguesa) · maíz', lat: 9.3150, lng: -69.1100 },
  GU: { nombre: 'Guanare (Portuguesa) · maíz', lat: 9.0418, lng: -69.7421 },
};

// ---------- Perfil del agricultor (en su teléfono) ----------
export const getPerfil = () => { const p = leer(K_PERFIL, {}); return p && typeof p.codigo === 'string' ? p : null; };
export const setPerfil = (p) => escribir(K_PERFIL, p);

// ---------- Registro de fincas (en la cooperativa) ----------
// En la vida real lo hace el promotor en persona y entrega la clave (p. ej. en un QR). Aquí se simula al crear el perfil.
export const getRegistro = () => leer(K_REG, {});
export function registrarFinca({ codigo, zona, cultivo, telefono }) {
  const reg = getRegistro();
  if (!reg[codigo]) reg[codigo] = { zona, cultivo, clave: nuevaClave(), telefono: telefono || null, desde: Date.now() };
  else Object.assign(reg[codigo], { zona, cultivo, ...(telefono ? { telefono } : {}) });
  escribir(K_REG, reg);
  return reg[codigo];
}

// ---------- Cola del teléfono ----------
export const getCola = () => leer(K_COLA, []);
export function guardarEnCola(r) {
  const c = getCola(); c.push(r); escribir(K_COLA, c); return c.length;
}

// ---------- Recepción en la cooperativa (todo pasa por aquí) ----------
export const getCooperativa = () => leer(K_COOP, []);
export const getRechazados = () => leer(K_RECH, []);
function rechazar(fuente, motivo, muestra) {
  const r = getRechazados(); r.push({ cuando: Date.now(), fuente, motivo, muestra: String(muestra ?? '').slice(0, 120) });
  escribir(K_RECH, r.slice(-200));
}

// Recibe un reporte ya validado; devuelve { ok, motivo }.
export function recibirReporte(x, fuente = 'app') {
  const v = validarReporte(x, ZONAS);
  if (!v.ok) { rechazar(fuente, v.motivo, x?.texto_original ?? x?.id); return v; }
  const coop = getCooperativa();
  if (coop.some((y) => y.id === v.r.id)) { rechazar(fuente, 'reporte duplicado', v.r.id); return { ok: false, motivo: 'reporte duplicado' }; }
  const reg = getRegistro()[v.r.finca];
  coop.push({ ...v.r, recibido: Date.now(), registrada: !!reg && reg.zona === v.r.zona });
  escribir(K_COOP, coop);
  canal?.postMessage({ tipo: 'nuevos', n: 1 });
  return { ok: true };
}

export function enviarCola() {
  const cola = getCola();
  if (!cola.length) return 0;
  let n = 0;
  cola.forEach((r) => { if (recibirReporte(r, 'app').ok) n++; });
  escribir(K_COLA, []);
  return n;
}

// SMS: verifica firma y anti-repetición, y lo convierte en reporte.
const DECOD = Object.fromEntries(Object.entries(COD).map(([k, v]) => [v, k]));
export async function recibirSMS(texto) {
  const v = await verificarSMS(texto, getRegistro());
  if (!v.ok) { rechazar('sms', v.motivo, texto); return v; }
  const usadas = leer(K_FIRMAS, []);
  if (usadas.includes(v.finca + v.firma)) { rechazar('sms', 'SMS repetido (posible reenvío)', texto); return { ok: false, motivo: 'SMS repetido (posible reenvío)' }; }
  const sintoma = DECOD[v.cod] || 'no_claro';
  const s = SINTOMAS.find((x) => x.id === sintoma);
  const f = v.fecha; const fecha = Date.UTC(2000 + +f.slice(0, 2), +f.slice(2, 4) - 1, +f.slice(4, 6), 12);
  const res = recibirReporte({
    id: 'sms-' + v.finca + '-' + v.firma, finca: v.finca, zona: v.zona, fecha, sintoma, cultivo: v.cultivo,
    confianza: { 3: 'alta', 2: 'media', 1: 'baja' }[v.conf], extension: v.ext || null, dias: v.dias || null,
    texto_original: `(SMS) ${s ? s.sencillo : 'no queda claro'}`, canal: 'sms', confirmado: true,
  }, 'sms');
  if (res.ok) { usadas.push(v.finca + v.firma); escribir(K_FIRMAS, usadas.slice(-2000)); }
  return res;
}

// Para alertas solo cuentan fincas registradas y máximo N reportes por finca y día (anti-spam).
export function contablesParaAlertas(reps) {
  const porFincaDia = {};
  return reps.filter((r) => {
    if (!r.sintetico && !r.registrada) return false;
    const k = r.finca + '|' + new Date(r.fecha).toDateString();
    porFincaDia[k] = (porFincaDia[k] || 0) + 1;
    return porFincaDia[k] <= MAX_POR_FINCA_DIA;
  });
}

export const getAlertas = () => leer(K_ALERTAS, []);
export function aprobarAlerta(a) {
  const al = getAlertas(); al.push({ ...a, aprobada: Date.now() }); escribir(K_ALERTAS, al);
  canal?.postMessage({ tipo: 'alerta', alerta: a });
}

export const getCorrecciones = () => leer(K_CORR, {});
export function corregir(id, cambios) {
  const c = getCorrecciones(); c[id] = { ...(c[id] || {}), ...cambios, cuando: Date.now() }; escribir(K_CORR, c);
  canal?.postMessage({ tipo: 'correccion', id });
}

export function borrarTodo() {
  [K_COLA, K_COOP, K_ALERTAS, K_CORR, K_RECH, K_FIRMAS].forEach((k) => localStorage.removeItem(k));
}
// Derecho del agricultor a borrar lo que guarda su teléfono
export function borrarMisDatos() { [K_PERFIL, K_COLA].forEach((k) => localStorage.removeItem(k)); }

export function escuchar(fn) { canal?.addEventListener('message', (e) => fn(e.data)); }
