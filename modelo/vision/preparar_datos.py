"""Prepara el dataset de hojas de maíz para el modelo de visión de Conuco.

Fuentes (descargar antes en esta carpeta):
  git clone https://github.com/pratikkayal/PlantDoc-Dataset pd       # fotos "en el campo"/internet, CC BY 4.0
  git clone https://github.com/spMohanty/PlantVillage-Dataset pv     # fotos de laboratorio (hoja sobre fondo liso)

Clases: roya, tizon, mancha_gris, sana, otra (hojas de otros cultivos).
- PlantVillage: 260 imágenes por clase de maíz (170 train / 30 val / 60 prueba "laboratorio").
- PlantDoc: maíz enfermo + hojas de otros cultivos ("otra"); su carpeta test = prueba "campo".
- PlantDoc no trae maíz sano: la clase "sana" solo tiene fotos de laboratorio (limitación conocida).
"""
import os, random, glob, hashlib
from PIL import Image, ImageOps
random.seed(7)
OUT='ds'; 
def save(src, split, cls):
    d=f'{OUT}/{split}/{cls}'; os.makedirs(d,exist_ok=True)
    try:
        im=Image.open(src); im=ImageOps.exif_transpose(im).convert('RGB')
    except Exception as e:
        print('skip',src,e); return
    im.thumbnail((320,320)) if min(im.size)<=320 else im.resize((int(im.width*288/min(im.size)), int(im.height*288/min(im.size))))
    h=hashlib.md5(src.encode()).hexdigest()[:10]
    im.save(f'{d}/{h}.jpg', quality=90)
PV={'mancha_gris':'Cercospora_leaf_spot Gray_leaf_spot','roya':'Common_rust_','tizon':'Northern_Leaf_Blight','sana':'healthy'}
for c,d in PV.items():
    fs=sorted(glob.glob(f'pv/raw/color/Corn_(maize)___{d}/*')); random.shuffle(fs)
    for f in fs[:170]: save(f,'train',c)
    for f in fs[170:200]: save(f,'val',c)
    for f in fs[200:]: save(f,'test_lab',c)
PD={'mancha_gris':'Corn Gray leaf spot','roya':'Corn rust leaf','tizon':'Corn leaf blight'}
OTRA=['Soyabean leaf','Tomato leaf','Potato leaf early blight','Bell_pepper leaf','Squash Powdery mildew leaf','grape leaf','Apple leaf']
for c,d in list(PD.items())+[('otra',o) for o in OTRA]:
    fs=sorted(glob.glob(f'pd/train/{d}/*')); random.shuffle(fs)
    nv=max(2,len(fs)//8)
    for f in fs[nv:]: save(f,'train',c)
    for f in fs[:nv]: save(f,'val',c)
    for f in glob.glob(f'pd/test/{d}/*'): save(f,'test_field',c)
for s in ['train','val','test_lab','test_field']:
    print(s,{c:len(os.listdir(f'{OUT}/{s}/{c}')) for c in sorted(os.listdir(f'{OUT}/{s}'))})
