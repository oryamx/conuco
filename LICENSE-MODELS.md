# Model licenses

- **Conuco code** (all `.js`, `.html`, `.css`, `.py` files written for this project): MIT, see `LICENSE`.
- **`maiz_hojas.onnx`** (maize-leaf vision model): fine-tuned from Ultralytics YOLO26n-cls weights, so it is distributed under **AGPL-3.0** (https://www.gnu.org/licenses/agpl-3.0.html). Training data: PlantDoc (CC BY 4.0) and PlantVillage. A production version would be retrained with a permissively licensed detector (e.g. YOLOv9 MIT, YOLOX Apache-2.0) or under an Ultralytics enterprise license.
- **`modelo_conuco.json`, `modelo_maiz.json`** (text classifiers): trained by us on our own synthetic phrases, MIT.
- **Whisper** (OpenAI, MIT), loaded from Hugging Face at a pinned commit; **transformers.js** (Apache-2.0); **ONNX Runtime Web** (MIT); **Leaflet** (BSD-2).
