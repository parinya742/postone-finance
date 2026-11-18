---
license: apache-2.0
language:
- th
- en
tags:
- ocr
- thai
- onnx
- openvino
- text-recognition
- text-detection
pipeline_tag: image-to-text
---

<p align="center"><img src="https://huggingface.co/datasets/iapp/OpenThai2.0-model-card-assets/resolve/main/openthai-iapp-logos.png" alt="OpenThai · iApp Technology" width="460"></p>

# OpenThai2.0-OCR-Text

**Fast Thai + English printed-text OCR that runs on a CPU.** It is the engine behind iApp Document OCR v3.0, released as open weights with its runtime.

- **Detector:** PP-OCRv6-tiny (1.8 MB).
- **Recognizer:** a Thai CTC line recognizer trained by iApp (2.4 MB).
- **Runtime:** ONNX models on OpenVINO (or ONNX Runtime), CPU only. About 0.5 CPU-seconds per dense A4 page, roughly 950 pages a minute on 8 Xeon cores.

It reads a page image and returns its text in reading order, with a box and a confidence for every line. It does not write tables or Markdown; for that, see OpenThai2.0-OCR-Markdown.

**Step-by-step guide for Windows, Mac and Linux** (installing Python, reading pictures and PDFs, a ready script): [English](https://iapp.co.th/en/blog/openthai2p0-ocr-how-to-run) · [ภาษาไทย](https://iapp.co.th/blog/openthai2p0-ocr-how-to-run) · [中文](https://iapp.co.th/zh-CN/blog/openthai2p0-ocr-how-to-run)

## Model at a glance

<table>
<tr><td><b>Parameters</b></td><td>1.02M in all: detector 428K (PP-OCRv6-tiny), recognizer 587K</td></tr>
<tr><td><b>Files</b></td><td><code>det.onnx</code> 1.8 MB and <code>rec.onnx</code> 2.4 MB, float32; OpenVINO runs them in bfloat16 on CPUs with AMX</td></tr>
<tr><td><b>Recognizer</b></td><td>CTC over text lines 48 pixels high; 530 output classes from a 528-character Thai and English dictionary</td></tr>
<tr><td><b>Output</b></td><td>the page's text in reading order, with a box and a confidence for every line</td></tr>
<tr><td><b>Languages</b></td><td>Thai and English, printed</td></tr>
<tr><td><b>Hardware</b></td><td>CPU only; no GPU needed</td></tr>
<tr><td><b>Speed</b></td><td>0.39 s per dense A4 page, one page at a time; 0.5 CPU-seconds a page, about 950 pages a minute on 8 Xeon cores</td></tr>
<tr><td><b>Memory</b></td><td>about 450 MB of RAM per worker process</td></tr>
<tr><td><b>Base</b></td><td>PaddlePaddle PP-OCRv6-tiny: the detector as shipped, the recognizer fine-tuned from it with a new Thai output layer</td></tr>
<tr><td><b>Training data</b></td><td>410,270 real text lines (court scans, parliament budget PDFs, Wikisource old books) and synthetic lines</td></tr>
<tr><td><b>Licence</b></td><td>Apache-2.0</td></tr>
<tr><td><b>Version</b></td><td>v1.0.0, November 2026</td></tr>
</table>

## How it compares

Every engine read the same pages and was scored the same way. The score is character accuracy, 100 × (1 − CER), so higher is better, against checked gold, after markup is stripped from both sides; reading order counts. A page an engine fails on counts as empty.

The 12 printed sets: parliament budget documents and Royal Gazette pages (each as a hand-verified set and as a larger set), SEA-DocBench Thai, Wikisource old books, Administrative Court judgments (50 documents), ThaiOCRBench full pages, th-docs-tables text-only pages, and three OCR104 sets (document crops, Thai+English crops, document photos). The table shows six of them, with handwriting, which is not in the average.

![OpenThai2.0-OCR-Text against 14 other OCR engines: average over 12 printed sets, court judgments, Royal Gazette, budget, old books, ThaiOCRBench, handwriting, seconds per page](https://huggingface.co/datasets/iapp/OpenThai2.0-model-card-assets/resolve/main/openthai2-ocr-text-benchmark.png)

<!-- BEGIN accuracy -->
| Engine | Average, 12 printed sets | Court judgments | Royal Gazette | Budget (verified) | Old books | ThaiOCRBench | Handwriting |
|---|---|---|---|---|---|---|---|
| **OpenThai2.0-OCR-Text (this model)** | 87.8 | **97.0** | 96.3 | 99.5 | 77.1 | 82.0 | 10.3 |
| OpenThai2.0-OCR-Markdown (our page-to-Markdown model) | **90.3** | 96.2 | **98.0** | 98.2 | **79.7** | 90.6 | 78.9 |
| Typhoon OCR V2 2B | 89.6 | 96.2 | 94.6 | 97.3 | 77.2 | 87.3 | 76.7 |
| Typhoon OCR 1.5 2B | 87.5 | 92.4 | 92.5 | 97.2 | 78.6 | 71.4 | **94.5** |
| Gemini 2.5 Flash | 87.1 | 94.7 | 92.6 | 81.0 | 77.9 | 88.8 | 86.7 |
| dots.mocr | 86.4 | 96.3 | 93.1 | 99.5 | 76.3 | 78.8 | 39.4 |
| OneOCR (Microsoft, Windows) | 85.0 | 95.1 | 96.6 | **99.8** | 78.6 | 81.8 | 91.0 |
| Google Cloud Vision | 83.6 | 93.9 | 87.8 | 75.0 | 73.6 | 85.6 | 60.8 |
| PaddleOCR 3 PP-OCRv5 (th) | 81.1 | 90.4 | 82.9 | 93.1 | 55.5 | 75.8 | 41.6 |
| Qwen3.5-9B | 80.1 | 34.5 | 88.2 | 91.8 | 68.5 | 82.0 | 54.1 |
| NVIDIA Nemotron 3.5 Parse (default: boxes, classes, Markdown) | 89.0 | 96.9 | 92.2 | 98.9 | 76.9 | **92.0** | 57.3 |
| NVIDIA Nemotron 3.5 Parse (plain-text prompt) | 77.3 | 82.9 | 78.8 | 83.0 | 71.7 | 84.7 | 41.1 |
| Tesseract 5 (tha+eng) | 75.4 | 71.7 | 82.3 | 71.3 | 52.2 | 75.0 | 26.4 |
| PaddleOCR-VL 1.6 | 72.4 | 80.8 | 79.7 | 70.3 | 57.6 | 68.2 | 13.4 |
| DeepSeek-OCR-2 | 69.0 | 92.8 | 84.7 | 91.4 | 55.2 | 77.5 | 3.9 |

**Bold** marks the best score in each column. The average is over the 12 printed sets listed above the table; handwriting is not in it.
<!-- END accuracy -->

## Speed

<!-- BEGIN speed -->
| Engine | Runs on | Seconds per page | CPU seconds per page |
|---|---|---|---|
| **OpenThai2.0-OCR-Text (this model)** | CPU | **0.39** | **0.504** |
| OpenThai2.0-OCR-Markdown (our page-to-Markdown model) ‡ | GPU (H100) | 2.97 | — |
| Typhoon OCR V2 2B † | GPU (H100) | 16.72 | — |
| Typhoon OCR 1.5 2B | GPU (H100) | 2.79 | — |
| Gemini 2.5 Flash | API | 3.33 | — |
| dots.mocr | GPU (H100) | 4.78 | — |
| OneOCR (Microsoft, Windows) | CPU | 0.72 | 2.22 |
| Google Cloud Vision | API | 0.99 | — |
| PaddleOCR 3 PP-OCRv5 (th) | CPU | 15.20 | 16.291 |
| Qwen3.5-9B | GPU (H100) | 3.81 | — |
| NVIDIA Nemotron 3.5 Parse (default: boxes, classes, Markdown) ‡ | GPU (H100) | 3.04 | — |
| NVIDIA Nemotron 3.5 Parse (plain-text prompt) ‡ | GPU (H100) | 3.99 | — |
| Tesseract 5 (tha+eng) | CPU | 1.40 | 1.662 |
| PaddleOCR-VL 1.6 § | GPU (H100) | 1.71 | — |
| DeepSeek-OCR-2 | GPU (H100) | 1.81 | — |

**Bold** marks the fastest in each column.

One page at a time, the engine alone on its GPU or API. Most engines read the same 24 printed pages from the sets above. ‡ Nemotron 3.5 Parse and OpenThai2.0-OCR-Markdown: 24 court-judgment pages (full A4 pages of dense text). † Typhoon OCR V2 2B: the 65 th-docs-tables pages, served with `--enforce-eager`, which it needs on our vLLM version. § PaddleOCR-VL 1.6: every sample page, one at a time. CPU seconds are one single-threaded worker on an Intel Xeon 8468 core; at 0.504 CPU seconds a page, this model reads about 950 pages a minute on 8 cores. On shorter pages the GPU models are faster: OpenThai2.0-OCR-Markdown's own card gives 1.6 s a page, the median of 12 table pages.
<!-- END speed -->

## Use

The guide above walks through installation on Windows, Mac and Linux, with a script for pictures and PDFs: [English](https://iapp.co.th/en/blog/openthai2p0-ocr-how-to-run) · [ภาษาไทย](https://iapp.co.th/blog/openthai2p0-ocr-how-to-run) · [中文](https://iapp.co.th/zh-CN/blog/openthai2p0-ocr-how-to-run). The minimal use:

```python
from runtime.line_engine import LineOCR      # needs openvino (or onnxruntime), opencv-python-headless, pyclipper, numpy

ocr = LineOCR(".", threads=1)                # this folder: det.onnx, rec.onnx, rec_dict.txt, config.json
r = ocr.read("page.png")                     # path, bytes, BGR ndarray or PIL image
print(r["text"])                             # lines in reading order (columns one after another)
r["lines"]                                   # [{"text", "confidence", "row", "box"}]; boxes in the input image's coordinates
r["rotation"], r["text_angle"]               # quarter turns applied (0/90/180/270) and the page's text angle in degrees
```

**For throughput, run one worker process per core with `threads=1`.** Threads in one process stop scaling at about 2 cores, because the Python parts hold the GIL.

## What the runtime handles

- **Page orientation from the text itself:** sideways and upside-down pages are turned the way their lines read best.
- **Deskew** above 2.5°, then a second detection; boxes come back in the caller's coordinates.
- **Reading order:** two- and three-column pages are read column by column; tables, budget pages and lists numbered across the row stay in row order.
- **Colour:** each column's background is subtracted, so light-on-dark text, coloured slides and gradients read.
- **Clean-up:** detached-mark fragments are dropped, lines merged across a gutter are split, and Thai/Latin look-alikes are fixed (a lone W glued to Thai becomes พ).

Robustness suite: 22 generated conditions (rotation, tilt, huge and tiny text, colour, faded print, photocopy noise, phone photos, tables, columns), 20 held-out pages each, bars fixed before the first run. **All 22 pass.**

## Files

| File | What |
|---|---|
| `det.onnx`, `det.yml` | Text-line detector: PaddlePaddle PP-OCRv6-tiny, Apache-2.0, as shipped |
| `rec.onnx`, `rec_dict.txt` | Thai CTC line recognizer. Input `[N, 3, 48, W]`; output softmax `[N, W/8, 530]` |
| `config.json` | Line filter (`drop_below 0.8, junk_below 0.9, junk_invalid 0.05, min_chars 2`) and crop handling (`color: flatten`) |
| `pytorch/rec_weights.pt` | Recognizer weights for further training (transformers `PPOCRV6TinyRecForTextRecognition`, classifier replaced) |
| `runtime/line_engine.py`, `runtime/thai_norm.py` | The runtime |

## Training

The recognizer starts from the PP-OCRv6-tiny recognizer (Apache-2.0) with a new Thai output layer, fine-tuned with CTC on:

- **synthetic Thai/English lines** rendered on the fly from 85 OFL/TLWG fonts plus 29 bold weights, with court-text, dictionary, numeric and field strings, English from wikitext, short labels and cross-script look-alike drills;
- **261,877 Administrative Court scan lines,** labelled with the court's own DOC text;
- **41,101 parliament budget-PDF lines,** text-layer labels kept only where the recognizer independently agrees;
- **107,292 Wikisource old-book lines** (level-3 pages; the level-4 pages are a test set).

No OneOCR output and no Gemini labels were used, no personal-data sets, and every benchmark document is excluded by document.

## Acknowledgements

The recognizer was trained on NVIDIA H100 GPUs provided by Siam AI. The detector and the recognizer's starting point are PaddlePaddle's PP-OCRv6-tiny.

## Limitations

- **Printed text only.** Handwriting and scene text are weak (see the table); use a VLM for those.
- **Decorative display fonts:** short labels in heavily stylised fonts can be misread.
- **Stamps and seals come out as text,** as they are text on the page.
- **Court judgments are in-domain:** court scans (other documents than the 150 tested) are in the training data.
- **The bf16 speed needs AMX** (Sapphire Rapids or later); OpenVINO falls back to fp32 on other CPUs.

PP-OCRv6 models © PaddlePaddle authors, Apache-2.0; see `NOTICE`.
