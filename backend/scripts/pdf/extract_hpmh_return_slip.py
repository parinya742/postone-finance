"""
Extract the header and line items of an HP-MH (HomePro / MegaHome) return slip PDF (ใบคืนสินค้า / RETURN SLIP).

Usage:  python extract_hpmh_return_slip.py <file.pdf>
Output: JSON on stdout.

Thai text decodes with broken marks (U+FFFD tone marks, vowels shifted one character), but every value we need
is Latin/digits, so the regexes anchor on values rather than Thai labels. The Thai item descriptions and remarks
are then repaired with OCR (thai_ocr_fix.py: PDF base characters + OCR marks); without the OCR model or its
packages the PDF text is kept as is. pdfplumber lays each page out as:

    50297501802026                                     <- barcode: article doc no + fiscal year
    สาขา : S021 PETCHKASEM เลขที่คืนสินค้า : 5029750180
    สถานที่เก็บสินค้า : 0003 วันที่บันทึกคืนสินค้า : 01/11/2026
    รหัสร้านค้า : 501447 เวลา : 14:26:32 หน้าที่ 1 / 1
    พัมคิน คอร์ปอเรชั่น Delivery notes : 1210226244         <- vendor name
    เลขที่ 4 ซอยพระรามที่ 2 10150 Buyer : 021 PETCHKASEM Tel/Ext : 0 2444 4699    <- vendor address, branch tel
    ผู้ติดต่อ : คุณสาธิดา สายสุวรรณ์ Tel : 028995928 Created By : ADMIN_S021 Tel/Ext :   <- vendor contact
    Item VD Article Batch AC/CO/PO MVT S PO# หน่วย จำนวน @ จำนวนเงิน
    Part# รายการสินค้า Reference ไม่รวมภาษี                <- table starts after this line
    1 31543 1193362 4311924202/10 161 4311924202 EA 2 6,571.96 13,143.92
    ปั๊มลม OIL FREE PUMPKIN MEGATON II 50 L 2EA           <- description + qty in base unit (own column)
    ***คืนตามคำสั่ง Mail                                  <- remarks: 1st = return reason (may spill onto the next page)
    รวม 2 13,143.92                                       <- last page only
    Total B.U 2
    PO Text :
    GR Text : 1158/57879คืน
    ผู้รับสินค้าคืน ........                                <- footer: table ends

Thai national ID numbers (13 digits, e.g. a customer named in a remark) are masked before anything is output.
"""
import json
import os
import re
import sys
import time

import pdfplumber

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from thai_ocr_fix import COL_GAP, ThaiOcrFixer  # noqa: E402

NUM = r'-?[\d,]+(?:\.\d+)?'
MONEY = r'-?[\d,]+\.\d{2}'

BARCODE = re.compile(r'^(?P<doc_no>\d{10})(?P<year>\d{4})$')
SITE = re.compile(r':\s*(?P<site_code>[A-Z]\d{3})\s+(?P<site>.+?)\s+[^\s:]+\s*:\s*(?P<doc_no>\d{10})\s*$')
SLOC = re.compile(r':\s*(?P<sloc>\d{4})\s+.*:\s*(?P<date>\d{2}/\d{2}/\d{4})\s*$')
VENDOR = re.compile(r':\s*(?P<vendor>\d+)\s+.*?:\s*(?P<time>\d{2}:\d{2}:\d{2})\s+.*?(?P<page>\d+)\s*/\s*(?P<pages>\d+)\s*$')
DELIVERY = re.compile(r'Delivery notes\s*:\s*(?P<v>\S*)')
BUYER = re.compile(r'Buyer\s*:\s*(?P<v>.*?)\s*Tel/Ext')
CREATED = re.compile(r'Created By\s*:\s*(?P<v>\S+)')
VENDOR_NAME = re.compile(r'^(?P<v>.*?)\s*Delivery notes\s*:')
ADDRESS = re.compile(r'^(?P<v>.*?)\s*Buyer\s*:')
SITE_TEL = re.compile(r'Buyer\s*:.*?Tel/Ext\s*:\s*(?P<v>.*)$')
CONTACT = re.compile(r'^[^:]*:\s*(?P<contact>.*?)\s*Tel\s*:\s*(?P<tel>.*?)\s*Created By\s*:')
SITE_TEL2 = re.compile(r'Created By\s*:\s*\S+\s*Tel/Ext\s*:\s*(?P<v>.*)$')
BUYER_CODE = re.compile(r'^(?P<code>[A-Z0-9]{2,4})\s+(?P<name>.+)$')   # "021 PETCHKASEM", "R01 Store Return"
BASE_QTY = re.compile(r'^(?P<qty>[\d,.]+)(?P<unit>[A-Z]{1,5})$')      # "2EA" — qty in base unit, own column
REV = re.compile(r'REV\.?\s*(?P<doc>\d{10})')                           # reversal of another slip, in a remark
# 13-digit Thai national ID, also written in groups: "3451000404448", "5 4114 00020 10 4", "1-2499-12345-88-1"
THAI_ID = re.compile(r'(?<![\d-])(\d)[ -]?(\d{4})[ -]?(\d{5})[ -]?(\d{2})[ -]?(\d)(?![\d-])')
# The 1st "***" line is the return reason ("อื่นๆ", "สินค้าชำรุด/มีตำหนิ", "เปลี่ยน Package", ...) — unless the slip has
# no reason line and it is a note instead: a person, an ID, a REV/VD reference, a long number
NOT_REASON = re.compile(r'\d{4,}|xxxxx|^(?:REV|VD)\b|^(?:REV|VD)\.|^(?:นาย|นาง|น\.ส\.|คุณ)')
PO_TEXT = re.compile(r'^PO Text\s*:\s*(?P<v>.*)$')
GR_TEXT = re.compile(r'^GR Text\s*:\s*(?P<v>.*)$')

ITEM = re.compile(
    r'^(?P<item>\d+)\s+(?P<pre>.+?)\s+(?P<po>\d+/\d+)\s+(?P<mvt>\d{3})\s+'
    r'(?:(?P<s>[A-Z])\s+)?(?:(?P<ref>\d+)\s+)?(?P<unit>[A-Z]{1,5})\s+'
    rf'(?P<qty>{NUM})\s+(?P<price>{MONEY})\s+(?P<amount>{MONEY})$'
)
TOTAL = re.compile(rf'^รวม\s+(?P<qty>{NUM})\s+(?P<amount>{MONEY})$')
TOTAL_BU = re.compile(rf'^Total B\.U\s+(?P<qty>{NUM})$')
QTY_SUFFIX = re.compile(r'\s+[\d,.]+\s*[A-Z]{1,5}$')   # "... 50 L 2EA" -> "... 50 L"
THAI = re.compile(r'[฀-๿�]')
FOOTER = re.compile(r'\.{10,}|^RTV / Credit memo')


def num(s: str) -> float:
    return float(s.replace(',', ''))


def groups(chars: list) -> list:
    """A line's characters split into columns at gaps wider than COL_GAP."""
    chs = sorted((c for c in chars if c['text'].strip()), key=lambda c: c['x0'])
    out = []
    for c in chs:
        if out and c['x0'] - out[-1][-1]['x1'] <= COL_GAP:
            out[-1].append(c)
        else:
            out.append([c])
    return out


def group_text(g: list) -> str:
    return ''.join(c['text'] for c in g)


def mask_ids(s):
    """PDPA: 3451000404448 -> 3-4510-xxxxx-44-8 (13-digit Thai national ID numbers in free text)."""
    return THAI_ID.sub(lambda m: f'{m[1]}-{m[2]}-xxxxx-{m[4]}-{m[5]}', s) if isinstance(s, str) else s


def extract(path: str, fixer=None, ocr_error: str | None = None) -> dict:
    """fixer: a loaded ThaiOcrFixer (None = keep the PDF's Thai text; ocr_error says why)."""
    head: dict = {}
    items: list = []
    warnings: list = []
    total = total_qty = total_bu = None
    current = None   # item that description/remark lines attach to
    ocr_lines = ocr_ms = 0

    with pdfplumber.open(path) as pdf:
        pages = len(pdf.pages)
        for pno, page in enumerate(pdf.pages, start=1):
            in_table = False
            thai_parts: list = []   # [(text, chars, list it lives in, index)] — description/remark lines to OCR
            for ln in page.extract_text_lines(return_chars=True):
                line = ln['text'].strip()
                if not line:
                    continue

                if not in_table:
                    # Header repeats on every page; the first value found wins
                    if line.startswith('Part#'):
                        in_table = True
                    elif m := BARCODE.match(line):
                        head.setdefault('article_doc_no', m['doc_no'])
                        head.setdefault('fiscal_year', int(m['year']))
                    elif m := SITE.search(line):
                        head.setdefault('site_code', m['site_code'])
                        head.setdefault('site', m['site'])
                        head.setdefault('article_doc_no', m['doc_no'])
                    elif m := SLOC.search(line):
                        head.setdefault('storage_location', m['sloc'])
                        head.setdefault('doc_date', m['date'])
                    elif m := VENDOR.search(line):
                        head.setdefault('vendor_no', m['vendor'])
                        head.setdefault('doc_time', m['time'])
                    for key, rx in (('delivery_note', DELIVERY), ('buyer', BUYER), ('created_by', CREATED),
                                    ('site_tel', SITE_TEL), ('site_tel2', SITE_TEL2)):
                        if key not in head and (m := rx.search(line)):
                            head[key] = m['v'].strip() or None

                    # Vendor block (Thai, repaired with OCR): its text is the line's first column
                    first = (groups(ln['chars']) or [[]])[0]
                    if 'vendor_name' not in head and (m := VENDOR_NAME.match(line)):
                        head['vendor_name'] = m['v'] or None
                        if m['v'] and THAI.search(m['v']):
                            thai_parts.append((m['v'], first, head, 'vendor_name'))
                    if 'vendor_address' not in head and (m := ADDRESS.match(line)):
                        head['vendor_address'] = m['v'] or None
                        if m['v'] and THAI.search(m['v']):
                            thai_parts.append((m['v'], first, head, 'vendor_address'))
                    if 'vendor_contact' not in head and (m := CONTACT.match(line)):
                        head['vendor_contact'], head['vendor_tel'] = m['contact'] or None, m['tel'] or None
                        colon = next((c for c in first if c['text'] == ':'), None)
                        if m['contact'] and THAI.search(m['contact']) and colon:   # crop the name, not the label
                            thai_parts.append((m['contact'], [c for c in first if c['x0'] >= colon['x1']], head, 'vendor_contact'))
                    continue

                if FOOTER.search(line):
                    in_table = False
                    continue

                if m := ITEM.match(line):
                    pre = m['pre'].split()
                    vd_part, article, batch = (
                        (None, pre[0], None) if len(pre) == 1
                        else (pre[0], pre[1], ' '.join(pre[2:]) or None)
                    )
                    current = {
                        'item': int(m['item']),
                        'vd_part': vd_part,
                        'article': article,
                        'batch': batch,
                        'po': m['po'],
                        'mvt': m['mvt'],
                        's': m['s'],
                        'reference': m['ref'],
                        'unit': m['unit'],
                        'qty': num(m['qty']),
                        'price': num(m['price']),
                        'amount': num(m['amount']),
                        'base_qty': None,    # "2EA" printed under the qty: quantity in the base unit
                        'base_unit': None,
                        'description': None,
                        'return_reason': None,
                        'reversed_doc_no': None,
                        'remarks': [],
                        'remarks_pdf': [],   # as printed in the PDF, before the OCR repair
                        'page': pno,
                        '_desc': [],         # description lines, joined once OCR has run
                        '_desc_pdf': [],
                    }
                    items.append(current)
                elif m := TOTAL.match(line):
                    total_qty, total = num(m['qty']), num(m['amount'])
                    current = None
                elif m := TOTAL_BU.match(line):
                    total_bu = num(m['qty'])
                    current = None
                elif m := PO_TEXT.match(line):
                    head['po_text'] = m['v'] or None
                    current = None
                elif m := GR_TEXT.match(line):
                    head['gr_text'] = m['v'] or None
                    current = None
                elif current is not None:
                    if line.startswith('***'):
                        target, raw, text = current['remarks'], current['remarks_pdf'], line.lstrip('*').strip()
                    elif not current['remarks']:
                        # The base-unit qty sits in the qty column; matched by position, not by pattern alone,
                        # so descriptions that end in "600W" or "50 L" are left intact
                        gs = groups(ln['chars'])
                        bq = BASE_QTY.match(group_text(gs[-1])) if gs and (len(gs) > 1 or gs[0][0]['x0'] > 400) else None
                        if bq and current['base_qty'] is None:
                            current['base_qty'], current['base_unit'] = num(bq['qty']), bq['unit']
                        if bq and len(gs) == 1:
                            continue   # qty only, no description text on this line
                        target, raw = current['_desc'], current['_desc_pdf']
                        text = QTY_SUFFIX.sub('', line) if bq else line
                    else:
                        continue
                    target.append(text)
                    raw.append(text)
                    if THAI.search(text):
                        thai_parts.append((text, ln['chars'], target, len(target) - 1))

            if fixer and thai_parts:
                t0 = time.perf_counter()
                try:
                    fixed = fixer.fix(page, [(text, chars) for text, chars, _, _ in thai_parts])
                    for (_, _, target, i), text in zip(thai_parts, fixed):
                        target[i] = text
                    ocr_lines += len(thai_parts)
                except Exception as e:  # noqa: BLE001 — keep the PDF text for the rest of the document
                    fixer, ocr_error = None, f'{type(e).__name__}: {e}'
                ocr_ms += (time.perf_counter() - t0) * 1000

    for i in items:
        i['description'] = ' '.join(i.pop('_desc')) or None
        i['description_pdf'] = ' '.join(i.pop('_desc_pdf')) or None
        rev = REV.search(' '.join(i['remarks_pdf']))
        i['reversed_doc_no'] = rev['doc'] if rev else None
        # free text only — product names are left alone so a model code can never be mistaken for an ID
        for k in ('remarks', 'remarks_pdf'):
            i[k] = [mask_ids(r) for r in i[k]]
        first = i['remarks'][0] if i['remarks'] else None
        i['return_reason'] = first if first and not NOT_REASON.search(first) else None
    for k in ('po_text', 'gr_text'):
        head[k] = mask_ids(head.get(k))
    buyer = BUYER_CODE.match(head.get('buyer') or '')

    qty_sum = round(sum(i['qty'] for i in items), 3)
    items_sum = round(sum(i['amount'] for i in items), 2)

    if not items:
        warnings.append('ไม่พบรายการสินค้าในเอกสาร')
    if sorted(i['item'] for i in items) != list(range(1, len(items) + 1)):
        warnings.append('ลำดับรายการไม่ต่อเนื่อง — อาจอ่านบางบรรทัดไม่ได้')
    for i in items:
        # unit price is rounded to 2 dp, so qty × price may drift by up to half a satang per unit
        if abs(i['qty'] * i['price'] - i['amount']) > max(0.01, abs(i['qty']) * 0.005 + 0.001):
            warnings.append(f"รายการ {i['item']}: จำนวน × ราคา ({i['qty'] * i['price']:,.2f}) ไม่ตรงกับจำนวนเงิน ({i['amount']:,.2f})")
    if total is None:
        warnings.append('ไม่พบยอดรวมท้ายเอกสาร')
    else:
        if abs(items_sum - total) > 0.01:
            warnings.append(f'ผลรวมรายการ ({items_sum:,.2f}) ไม่ตรงกับยอดรวมในเอกสาร ({total:,.2f})')
        if abs(qty_sum - total_qty) > 0.001:
            warnings.append(f'ผลรวมจำนวน ({qty_sum:,.0f}) ไม่ตรงกับจำนวนรวมในเอกสาร ({total_qty:,.0f})')

    return {
        'article_doc_no': head.get('article_doc_no'),
        'fiscal_year': head.get('fiscal_year'),
        'site_code': head.get('site_code'),
        'site': head.get('site'),
        'storage_location': head.get('storage_location'),
        'vendor_no': head.get('vendor_no'),
        'doc_date': head.get('doc_date'),
        'doc_time': head.get('doc_time'),
        'delivery_note': head.get('delivery_note'),
        'buyer': head.get('buyer'),
        'buyer_code': buyer['code'] if buyer else None,
        'buyer_name': buyer['name'] if buyer else head.get('buyer'),
        'created_by': head.get('created_by'),
        'site_tel': head.get('site_tel'),
        'site_tel2': head.get('site_tel2'),
        'vendor_name': head.get('vendor_name'),
        'vendor_address': head.get('vendor_address'),
        'vendor_contact': head.get('vendor_contact'),
        'vendor_tel': head.get('vendor_tel'),
        'po_text': head.get('po_text'),
        'gr_text': head.get('gr_text'),
        'pages': pages,
        'items': items,
        'items_count': len(items),
        'qty_sum': qty_sum,
        'items_sum': items_sum,
        'total_qty': total_qty,
        'total_bu': total_bu,
        'total': total,
        'warnings': warnings,
        # Thai description/remark repair: lines = how many went through OCR; error = why it was skipped
        'ocr': {'used': ocr_lines > 0, 'lines': ocr_lines, 'ms': round(ocr_ms), 'error': ocr_error},
    }


def safe_extract(path: str, fixer, ocr_error) -> dict:
    try:
        return extract(path, fixer, ocr_error)
    except Exception as e:  # noqa: BLE001 — report any parse failure to the caller as JSON
        return {'error': f'{type(e).__name__}: {e}'}


if __name__ == '__main__':
    # extract_hpmh_return_slip.py [--no-ocr] <file.pdf>            -> one result object
    # extract_hpmh_return_slip.py [--no-ocr] --many <a.pdf> <b.pdf>  -> {"results": [...]} in argument order;
    #   the OCR model loads once, so a batch costs ~0.5 s/PDF instead of ~2 s
    sys.stdout.reconfigure(encoding='utf-8')
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    paths = [a for a in sys.argv[1:] if not a.startswith('--')]
    many = '--many' in flags
    if not paths or (len(paths) > 1 and not many):
        print(json.dumps({'error': 'usage: extract_hpmh_return_slip.py [--no-ocr] [--many] <file.pdf>...'}))
        sys.exit(2)

    fixer, ocr_error = ThaiOcrFixer.load() if '--no-ocr' not in flags else (None, 'ปิดการใช้ OCR')
    results = [safe_extract(p, fixer, ocr_error) for p in paths]
    print(json.dumps({'results': results} if many else results[0], ensure_ascii=False))
    sys.exit(0 if many or 'error' not in results[0] else 1)
