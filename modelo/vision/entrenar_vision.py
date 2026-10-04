"""Entrena el modelo de visión de Conuco (YOLO26n-cls, el YOLO más pequeño de Ultralytics) y lo exporta a ONNX.

  pip install ultralytics onnx onnxslim
  python3 preparar_datos.py
  python3 entrenar_vision.py      # ~20 min en una CPU de 2 núcleos, sin GPU

Salida: maiz_hojas.onnx (va a la raíz del sitio) y métricas en evaluacion_vision.json.
Licencia: los pesos base de Ultralytics son AGPL-3.0, por lo que el modelo exportado también lo es.
"""
from ultralytics import YOLO

m = YOLO('yolo26n-cls.pt')
m.train(data='ds', epochs=18, imgsz=224, batch=32, workers=2, device='cpu', plots=False, seed=7,
        patience=6, project='runs', name='maiz', exist_ok=True)
best = YOLO('runs/classify/runs/maiz/weights/best.pt')
best.export(format='onnx', imgsz=224, simplify=True, dynamic=False)
