// Almacenamiento local: el teléfono guarda todo y lo envía cuando vuelve la señal ("store-and-forward").
// En este prototipo la "cooperativa" es el panel del mismo sitio (localStorage compartido + BroadcastChannel).
// En producción, el envío iría a un servidor de la cooperativa o por SMS.

const K_PERFIL = 'conuco.perfil';
const K_COLA = 'conuco.cola';          // reportes guardados en el teléfono, sin enviar
const K_COOP = 'conuco.cooperativa';   // reportes que ya llegaron a la cooperativa
const K_ALERTAS = 'conuco.alertas';    // alertas aprobadas por el técnico
const K_CORR = 'conuco.correcciones'; // validaciones/correcciones del técnico (alimentan el reentrenamiento)

const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('conuco') : null;

function leer(k, def) {
  try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; }
}
function escribir(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('No se pudo guardar', e); }
}

export const ZONAS = {
  BO: { nombre: 'Boconó (Trujillo)', lat: 9.2540, lng: -70.2690 },
  BI: { nombre: 'Biscucuy (Portuguesa)', lat: 9.3590, lng: -69.9820 },
  SA: { nombre: 'Sanare (Lara)', lat: 9.7470, lng: -69.6530 },
  SC: { nombre: 'Santa Cruz de Mora (Mérida)', lat: 8.4040, lng: -71.6620 },
};

export const getPerfil = () => leer(K_PERFIL, null);
export const setPerfil = (p) => escribir(K_PERFIL, p);

export const getCola = () => leer(K_COLA, []);
export function guardarEnCola(r) {
  const c = getCola(); c.push(r); escribir(K_COLA, c); return c.length;
}

export const getCooperativa = () => leer(K_COOP, []);
export function enviarCola() {
  const cola = getCola();
  if (!cola.length) return 0;
  const coop = getCooperativa();
  const ahora = Date.now();
  cola.forEach((r) => coop.push({ ...r, recibido: ahora }));
  escribir(K_COOP, coop);
  escribir(K_COLA, []);
  canal?.postMessage({ tipo: 'nuevos', n: cola.length });
  return cola.length;
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
  [K_COLA, K_COOP, K_ALERTAS, K_CORR].forEach((k) => localStorage.removeItem(k));
}

export function escuchar(fn) { canal?.addEventListener('message', (e) => fn(e.data)); }
