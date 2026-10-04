# Licenses of code and models

Everything in Conuco uses permissive licenses.

- **Conuco code** (all `.js`, `.html`, `.css`, `.py` files written for this project): MIT, see `LICENSE`.
- **`maiz_hojas.onnx`** (maize-leaf vision model): MobileNetV3-small fine-tuned by us. Base ImageNet weights from timm (`tf_mobilenetv3_small_100`), Apache-2.0. Training data: PlantDoc (CC BY 4.0) and PlantVillage.
- **`modelo_conuco.json`, `modelo_maiz.json`** (text classifiers): trained by us on our own synthetic phrases, MIT.
- **Whisper** (OpenAI, MIT), loaded from Hugging Face at a pinned commit; **transformers.js** (Apache-2.0); **ONNX Runtime Web** (MIT); **Leaflet** (BSD-2).
- We also benchmarked Ultralytics YOLO26n-cls (AGPL-3.0) on the same data; it is **not** included in this repository (results only, in `modelo/vision/evaluacion_vision.json`).
