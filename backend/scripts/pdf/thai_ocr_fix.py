"""
Repair the Thai text of a pdfplumber line with OpenThai 2.0 OCR Text (models/OpenThai2.0-OCR-Text, Apache-2.0).

HomePro's PDFs carry a text layer whose base characters (Thai consonants and leading vowels, Latin, digits,
punctuation) are exact, but whose Thai combining marks are broken: tone marks come out as U+FFFD, above/below
vowels land one character late, and stray spaces appear next to them ("สวา่ นไฟฟ้า", "อื�นๆ", "ค.ฉีดน�าํ").
OCR reads the marks well but misreads Latin/digits and the odd consonant ("J-C581" -> "J-CS81", "หมด" -> "หมค").

So each line is cropped out of the rendered page, OCR'd, and merged per character cluster:
  * base characters always come from the PDF,
  * marks come from OCR wherever its base characters line up with the PDF's,
  * a space between two Thai characters is kept only when both sources have it.

Usage:
    fixer = ThaiOcrFixer.load()          # None when the model or its packages are missing
    fixer.fix(page, [(pdf_text, char_list), ...]) -> [fixed_text, ...]
"""
import difflib
import os
import sys

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'OpenThai2.0-OCR-Text')

RESOLUTION = 200   # dpi; tuned on sample slips — 200 reads as well as 300/400 and renders ~2x faster
PAD_V = 3.0        # pt above/below the chars' box; PDF char boxes clip stacked tone marks below ~2.5pt
PAD_H = 2.0        # pt left/right
COL_GAP = 15.0     # pt; a wider gap between chars ends the text (e.g. the "2EA" qty/unit column)
MIN_RATIO = 0.6    # below this base-character similarity the OCR read is discarded

MARKS = set('ัิีึืฺุู็่้๊๋์ํ๎�')


def _is_thai(c: str) -> bool:
    return '฀' <= c <= '๿'


def _clusters(s: str) -> list:
    """[base, marks, space_before] per base character; SARA AM is split into NIKHAHIT (a mark) + SARA AA."""
    out, space = [], False
    for c in s.replace('ำ', 'ํา'):
        if c == ' ':
            space = True
        elif c in MARKS:
            if out:
                out[-1][1].append(c)
        else:
            out.append([c, [], space])
            space = False
    return out


def merge(pdf: str, ocr: str) -> str:
    """PDF base characters + OCR marks (see module doc). Returns the PDF text unchanged if OCR is too far off."""
    p, o = _clusters(pdf), _clusters(ocr)
    sm = difflib.SequenceMatcher(None, [c[0] for c in p], [c[0] for c in o], autojunk=False)
    if not o or sm.ratio() < MIN_RATIO:
        return pdf
    res = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        aligned = tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1)
        for n, i in enumerate(range(i1, i2)):
            base, pdf_marks, pdf_space = p[i]
            if aligned:
                marks, ocr_space = o[j1 + n][1], o[j1 + n][2]
            else:  # PDF-only stretch: keep its own marks, minus the unknown ones
                marks, ocr_space = [m for m in pdf_marks if m != '�'], pdf_space
            thai_gap = bool(res) and _is_thai(res[-1][0]) and _is_thai(base)
            res.append((base, marks, pdf_space and (ocr_space or not thai_gap)))
    text = ''.join((' ' if sp and k else '') + b + ''.join(m) for k, (b, m, sp) in enumerate(res))
    return text.replace('ํา', 'ำ')


def text_box(chars: list) -> tuple | None:
    """Bounding box (x0, top, x1, bottom) of a line's text: leading '*' and anything past a column gap dropped."""
    chs = sorted((c for c in chars if c['text'].strip()), key=lambda c: c['x0'])
    while chs and chs[0]['text'] == '*':
        chs.pop(0)
    if not chs:
        return None
    grp = [chs[0]]
    for c in chs[1:]:
        if c['x0'] - grp[-1]['x1'] > COL_GAP:
            break
        grp.append(c)
    return (min(c['x0'] for c in grp), min(c['top'] for c in grp),
            max(c['x1'] for c in grp), max(c['bottom'] for c in grp))


class ThaiOcrFixer:
    def __init__(self, ocr, canonical):
        self.ocr, self.canonical = ocr, canonical

    @classmethod
    def load(cls, threads: int = 2):
        """The fixer, or (None, reason) when OCR can't run here — callers then keep the PDF text."""
        if not os.path.isfile(os.path.join(MODEL_DIR, 'rec.onnx')):
            return None, f'ไม่พบโมเดล OCR ที่ {MODEL_DIR}'
        try:
            sys.path.insert(0, MODEL_DIR)
            from runtime.line_engine import LineOCR
            from runtime.thai_norm import canonical
            return cls(LineOCR(MODEL_DIR, threads=threads), canonical), None
        except Exception as e:  # noqa: BLE001 — missing packages etc.: degrade to PDF text
            return None, f'{type(e).__name__}: {e}'

    def fix(self, page, lines: list) -> list:
        """lines: [(pdf_text, chars)] on one pdfplumber page -> repaired texts, same order."""
        import cv2
        import numpy as np

        k = RESOLUTION / 72
        img = cv2.cvtColor(np.asarray(page.to_image(resolution=RESOLUTION).original.convert('RGB')), cv2.COLOR_RGB2BGR)
        h, w = img.shape[:2]
        crops, idx = [], []
        for n, (_, chars) in enumerate(lines):
            box = text_box(chars)
            if box is None:
                continue
            x0, top, x1, bottom = box
            crop = img[max(0, int((top - PAD_V) * k)):min(h, int((bottom + PAD_V) * k)),
                       max(0, int((x0 - PAD_H) * k)):min(w, int((x1 + PAD_H) * k))]
            if crop.size:
                crops.append(crop)
                idx.append(n)
        out = [text for text, _ in lines]
        for n, (text, _conf) in zip(idx, self.ocr.recognize(crops) if crops else []):
            out[n] = merge(lines[n][0], self.canonical(text))
        return out
