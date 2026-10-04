import glob, json, os, numpy as np, onnxruntime as ort
from PIL import Image
from ultralytics import YOLO
W='runs/classify/runs/maiz/weights/best.pt'
m=YOLO(W); names=m.names; clases=[names[i] for i in range(len(names))]
def evaluar(split):
    res={}; tot=ok=0; conf={}
    for c in sorted(os.listdir(f'ds/{split}')):
        fs=sorted(glob.glob(f'ds/{split}/{c}/*.jpg'))
        preds=m.predict(fs, imgsz=224, device='cpu', verbose=False)
        for p in preds:
            pc=names[int(p.probs.top1)]; conf.setdefault(c,{}).setdefault(pc,0); conf[c][pc]+=1
            ok+= pc==c; tot+=1
        res[c]=(conf[c].get(c,0), len(fs))
    return ok/tot, res, conf
out={}
for s in ['test_lab','test_field']:
    acc,res,conf=evaluar(s); out[s]={'accuracy':round(acc,3),'por_clase':res,'confusion':conf}
    print(s, round(acc,3), res); print('  ', conf)
path=m.export(format='onnx', imgsz=224, simplify=True, dynamic=False)
print('onnx', path, os.path.getsize(path))
# Verificación: preprocesado igual al del navegador (recorte central cuadrado → 224, RGB/255)
sess=ort.InferenceSession(path); iname=sess.get_inputs()[0].name
def js_like(f):
    im=Image.open(f).convert('RGB'); w,h=im.size; l=min(w,h)
    im=im.crop(((w-l)//2,(h-l)//2,(w-l)//2+l,(h-l)//2+l)).resize((224,224), Image.BILINEAR)
    x=np.asarray(im,dtype=np.float32).transpose(2,0,1)[None]/255.
    return sess.run(None,{iname:x})[0][0]
agree=n=0; okf=0; tf=0
for s in ['test_lab','test_field']:
    for c in sorted(os.listdir(f'ds/{s}')):
        for f in sorted(glob.glob(f'ds/{s}/{c}/*.jpg')):
            p=js_like(f); pc=clases[int(np.argmax(p))]
            pt=names[int(m.predict(f,imgsz=224,device='cpu',verbose=False)[0].probs.top1)]
            agree+= pc==pt; n+=1
            if s=='test_field': okf+= pc==c; tf+=1
print('acuerdo onnx(js-like) vs ultralytics', agree, '/', n, ' field acc js-like', okf/tf, 'sum probs', float(p.sum()))
out['onnx_bytes']=os.path.getsize(path); out['clases']=clases; out['acuerdo_onnx']=[agree,n]
json.dump(out, open('eval.json','w'), ensure_ascii=False, indent=1)
