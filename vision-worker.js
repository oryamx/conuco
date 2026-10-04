// Conuco · visión en el teléfono (Web Worker).
// Modelo: MobileNetV3-small afinado con hojas de maíz (PlantDoc + PlantVillage), exportado a ONNX (6 MB).
// Corre con ONNX Runtime Web (WebAssembly), sin internet una vez guardado en caché.
// ONNX Runtime Web, versión fija (la misma que trae transformers.js 3.7.1). El service worker la guarda para usarla sin internet.
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/ort.webgpu.min.mjs';
let ort = null;

const MODELO = './maiz_hojas.onnx';   // solo este archivo: nada de modelos externos
let sesion = null, meta = null;

async function cargar() {
  if (sesion) return;
  ort = await import(ORT);
  // Reutiliza el .wasm que ya está en caché para Whisper (misma versión).
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1/dist/';
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  meta = await (await fetch('./maiz_hojas.json')).json();
  sesion = await ort.InferenceSession.create(MODELO, { executionProviders: ['wasm'] });
  self.postMessage({ tipo: 'listo', clases: meta.clases, imgsz: meta.imgsz });
}

// Recibe píxeles RGBA ya recortados al tamaño del modelo (centro de la imagen, imgsz×imgsz).
async function clasificar(pixeles, n) {
  const area = n * n, x = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    x[i] = pixeles[i * 4] / 255;              // R
    x[area + i] = pixeles[i * 4 + 1] / 255;   // G
    x[2 * area + i] = pixeles[i * 4 + 2] / 255; // B
  }
  const entrada = new ort.Tensor('float32', x, [1, 3, n, n]);
  const salida = await sesion.run({ [sesion.inputNames[0]]: entrada });
  return Array.from(salida[sesion.outputNames[0]].data);   // probabilidades (softmax incluido en el modelo)
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.tipo === 'cargar') await cargar();
    else if (m.tipo === 'cuadro') {
      await cargar();
      const t0 = performance.now();
      const p = await clasificar(new Uint8ClampedArray(m.pixeles), m.n);
      self.postMessage({ tipo: 'resultado', id: m.id, p, ms: Math.round(performance.now() - t0) });
    }
  } catch (err) {
    self.postMessage({ tipo: 'error', mensaje: String(err?.message || err) });
  }
};
