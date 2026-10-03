import { extraer, leerDeVuelta, codigoSMS } from './extract.js';
import { SINTOMAS } from './lexicon.js';
import { cargarClasificador } from './clasificador.js';
import { ZONAS, getPerfil, setPerfil, getCola, guardarEnCola, enviarCola, getAlertas, escuchar } from './store.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// whisper-base: mejor español (~80 MB). whisper-tiny: para teléfonos básicos (~40 MB).
const MODELO = params.get('modelo') === 'tiny' ? 'onnx-community/whisper-tiny' : 'onnx-community/whisper-base';

let registroActual = null;
let modeloListo = false;

// ---------- Perfil (registro del agricultor) ----------
function mostrarPerfil() {
  $('vistaPerfil').classList.remove('oculto');
  $('vistaPrincipal').classList.add('oculto');
  const sel = $('zona');
  sel.innerHTML = Object.entries(ZONAS).map(([k, z]) => `<option value="${k}">${z.nombre}</option>`).join('');
  const p = getPerfil();
  if (p) { $('finca').value = p.finca; sel.value = p.zona; $('consiente').checked = true; }
  validarPerfil();
}
function validarPerfil() { $('btnGuardarPerfil').disabled = !($('finca').value.trim() && $('consiente').checked); }
$('finca').addEventListener('input', validarPerfil);
$('consiente').addEventListener('change', validarPerfil);
$('btnGuardarPerfil').addEventListener('click', () => {
  const previo = getPerfil();
  setPerfil({
    finca: $('finca').value.trim(),
    zona: $('zona').value,
    codigo: previo?.codigo || 'F' + String(Math.floor(Math.random() * 900) + 100),
    creado: previo?.creado || Date.now(),
  });
  iniciar();
});
$('lnkPerfil').addEventListener('click', (e) => { e.preventDefault(); mostrarPerfil(); });

// ---------- Estado: señal y batería ----------
function sinSenal() { return !navigator.onLine || $('simSinSenal').checked; }
function pintarRed() {
  const c = $('chipRed');
  if (sinSenal()) { c.textContent = '📵 Sin señal'; c.className = 'chip mal'; }
  else { c.textContent = '📶 Con señal'; c.className = 'chip ok'; }
  $('btnEnviar').disabled = sinSenal() || getCola().length === 0;
}
window.addEventListener('online', () => { pintarRed(); intentarEnviar(); });
window.addEventListener('offline', pintarRed);
$('simSinSenal').addEventListener('change', () => { pintarRed(); intentarEnviar(); });

if (navigator.getBattery) {
  navigator.getBattery().then((b) => {
    const pintar = () => {
      const pct = Math.round(b.level * 100);
      const c = $('chipBat');
      c.classList.remove('oculto');
      c.textContent = `${b.charging ? '⚡' : '🔋'} ${pct}%`;
      c.className = 'chip' + (pct <= 20 && !b.charging ? ' mal' : '');
    };
    pintar(); b.addEventListener('levelchange', pintar); b.addEventListener('chargingchange', pintar);
  });
}

// ---------- Modelo de voz en un Web Worker (no congela la pantalla) ----------
const worker = new Worker(new URL('./asr-worker.js', import.meta.url), { type: 'module' });
const progresoArchivos = {};
let resolverTexto = null;
worker.onmessage = (e) => {
  const m = e.data;
  if (m.tipo === 'progreso') {
    progresoArchivos[m.archivo] = m.pct;
    const vals = Object.values(progresoArchivos);
    const pct = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    $('barra').style.width = pct + '%';
    $('chipModelo').textContent = `IA: ${pct}%`;
  } else if (m.tipo === 'listo') {
    modeloListo = true;
    $('cajaCarga').classList.add('oculto');
    $('chipModelo').textContent = '🧠 IA lista';
    $('chipModelo').className = 'chip ok';
    $('mic').disabled = false;
  } else if (m.tipo === 'texto') {
    resolverTexto?.(m.texto); resolverTexto = null;
  } else if (m.tipo === 'error') {
    console.error(m.error);
    $('cajaCarga').classList.add('oculto');
    $('chipModelo').textContent = '⚠️ IA no disponible';
    $('chipModelo').className = 'chip mal';
    $('etiquetaMic').textContent = 'La voz no está disponible: puedes escribir abajo';
    resolverTexto?.(''); resolverTexto = null;
  }
};
function transcribir(audio) {
  return new Promise((res) => { resolverTexto = res; worker.postMessage({ tipo: 'transcribir', modelo: MODELO, audio }, [audio.buffer]); });
}

// ---------- Grabación ----------
let grabador = null, trozos = [], corte = null;
async function empezarGrabar() {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { $('etiquetaMic').textContent = 'Necesito permiso para el micrófono'; return; }
  trozos = [];
  grabador = new MediaRecorder(stream);
  grabador.ondataavailable = (e) => e.data.size && trozos.push(e.data);
  grabador.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    $('mic').classList.remove('grabando');
    $('mic').disabled = true;
    $('etiquetaMic').textContent = 'Entendiendo… 🌱';
    const blob = new Blob(trozos, { type: grabador.mimeType });
    const audio = await decodificar(blob);
    const texto = await transcribir(audio);
    $('mic').disabled = false;
    $('etiquetaMic').textContent = 'Toca para hablar';
    if (texto) procesar(texto, blob);
    else $('etiquetaMic').textContent = 'No te escuché bien. Intenta otra vez o escribe abajo.';
  };
  grabador.start();
  $('mic').classList.add('grabando');
  $('etiquetaMic').textContent = 'Te escucho… toca para terminar';
  corte = setTimeout(() => grabador?.state === 'recording' && grabador.stop(), 30000);
}
async function decodificar(blob) {
  const ctx = new AudioContext({ sampleRate: 16000 });
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const datos = buf.getChannelData(0).slice();
  ctx.close();
  return datos;
}
$('mic').addEventListener('click', () => {
  if (grabador?.state === 'recording') { clearTimeout(corte); grabador.stop(); }
  else if (modeloListo) empezarGrabar();
});
$('btnTexto').addEventListener('click', () => { const t = $('texto').value.trim(); if (t) procesar(t, null); });

// ---------- Entender, leer de vuelta, confirmar ----------
function hablar(frase) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(frase);
  const voces = speechSynthesis.getVoices();
  u.voice = voces.find((v) => /es[-_](VE|419|US|MX|CO)/i.test(v.lang)) || voces.find((v) => v.lang.startsWith('es')) || null;
  u.lang = u.voice?.lang || 'es-419';
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

let audioActual = null;
let fotoActual = null;

// La foto se achica a 640 px y JPEG calidad 0.6 (~40-80 KB) para que pase por una conexión débil.
async function comprimirFoto(file) {
  const img = await createImageBitmap(file);
  const escala = Math.min(1, 640 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.6);
}
$('foto').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  fotoActual = await comprimirFoto(f);
  $('previa').src = fotoActual;
  $('cajaFoto').classList.remove('oculto');
  const kb = Math.round((fotoActual.length * 3) / 4 / 1024);
  $('pesoFoto').textContent = `Foto original: ${Math.round(f.size / 1024)} KB → enviada: ${kb} KB. El técnico la verá para confirmar.`;
});
function procesar(texto, blob) {
  registroActual = { ...extraer(texto), fecha: Date.now(), tiene_audio: !!blob };
  audioActual = blob;
  fotoActual = null; $('cajaFoto').classList.add('oculto'); $('foto').value = '';
  pintarResultado();
  hablar(leerDeVuelta(registroActual));
}

function pintarResultado() {
  const r = registroActual;
  $('vistaGuardado').classList.add('oculto');
  $('vistaResultado').classList.remove('oculto');
  $('corregir').classList.add('oculto');
  $('dijo').textContent = '“' + r.texto_original + '”';
  $('entendi').textContent = leerDeVuelta(r).replace('¿Entendí bien? ', '');
  const conf = $('conf');
  conf.textContent = { alta: 'seguro', media: 'más o menos seguro', baja: 'no estoy seguro' }[r.confianza];
  conf.className = 'conf ' + r.confianza;
  const filas = [
    ['Cultivo', r.cultivo_nombre], ['Observación', r.sintoma_tecnico], ['Parte de la planta', r.parte_nombre],
    ['Extensión', r.extension_nombre], ['Desde hace', r.dias ? r.dias + ' días' : null], ['Clima asociado', r.clima_nombre],
    ['Confianza', r.confianza + (r.probabilidad !== null ? ` (${r.probabilidad}% según el modelo)` : ' (reglas)')],
    ['Otras posibilidades', r.otros_posibles.join(', ') || null],
    ['Palabras clave reconocidas', r.pistas?.join(', ') || null],
  ];
  $('ficha').innerHTML = filas.map(([k, v]) => `<tr><td>${k}</td><td>${v ?? '<i>no mencionado</i>'}</td></tr>`).join('');
  // Si no está seguro, muestra de una vez los dibujos, con los más probables primero.
  if (r.confianza !== 'alta' && !r.corregido) mostrarDibujos(r.ranking || []);
  $('vistaResultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mostrarDibujos(ranking) {
  const orden = ranking.map((x) => x.id).filter((id) => id !== 'otro');
  const botones = [...$('iconos').children];
  botones.sort((a, b) => {
    const ia = orden.indexOf(a.dataset.id), ib = orden.indexOf(b.dataset.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  }).forEach((b) => { b.style.borderColor = orden.slice(0, 2).includes(b.dataset.id) ? 'var(--sol)' : ''; $('iconos').appendChild(b); });
  $('corregir').classList.remove('oculto');
}

$('btnOir').addEventListener('click', () => registroActual && hablar(leerDeVuelta(registroActual)));
$('btnNo').addEventListener('click', () => {
  mostrarDibujos(registroActual?.ranking || []);
  hablar('Toca el dibujo que más se parece a lo que ves.');
});

const DIBUJOS = { come_hojas: '🐜', roya: '🍂', broca: '🕳️', minador: '🔥', ojo_de_gallo: '⚪', mancha_hierro: '🎯', muerte_descendente: '🥀', nutricion: '🟡' };
$('iconos').innerHTML = SINTOMAS.map((s) => `<button class="icono" data-id="${s.id}"><b>${DIBUJOS[s.id]}</b>${s.sencillo}</button>`).join('')
  + '<button class="icono" data-id="no_claro"><b>❓</b>Otra cosa / no sé</button>';
$('iconos').addEventListener('click', (e) => {
  const b = e.target.closest('.icono'); if (!b || !registroActual) return;
  const s = SINTOMAS.find((x) => x.id === b.dataset.id);
  Object.assign(registroActual, s
    ? { sintoma: s.id, sintoma_tecnico: s.tecnico, sintoma_sencillo: s.sencillo, confianza: 'alta', corregido: true }
    : { sintoma: 'no_claro', sintoma_tecnico: 'No queda claro: pasa a revisión del técnico', sintoma_sencillo: null, confianza: 'baja', corregido: true });
  pintarResultado();
  hablar(leerDeVuelta(registroActual));
});

$('btnSi').addEventListener('click', () => {
  if (!registroActual) return;
  const perfil = getPerfil();
  const r = { ...registroActual, confirmado: true, finca: perfil.codigo, zona: perfil.zona, id: crypto.randomUUID(), foto: fotoActual };
  r.sms = codigoSMS(r, perfil);
  guardarEnCola(r);
  $('vistaResultado').classList.add('oculto');
  $('vistaGuardado').classList.remove('oculto');
  $('sms').textContent = r.sms;
  $('msgGuardado').textContent = sinSenal()
    ? 'No hay señal: se enviará solo cuando vuelva.'
    : 'Enviando a tu cooperativa…';
  hablar(sinSenal() ? 'Listo, lo guardé. Lo envío cuando vuelva la señal.' : 'Listo, lo guardé y lo estoy enviando.');
  registroActual = null; fotoActual = null;
  $('texto').value = '';
  pintarCola();
  intentarEnviar();
});

// ---------- Cola y envío ----------
function pintarCola() { $('nCola').textContent = getCola().length; pintarRed(); }
function intentarEnviar() {
  if (sinSenal()) return;
  const n = enviarCola();
  if (n) {
    $('msgGuardado').textContent = `📨 ${n} reporte(s) llegaron a la cooperativa.`;
  }
  pintarCola();
}
$('btnEnviar').addEventListener('click', intentarEnviar);

// ---------- Avisos de la cooperativa (aprobados por el técnico) ----------
function pintarAvisos() {
  const perfil = getPerfil();
  const avisos = getAlertas().filter((a) => !perfil || a.zona === perfil.zona).slice(-3).reverse();
  $('avisos').innerHTML = avisos.map((a, i) => `
    <div class="tarjeta aviso"><h3>📢 Aviso de tu cooperativa</h3><p>${a.mensaje}</p>
    <button class="btn sec" data-aviso="${i}">🔊 Escuchar aviso</button></div>`).join('');
  $('avisos').querySelectorAll('[data-aviso]').forEach((b) => b.addEventListener('click', () => hablar(avisos[+b.dataset.aviso].mensaje)));
}
escuchar((m) => { if (m.tipo === 'alerta') { pintarAvisos(); hablar('Tienes un aviso nuevo de tu cooperativa.'); } });
window.addEventListener('storage', pintarAvisos);

// ---------- Inicio ----------
function iniciar() {
  if (!getPerfil()) return mostrarPerfil();
  $('vistaPerfil').classList.add('oculto');
  $('vistaPrincipal').classList.remove('oculto');
  pintarCola(); pintarAvisos();
  if (!modeloListo) worker.postMessage({ tipo: 'cargar', modelo: MODELO });
  cargarClasificador().catch((e) => console.warn('Clasificador no disponible, uso reglas', e));
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
speechSynthesis?.getVoices();
iniciar();
