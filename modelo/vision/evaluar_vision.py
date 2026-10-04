# Uso: python3 evaluar_vision.py maiz_hojas.onnx evaluacion.json
# Evalúa el modelo ONNX con el MISMO preprocesado que usa el navegador (recorte central cuadrado → 224, RGB/255).
import glob, os, json, sys, time, numpy as np, onnxruntime as ort
from PIL import Image
modelo, salida = sys.argv[1], sys.argv[2]
sess = ort.InferenceSession(modelo); iname = sess.get_inputs()[0].name
CL = sorted(os.listdir('ds/train'))
def pre(f):
    im = Image.open(f).convert('RGB'); w, h = im.size; l = min(w, h)
    im = im.crop(((w-l)//2, (h-l)//2, (w-l)//2+l, (h-l)//2+l)).resize((224, 224), Image.BILINEAR)
    return np.asarray(im, dtype=np.float32).transpose(2, 0, 1)[None] / 255.
out = {'clases': CL}; tiempos = []
for s in ['test_lab', 'test_field']:
    conf = {}; ok = n = 0
    for c in sorted(os.listdir(f'ds/{s}')):
        for f in sorted(glob.glob(f'ds/{s}/{c}/*.jpg')):
            x = pre(f); t0 = time.perf_counter(); p = sess.run(None, {iname: x})[0][0]; tiempos.append(time.perf_counter() - t0)
            pc = CL[int(np.argmax(p))]; conf.setdefault(c, {}).setdefault(pc, 0); conf[c][pc] += 1; ok += pc == c; n += 1
    out[s] = {'accuracy': round(ok / n, 3), 'n': n, 'por_clase': {c: [conf[c].get(c, 0), sum(conf[c].values())] for c in conf}, 'confusion': conf}
    print(s, out[s]['accuracy'], out[s]['por_clase']); print('  ', conf)
maiz = [c for c in ['mancha_gris', 'roya', 'tizon'] if c in out['test_field']['confusion']]
enf = sum(sum(out['test_field']['confusion'][c].values()) for c in maiz)
out['campo_maiz_nombre_exacto'] = [sum(out['test_field']['confusion'][c].get(c, 0) for c in maiz), enf]
out['campo_maiz_llamada_sana'] = [sum(out['test_field']['confusion'][c].get('sana', 0) for c in maiz), enf]
out['ms_por_cuadro_cpu'] = round(1000 * float(np.median(tiempos)), 1); out['onnx_bytes'] = os.path.getsize(modelo)
print('exacto', out['campo_maiz_nombre_exacto'], 'sana', out['campo_maiz_llamada_sana'], 'ms', out['ms_por_cuadro_cpu'], 'bytes', out['onnx_bytes'])
json.dump(out, open(salida, 'w'), ensure_ascii=False, indent=1)
