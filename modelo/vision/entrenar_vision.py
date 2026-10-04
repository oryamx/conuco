"""Entrena el modelo de visión de Conuco: MobileNetV3-small (timm) afinado para hojas de maíz, y lo exporta a ONNX.

  pip install torch torchvision timm onnx onnxslim
  # pesos ImageNet (Apache-2.0):
  curl -LO https://github.com/rwightman/pytorch-image-models/releases/download/v0.1-weights/tf_mobilenetv3_small_100-37f49e2b.pth
  mv tf_mobilenetv3_small_100-37f49e2b.pth mnv3s.pth
  python3 preparar_datos.py && python3 entrenar_vision.py      # ~10 min en una CPU de 2 núcleos
  python3 -m onnxslim mnv3_maiz.onnx maiz_hojas.onnx            # simplifica el grafo
  python3 evaluar_vision.py maiz_hojas.onnx evaluacion_vision.json

También probamos YOLO26n-cls (Ultralytics) con los mismos datos: rindió igual o un poco peor y su licencia es AGPL-3.0,
así que Conuco usa MobileNetV3 (ver evaluacion_vision.json).
"""
import torch, timm, json, os, time, numpy as np
from torch import nn
from torchvision import datasets, transforms as T
torch.manual_seed(7); torch.set_num_threads(2)
CL = sorted(os.listdir('ds/train'))
tr = T.Compose([T.RandomResizedCrop(224, scale=(0.5, 1)), T.RandomHorizontalFlip(), T.RandomVerticalFlip(), T.ColorJitter(.3, .3, .3, .02), T.ToTensor()])
te = T.Compose([T.Resize(224), T.CenterCrop(224), T.ToTensor()])
dtr = datasets.ImageFolder('ds/train', tr); dva = datasets.ImageFolder('ds/val', te)
assert dtr.classes == CL
ltr = torch.utils.data.DataLoader(dtr, batch_size=32, shuffle=True, num_workers=2)
lva = torch.utils.data.DataLoader(dva, batch_size=64, num_workers=2)
m = timm.create_model('tf_mobilenetv3_small_100', pretrained=False, num_classes=len(CL))
sd = torch.load('mnv3s.pth', map_location='cpu'); sd = {k: v for k, v in sd.items() if not k.startswith('classifier')}
print(m.load_state_dict(sd, strict=False))
class Envoltura(nn.Module):  # entrada RGB/255 (igual que en el navegador) → normalización TF (x*2-1) → softmax
    def __init__(s, m): super().__init__(); s.m = m
    def forward(s, x): return torch.softmax(s.m(x * 2 - 1), dim=1)
def acc(loader):
    m.eval(); ok = n = 0
    with torch.no_grad():
        for x, y in loader: p = m(x * 2 - 1).argmax(1); ok += (p == y).sum().item(); n += len(y)
    return ok / n
opt = torch.optim.AdamW(m.parameters(), lr=1e-3, weight_decay=1e-4)
E = 14; sch = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=1e-3, total_steps=E * len(ltr))
mejor = 0
for e in range(E):
    m.train(); t0 = time.time(); tl = 0
    for x, y in ltr:
        opt.zero_grad(); l = nn.functional.cross_entropy(m(x * 2 - 1), y, label_smoothing=0.1); l.backward(); opt.step(); sch.step(); tl += l.item()
    a = acc(lva); print(f'epoca {e+1} loss {tl/len(ltr):.3f} val {a:.3f} {time.time()-t0:.0f}s', flush=True)
    if a >= mejor: mejor = a; torch.save(m.state_dict(), 'mnv3_best.pt')
m.load_state_dict(torch.load('mnv3_best.pt')); m.eval()
torch.onnx.export(Envoltura(m), torch.zeros(1, 3, 224, 224), 'mnv3_maiz.onnx', input_names=['images'], output_names=['output0'], opset_version=17, dynamo=False)
json.dump({'clases': CL, 'val': mejor}, open('mnv3_meta.json', 'w'))
print('listo', os.path.getsize('mnv3_maiz.onnx'))
