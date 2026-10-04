// Conuco · "Muéstrame la hoja": análisis de video en el teléfono.
// La cámara (o un video grabado) se mira cuadro por cuadro con un modelo de visión pequeño (MobileNetV3);
// se promedian varios cuadros y solo se da una respuesta cuando es estable.
// No diagnostica: dice con qué es "compatible" y el técnico confirma.

export const CLASES_VISION = {
  roya: { nombre: 'roya común del maíz', tecnico: 'roya común (Puccinia sorghi)', sencillo: 'polvillo color óxido en las hojas', enfermedad: true },
  tizon: { nombre: 'tizón de la hoja del maíz', tecnico: 'tizón foliar del norte (Exserohilum turcicum)', sencillo: 'manchas largas color paja en las hojas', enfermedad: true },
  mancha_gris: { nombre: 'mancha gris de la hoja', tecnico: 'mancha gris (Cercospora zeae-maydis)', sencillo: 'manchas grises alargadas en las hojas', enfermedad: true },
  sana: { nombre: 'hoja sana', tecnico: 'hoja sin síntomas visibles', sencillo: 'la hoja se ve sana', enfermedad: false },
  otra: { nombre: 'otra cosa', tecnico: 'no reconocida como hoja de maíz', sencillo: 'no parece una hoja de maíz que yo conozca', enfermedad: false },
};

const UMBRAL_ALTA = 0.7, UMBRAL_MEDIA = 0.5;
const VENTANA = 8;          // cuadros que se promedian
const CADA_MS = 300;        // un cuadro cada 0,3 s
const MAX_CUADROS_VIDEO = 16;

const $ = (id) => document.getElementById(id);
let worker = null, clases = null, n = 224, ocupado = false, pedidos = 0;
let pendiente = null;

function iniciarWorker() {
  if (worker) return Promise.resolve();
  worker = new Worker('./vision-worker.js', { type: 'module' });
  return new Promise((ok, mal) => {
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.tipo === 'listo') { clases = m.clases; n = m.imgsz; ok(); }
      else if (m.tipo === 'resultado' && pendiente) { const p = pendiente; pendiente = null; p(m); }
      else if (m.tipo === 'error') { mal(new Error(m.mensaje)); estado('⚠️ No pude cargar el modelo de la cámara: ' + m.mensaje); }
    };
    worker.postMessage({ tipo: 'cargar' });
  });
}

// Recorta el centro de la imagen (cuadrado) y lo lleva a n×n, igual que en el entrenamiento.
const lienzo = document.createElement('canvas');
function pixelesDe(fuente, ancho, alto) {
  lienzo.width = n; lienzo.height = n;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  const lado = Math.min(ancho, alto);
  ctx.drawImage(fuente, (ancho - lado) / 2, (alto - lado) / 2, lado, lado, 0, 0, n, n);
  return ctx.getImageData(0, 0, n, n).data.buffer;
}
function clasificar(fuente, ancho, alto) {
  const buf = pixelesDe(fuente, ancho, alto);
  return new Promise((ok) => { pendiente = ok; worker.postMessage({ tipo: 'cuadro', id: ++pedidos, pixeles: buf, n }, [buf]); });
}

function promedio(lista) {
  const s = new Array(clases.length).fill(0);
  lista.forEach((p) => p.forEach((v, i) => { s[i] += v / lista.length; }));
  return s;
}
const top = (p) => p.reduce((b, v, i) => (v > p[b] ? i : b), 0);

function estado(t) { $('camEstado').textContent = t; }
function pintarBarras(p, cuadros) {
  const orden = p.map((v, i) => [clases[i], v]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  $('camBarras').innerHTML = orden.map(([c, v]) =>
    `<div class="barra"><span>${CLASES_VISION[c]?.nombre || c}</span><i style="width:${Math.round(v * 100)}%"></i><b>${Math.round(v * 100)}%</b></div>`).join('')
    + `<div class="pista">${cuadros} cuadro(s) analizados en el teléfono</div>`;
}

// Foto de evidencia para el técnico: el cuadro actual, 640 px, JPEG (sin metadatos).
function fotoDe(fuente, ancho, alto) {
  const c = document.createElement('canvas');
  const e = Math.min(1, 640 / Math.max(ancho, alto));
  c.width = Math.round(ancho * e); c.height = Math.round(alto * e);
  c.getContext('2d').drawImage(fuente, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.6);
}

function resultadoDe(historia, foto, ms) {
  const p = promedio(historia);
  const i = top(p);
  const votos = historia.filter((h) => top(h) === i).length / historia.length;
  return { clase: clases[i], p: p[i], votos, cuadros: historia.length, ms, foto, ranking: p.map((v, k) => ({ id: clases[k], p: Math.round(v * 100) })).sort((a, b) => b.p - a.p) };
}

// ---------- Cámara en vivo ----------
let stream = null, bucle = null;
export async function abrirCamara(alResultado) {
  $('camaraCaja').classList.remove('oculto');
  estado('Cargando el modelo de la cámara…');
  await iniciarWorker();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 } }, audio: false });
  } catch {
    estado('No pude abrir la cámara. Revisa el permiso, o usa "Analizar un video o foto".');
    return;
  }
  const v = $('camVideo');
  v.srcObject = stream; v.classList.remove('oculto'); await v.play();
  estado('Apunta a una hoja de maíz, de cerca y con luz. Mantén quieto el teléfono…');
  const historia = []; let ms = 0;
  bucle = setInterval(async () => {
    if (ocupado || !v.videoWidth) return;
    ocupado = true;
    const r = await clasificar(v, v.videoWidth, v.videoHeight);
    ocupado = false; ms = r.ms;
    historia.push(r.p); if (historia.length > VENTANA) historia.shift();
    const p = promedio(historia); pintarBarras(p, historia.length);
    const res = resultadoDe(historia, null, ms);
    // Estable: ventana llena, la misma clase gana en ≥75% de los cuadros y el promedio es alto.
    if (historia.length >= VENTANA && res.votos >= 0.75 && res.p >= UMBRAL_MEDIA) {
      res.foto = fotoDe(v, v.videoWidth, v.videoHeight);
      cerrarCamara(false);
      alResultado(res);
    } else if (historia.length >= VENTANA) estado('Todavía no estoy seguro. Acércate más a la hoja o busca mejor luz.');
  }, CADA_MS);
}
export function cerrarCamara(ocultar = true) {
  clearInterval(bucle); bucle = null; ocupado = false;
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
  $('camVideo').classList.add('oculto');
  if (ocultar) $('camaraCaja').classList.add('oculto');
}

// ---------- Video o foto ya grabados ----------
export async function analizarArchivo(file, alResultado) {
  $('camaraCaja').classList.remove('oculto');
  estado('Cargando el modelo de la cámara…');
  await iniciarWorker();
  if (file.type.startsWith('image/')) {
    const img = await createImageBitmap(file);
    const r = await clasificar(img, img.width, img.height);
    pintarBarras(r.p, 1);
    return alResultado(resultadoDe([r.p], fotoDe(img, img.width, img.height), r.ms));
  }
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.src = URL.createObjectURL(file);
  await new Promise((ok, mal) => { v.onloadeddata = ok; v.onerror = () => mal(new Error('video')); }).catch(() => null);
  if (!v.videoWidth) { estado('No pude leer ese video. Prueba con otro, o con una foto.'); return; }
  const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
  const k = Math.max(1, Math.min(MAX_CUADROS_VIDEO, Math.floor(dur * 3)));
  const historia = []; let ms = 0, mejorFoto = null, mejorP = -1;
  for (let j = 0; j < k; j++) {
    v.currentTime = Math.min(dur - 0.05, (dur * (j + 0.5)) / k);
    await new Promise((ok) => { v.onseeked = ok; });
    const r = await clasificar(v, v.videoWidth, v.videoHeight);
    historia.push(r.p); ms = r.ms;
    pintarBarras(promedio(historia), historia.length);
    estado(`Mirando el video… cuadro ${j + 1} de ${k}`);
    const mx = Math.max(...r.p);
    if (mx > mejorP) { mejorP = mx; mejorFoto = fotoDe(v, v.videoWidth, v.videoHeight); }
  }
  URL.revokeObjectURL(v.src);
  alResultado(resultadoDe(historia, mejorFoto, ms));
}

export const UMBRALES_VISION = { UMBRAL_ALTA, UMBRAL_MEDIA };
