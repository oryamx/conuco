// Simulador de la línea de voz de Conuco (IVR) para teléfonos básicos.
// Flujo: menú por teclado → nota de voz → IA (Whisper + clasificador) → confirmación por teclado → reporte.
// Si la IA no entiende, el agricultor elige el problema con el teclado (funciona aunque falle la voz).
import { extraer } from './extract.js';
import { sintomasDe, SINTOMAS } from './lexicon.js';
import { cargarTodos } from './clasificador.js';
import { ZONAS, getRegistro, registrarFinca, recibirReporte } from './store.js';
import { esc } from './seguridad.js';

const $ = (id) => document.getElementById(id);
const MODELO = new URLSearchParams(location.search).get('modelo') === 'tiny' ? 'onnx-community/whisper-tiny' : 'onnx-community/whisper-base';

// ---------- IA ----------
const worker = new Worker(new URL('./asr-worker.js', import.meta.url), { type: 'module' });
let listo = false, resolver = null;
worker.onmessage = (e) => {
  const m = e.data;
  if (m.tipo === 'progreso') $('chipModelo').textContent = `IA: ${m.pct}%`;
  else if (m.tipo === 'listo') { listo = true; $('chipModelo').textContent = '🧠 IA lista'; $('chipModelo').className = 'chip ok'; }
  else if (m.tipo === 'texto') { resolver?.(m.texto); resolver = null; }
  else if (m.tipo === 'error') { $('chipModelo').textContent = '⚠️ IA no disponible'; $('chipModelo').className = 'chip mal'; resolver?.(''); resolver = null; }
};
worker.postMessage({ tipo: 'cargar', modelo: MODELO });
cargarTodos().catch(() => {});
const transcribir = (audio) => new Promise((res) => { resolver = res; worker.postMessage({ tipo: 'transcribir', modelo: MODELO, audio }, [audio.buffer]); });

// ---------- Número y registro ----------
const soloDigitos = (v) => String(v || '').replace(/\D/g, '').slice(0, 15);
$('zonaReg').innerHTML = Object.entries(ZONAS).map(([k, z]) => `<option value="${k}">${esc(z.nombre)}</option>`).join('');
function fincaDelNumero() {
  const tel = soloDigitos($('numero').value);
  const entrada = Object.entries(getRegistro()).find(([, f]) => f.telefono === tel);
  return entrada ? { codigo: entrada[0], ...entrada[1] } : null;
}
function pintarNumero() {
  const f = fincaDelNumero();
  $('estadoNumero').innerHTML = f
    ? `✅ Registrado como finca <b>${esc(f.codigo)}</b> · ${esc(ZONAS[f.zona]?.nombre)} · ${f.cultivo === 'maiz' ? '🌽 maíz' : '☕ café'}`
    : '⚠️ Número no registrado: el reporte llega al técnico, pero no cuenta para alertas hasta que el promotor lo registre.';
}
$('numero').addEventListener('input', pintarNumero);
$('btnRegistrar').addEventListener('click', () => {
  const tel = soloDigitos($('numero').value);
  if (tel.length < 7) return alert('Número inválido');
  const codigo = 'FT' + tel.slice(-6);
  registrarFinca({ codigo, zona: $('zonaReg').value, cultivo: $('cultivoReg').value, telefono: tel });
  pintarNumero();
});
pintarNumero();

// ---------- Voz de la línea ----------
function decir(texto) {
  log('ivr', texto);
  $('pantallaTexto').textContent = texto;
  return new Promise((res) => {
    if (!('speechSynthesis' in window)) return res();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    const voces = speechSynthesis.getVoices();
    u.voice = voces.find((v) => /es[-_](VE|419|US|MX|CO)/i.test(v.lang)) || voces.find((v) => v.lang.startsWith('es')) || null;
    u.lang = u.voice?.lang || 'es-419'; u.rate = 0.95;
    u.onend = res; u.onerror = res;
    speechSynthesis.speak(u);
    setTimeout(res, 15000);
  });
}
function log(quien, texto) {
  if ($('registro').querySelector('.pista')) $('registro').innerHTML = '';
  const p = document.createElement('p'); p.className = quien; p.textContent = (quien === 'ivr' ? '🤖 ' : '👤 ') + texto;
  $('registro').appendChild(p); $('registro').scrollTop = 1e9;
}
function tono() {
  try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = 880; o.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, 350); } catch {}
}

// ---------- Máquina de estados de la llamada ----------
let estado = 'colgado', cultivo = 'cafe', registro = null, grabador = null, trozos = [], stream = null, corte = null;

async function contestar() {
  if (estado !== 'colgado') return;
  estado = 'menu_cultivo';
  $('estadoLlamada').textContent = '📞 En llamada · Línea Conuco';
  const f = fincaDelNumero();
  if (f) { cultivo = f.cultivo; }
  await decir('Bienvenido a la línea de Conuco de su cooperativa. Para reportar en café, marque 1. Para maíz, marque 2.');
}

async function tecla(k) {
  if (estado === 'colgado') return;
  log('yo', `marcó ${k}`);
  if (estado === 'menu_cultivo') {
    if (k !== '1' && k !== '2') return decir('Opción no válida. Café, marque 1. Maíz, marque 2.');
    cultivo = k === '2' ? 'maiz' : 'cafe';
    estado = 'grabando_espera';
    await decir('Después del tono, cuéntenos con sus palabras qué le pasa a su siembra. Cuando termine, marque numeral.');
    return empezarGrabar();
  }
  if (estado === 'grabando' && k === '#') return pararGrabar();
  if (estado === 'confirmar') {
    if (k === '1') return guardar();
    if (k === '2') return menuSintomas();
    return decir('Si es correcto, marque 1. Si no, marque 2.');
  }
  if (estado === 'menu_sintomas') {
    const lista = sintomasDe(cultivo);
    const i = parseInt(k, 10);
    if (k === '9') { Object.assign(registro, { sintoma: 'no_claro', confianza: 'baja', corregido: true }); return guardar(); }
    if (i >= 1 && i <= lista.length) { Object.assign(registro, { sintoma: lista[i - 1].id, confianza: 'alta', corregido: true }); return guardar(); }
    return decir('Opción no válida.');
  }
}

async function empezarGrabar() {
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return decir('No hay micrófono disponible.'); }
  tono();
  trozos = []; grabador = new MediaRecorder(stream);
  grabador.ondataavailable = (e) => e.data.size && trozos.push(e.data);
  grabador.onstop = procesar;
  grabador.start(); estado = 'grabando';
  $('estadoLlamada').innerHTML = '<span class="grabando">🔴 Grabando…</span> marque # al terminar';
  corte = setTimeout(() => estado === 'grabando' && pararGrabar(), 30000);
}
function pararGrabar() { clearTimeout(corte); estado = 'procesando'; grabador?.state === 'recording' && grabador.stop(); }

async function procesar() {
  stream?.getTracks().forEach((t) => t.stop());
  $('estadoLlamada').textContent = '📞 En llamada · procesando';
  await decir('Un momento, por favor.');
  let texto = '';
  try {
    const ctx = new AudioContext({ sampleRate: 16000 });
    const buf = await ctx.decodeAudioData(await new Blob(trozos).arrayBuffer());
    const audio = buf.getChannelData(0).slice(); ctx.close();
    texto = listo ? await transcribir(audio) : '';
  } catch { texto = ''; }
  if (texto) log('yo', `(voz) “${texto}”`);
  registro = texto ? extraer(texto, cultivo) : { texto_original: '', sintoma: 'no_claro', confianza: 'baja', cultivo };
  registro.cultivo = cultivo;
  if (registro.sintoma === 'no_claro' || registro.confianza === 'baja') {
    await decir('No le entendí bien.');
    return menuSintomas();
  }
  estado = 'confirmar';
  const s = SINTOMAS.find((x) => x.id === registro.sintoma);
  await decir(`Entendí que su ${cultivo === 'maiz' ? 'maíz' : 'café'} tiene ${s.sencillo}. Si es correcto, marque 1. Si no, marque 2.`);
}

async function menuSintomas() {
  estado = 'menu_sintomas';
  const lista = sintomasDe(cultivo);
  await decir('Elija con el teclado. ' + lista.map((s, i) => `${s.sencillo}, marque ${i + 1}.`).join(' ') + ' Si no sabe, marque 9.');
}

async function guardar() {
  estado = 'cerrando';
  const f = fincaDelNumero();
  const tel = soloDigitos($('numero').value);
  const res = recibirReporte({
    id: 'tel-' + crypto.randomUUID(), finca: f ? f.codigo : 'FT' + (tel.slice(-6) || '000000'), zona: f ? f.zona : 'BO',
    fecha: Date.now(), sintoma: registro.sintoma, confianza: registro.confianza, cultivo,
    texto_original: registro.texto_original || '(llamada) eligió con el teclado', probabilidad: registro.probabilidad ?? null,
    extension: registro.extension ?? null, dias: registro.dias ?? null, clima: registro.clima ?? null,
    canal: 'llamada', confirmado: true, corregido: !!registro.corregido,
  }, 'llamada');
  if (res.ok) await decir('Gracias. Su reporte llegó a la cooperativa. Si hay un aviso para su zona, lo llamaremos. Hasta luego.');
  else await decir('Lo sentimos, no pudimos guardar su reporte. Intente más tarde.');
  colgar();
}

function colgar() {
  speechSynthesis?.cancel(); clearTimeout(corte);
  if (grabador?.state === 'recording') { grabador.onstop = null; grabador.stop(); }
  stream?.getTracks().forEach((t) => t.stop());
  estado = 'colgado'; $('estadoLlamada').textContent = 'Llamada terminada'; $('pantallaTexto').textContent = 'Pulse 📞 para llamar otra vez';
}

$('btnLlamar').addEventListener('click', contestar);
$('btnColgar').addEventListener('click', () => { log('yo', 'colgó'); colgar(); });
$('teclado').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) tecla(b.dataset.k); });
document.addEventListener('keydown', (e) => { if (/^[0-9*#]$/.test(e.key) && document.activeElement?.tagName !== 'INPUT') tecla(e.key); });
speechSynthesis?.getVoices();

// Para pruebas automáticas (solo con ?prueba): simula la nota de voz con texto
if (new URLSearchParams(location.search).has('prueba')) window.__conucoLlamada = { tecla, contestar, simularVoz: async (t) => { log('yo', `(voz) “${t}”`); registro = extraer(t, cultivo); registro.cultivo = cultivo;
  if (registro.sintoma === 'no_claro' || registro.confianza === 'baja') { await decir('No le entendí bien.'); return menuSintomas(); }
  estado = 'confirmar'; const s = SINTOMAS.find((x) => x.id === registro.sintoma);
  await decir(`Entendí que su ${cultivo === 'maiz' ? 'maíz' : 'café'} tiene ${s.sencillo}. Si es correcto, marque 1. Si no, marque 2.`); },
  estado: () => estado };
