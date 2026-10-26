"""
Extract the line items of an HP-MH (HomePro / MegaHome) receipt PDF (ใบเสร็จรับเงิน).

Usage:  python extract_hpmh_receipt.py <file.pdf>
Output: JSON on stdout.

The PDFs embed Thai fonts without a ToUnicode map, so Thai labels come out as (cid:N)
glyphs and are dropped. Digits and Latin text are intact, which is all the line items need:

    1 . Invoice No. 1800088223 [DR-1800088223] 988.79
    1 . Credit note No. [DG-1600001389] (241.12 )      <- credit notes come first, negative amount

The last page also carries the withholding tax line ("40(8) 3%: 52,413.03") and the
grand total ("() 1,795,977.99" once the Thai label is stripped).
"""
import json
import re
import sys

import pdfplumber

CID = re.compile(r'\(cid:\d+\)')
ITEM = re.compile(
    r'^(?P<no>\d+)\s*\.\s*Invoice No\.\s*(?P<invoice_no>\S+)\s*'
    r'\[(?P<ref_type>[A-Z]+)-(?P<ref_no>[^\]]+)\]\s*(?P<amount>-?[\d,]+\.\d{2})\s*$'
)
CREDIT = re.compile(
    r'^(?P<no>\d+)\s*\.\s*Credit note No\.\s*(?P<invoice_no>\S*?)\s*'
    r'\[(?P<ref_type>[A-Z]+)-(?P<ref_no>[^\]]+)\]\s*\(\s*(?P<amount>[\d,]+\.\d{2})\s*\)\s*$'
)
WHT = re.compile(r'40\(8\)\s*(?P<rate>[\d.]+)%\s*:\s*(?P<amount>-?[\d,]+\.\d{2})')
TOTAL = re.compile(r'^\(\)\s*(?P<amount>-?[\d,]+\.\d{2})\s*$')
DOC_REF = re.compile(r'\[(?P<doc_type>[A-Z]+)-(?P<doc_no>\d+)\]')
DOC_DATE = re.compile(r'(\d{2}/\d{2}/\d{4})')


def num(s: str) -> float:
    return float(s.replace(',', ''))


def extract(path: str) -> dict:
    items, warnings = [], []
    withholding_tax = withholding_rate = total = None
    doc_type = doc_no = doc_date = None

    with pdfplumber.open(path) as pdf:
        pages = len(pdf.pages)
        for pno, page in enumerate(pdf.pages, start=1):
            for raw in (page.extract_text() or '').split('\n'):
                line = CID.sub('', raw).strip()
                if not line:
                    continue
                if m := ITEM.match(line) or CREDIT.match(line):
                    is_credit = m.re is CREDIT
                    items.append({
                        'kind': 'credit_note' if is_credit else 'invoice',
                        'no': int(m['no']),
                        'invoice_no': m['invoice_no'] or None,
                        'ref_type': m['ref_type'],
                        'ref_no': m['ref_no'],
                        'amount': -num(m['amount']) if is_credit else num(m['amount']),
                        'page': pno,
                    })
                elif m := WHT.search(line):
                    withholding_rate, withholding_tax = float(m['rate']), num(m['amount'])
                elif m := TOTAL.match(line):
                    total = num(m['amount'])
                elif doc_no is None and line.startswith('[') and (m := DOC_REF.search(line)):
                    doc_type, doc_no = m['doc_type'], m['doc_no']
                elif pno == 1 and doc_date is None and (m := DOC_DATE.search(line)):
                    doc_date = m.group(1)

    items_sum = round(sum(i['amount'] for i in items), 2)
    invoices = [i for i in items if i['kind'] == 'invoice']
    credits = [i for i in items if i['kind'] == 'credit_note']
    # Credit notes and invoices share one running number (credit notes first) — a gap means a missed line
    if sorted(i['no'] for i in items) != list(range(1, len(items) + 1)):
        warnings.append('ลำดับรายการไม่ต่อเนื่อง — อาจอ่านบางบรรทัดไม่ได้')
    if not items:
        warnings.append('ไม่พบรายการ Invoice ในเอกสาร')
    # The grand total equals the sum of the items; withholding tax is reported on its own line
    if total is None:
        warnings.append('ไม่พบยอดรวมท้ายเอกสาร')
    elif abs(items_sum - total) > 0.01:
        warnings.append(f'ผลรวมรายการ ({items_sum:,.2f}) ไม่ตรงกับยอดรวมในเอกสาร ({total:,.2f})')

    return {
        'doc_type': doc_type,
        'doc_no': doc_no,
        'doc_date': doc_date,
        'pages': pages,
        'items': items,
        'items_count': len(items),
        'invoice_count': len(invoices),
        'invoice_sum': round(sum(i['amount'] for i in invoices), 2),
        'credit_note_count': len(credits),
        'credit_note_sum': round(sum(i['amount'] for i in credits), 2),
        'items_sum': items_sum,
        'withholding_rate': withholding_rate,
        'withholding_tax': withholding_tax,
        'total': total,
        'warnings': warnings,
    }


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) != 2:
        print(json.dumps({'error': 'usage: extract_hpmh_receipt.py <file.pdf>'}))
        sys.exit(2)
    try:
        print(json.dumps(extract(sys.argv[1]), ensure_ascii=False))
    except Exception as e:  # noqa: BLE001 — report any parse failure to the caller as JSON
        print(json.dumps({'error': f'{type(e).__name__}: {e}'}, ensure_ascii=False))
        sys.exit(1)
