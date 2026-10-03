// Reconocimiento de voz 100% en el dispositivo (Whisper vía transformers.js / ONNX en WebAssembly).
// La primera vez descarga el modelo y lo guarda en la caché del navegador; después funciona sin internet.
import { pipeline, env } from './transformers.min.js';

env.allowLocalModels = true;
env.localModelPath = './models/';          // si los modelos se "side-loadean" en /models, se usan primero
env.useBrowserCache = true;
// El motor ONNX (WebAssembly, ~21 MB) viene del CDN y el service worker lo guarda para usarlo offline.
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1/dist/';

// Commits fijos de los modelos (verificados el 3 oct 2026)
const REVISION = {
  'onnx-community/whisper-base': '1846881b6b3a3024392c1eea3ad983695bc23925',
  'onnx-community/whisper-tiny': 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7',
};
const PERMITIDOS = Object.keys(REVISION);

let asr = null;
let modeloActual = null;

async function cargar(modelo) {
  if (!PERMITIDOS.includes(modelo)) throw new Error('modelo no permitido');
  if (asr && modeloActual === modelo) return asr;
  asr = await pipeline('automatic-speech-recognition', modelo, {
    revision: REVISION[modelo] || 'main', // versión fija del modelo: si alguien cambia el repositorio de origen, no nos afecta
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p) => {
      if (p.status === 'progress') self.postMessage({ tipo: 'progreso', archivo: p.file, pct: Math.round(p.progress || 0) });
    },
  });
  modeloActual = modelo;
  return asr;
}

self.onmessage = async (e) => {
  const { tipo, modelo, audio } = e.data;
  try {
    if (tipo === 'cargar') {
      await cargar(modelo);
      self.postMessage({ tipo: 'listo' });
    } else if (tipo === 'transcribir') {
      const a = await cargar(modelo);
      const t0 = performance.now();
      const out = await a(audio, { language: 'spanish', task: 'transcribe', chunk_length_s: 30 });
      self.postMessage({ tipo: 'texto', texto: (out.text || '').trim(), segundos: (performance.now() - t0) / 1000 });
    }
  } catch (err) {
    self.postMessage({ tipo: 'error', error: String(err) });
  }
};
