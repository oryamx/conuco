// Controles de seguridad de Conuco.
// Principio: todo reporte que llega a la cooperativa (app, SMS o llamada) es dato NO confiable
// hasta validarlo: esquema, finca registrada, firma, anti-repetición y límite por finca.
import { SINTOMAS } from './lexicon.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));

export const MAX_TEXTO = 500;               // caracteres de la frase del agricultor
export const MAX_FOTO = 200 * 1024;         // bytes aprox. de la foto comprimida (data URL)
export const MAX_POR_FINCA_DIA = 3;         // reportes que cuentan para alertas por finca y día
const SINTOMA_IDS = new Set([...SINTOMAS.map((s) => s.id), 'no_claro']);
const CONF = new Set(['alta', 'media', 'baja']);
const DIA = 86400000;

export const fotoValida = (f) => typeof f === 'string' && f.length <= MAX_FOTO * 1.4 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(f);

// Valida y limpia un reporte. Devuelve { ok, motivo, r } con solo campos conocidos.
export function validarReporte(x, zonasValidas) {
  if (!x || typeof x !== 'object') return { ok: false, motivo: 'no es un reporte' };
  const motivo = (m) => ({ ok: false, motivo: m });
  if (typeof x.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(x.id)) return motivo('id inválido');
  if (typeof x.finca !== 'string' || !/^F[A-Z0-9]{2,8}$/.test(x.finca)) return motivo('código de finca inválido');
  if (!zonasValidas[x.zona]) return motivo('zona desconocida');
  if (!SINTOMA_IDS.has(x.sintoma)) return motivo('síntoma fuera de la lista');
  if (!CONF.has(x.confianza)) return motivo('confianza inválida');
  const ahora = Date.now();
  if (typeof x.fecha !== 'number' || x.fecha < ahora - 60 * DIA || x.fecha > ahora + DIA) return motivo('fecha fuera de rango');
  if (x.foto != null && !fotoValida(x.foto)) return motivo('foto inválida o muy grande');
  const s = SINTOMAS.find((y) => y.id === x.sintoma);
  return {
    ok: true,
    r: {
      id: x.id, finca: x.finca, zona: x.zona, fecha: x.fecha, sintoma: x.sintoma, confianza: x.confianza,
      sintoma_tecnico: s ? s.tecnico : 'No queda claro: pasa a revisión del técnico',
      texto_original: String(x.texto_original ?? '').slice(0, MAX_TEXTO),
      cultivo: x.cultivo === 'maiz' ? 'maiz' : 'cafe',
      probabilidad: Number.isFinite(x.probabilidad) ? Math.max(0, Math.min(100, Math.round(x.probabilidad))) : null,
      extension: [1, 2, 3].includes(x.extension) ? x.extension : null,
      dias: Number.isFinite(x.dias) ? Math.max(0, Math.min(365, Math.round(x.dias))) : null,
      clima: ['lluvia', 'sequia', 'frio'].includes(x.clima) ? x.clima : null,
      foto: x.foto ?? null, canal: ['app', 'sms', 'llamada'].includes(x.canal) ? x.canal : 'app',
      confirmado: x.confirmado === true, corregido: x.corregido === true,
    },
  };
}

// ---------- SMS firmado ----------
// Cada finca recibe una clave al registrarse (en persona, con el promotor). El SMS lleva una firma corta
// HMAC-SHA256 truncada: sin la clave no se pueden fabricar reportes a nombre de otra finca.
const enc = new TextEncoder();
async function hmac(claveHex, texto) {
  const clave = new Uint8Array(claveHex.match(/../g).map((h) => parseInt(h, 16)));
  const k = await crypto.subtle.importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(texto)));
  return [...firma.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase(); // 8 hex = 32 bits
}
export const nuevaClave = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function firmarSMS(cuerpo, claveHex) { return `${cuerpo} M${await hmac(claveHex, cuerpo)}`; }

// Comparación en tiempo constante (evita filtrar cuántos caracteres coinciden)
function igualSeguro(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Lee un SMS "CNC1 F023 BO 261003 CAF RY E2 D14 LL C3 OK M1A2B3C4" y lo verifica contra el registro de fincas.
export async function verificarSMS(texto, registro) {
  const t = String(texto || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (t.length > 160) return { ok: false, motivo: 'SMS demasiado largo' };
  const m = t.match(/^(CNC1 (F[A-Z0-9]{2,8}) ([A-Z]{2}) (\d{6}) (CAF|MAI) ([A-Z]{2}) E(\d) D(\d{1,3}) (\S{1,2}) C([123]) (OK|REV)) M([0-9A-F]{8})$/);
  if (!m) return { ok: false, motivo: 'formato inválido' };
  const [, cuerpo, finca, zona, fecha, cult, cod, ext, dias, clima, conf, , firma] = m;
  const reg = registro[finca];
  if (!reg) return { ok: false, motivo: 'finca no registrada' };
  const esperada = await hmac(reg.clave, cuerpo);
  if (!igualSeguro(esperada, firma)) return { ok: false, motivo: 'firma inválida (posible SMS falsificado)' };
  if (reg.zona !== zona) return { ok: false, motivo: 'la zona no coincide con el registro de la finca' };
  return { ok: true, finca, zona, fecha, cultivo: cult === 'MAI' ? 'maiz' : 'cafe', cod, ext: +ext, dias: +dias, clima, conf: +conf, firma };
}
