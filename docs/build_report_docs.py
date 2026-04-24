import re
from pathlib import Path
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, ListFlowable, ListItem

root = Path(r"c:\Users\Kajamalan\Desktop\VAUED Project")
md_path = root / "docs" / "VAUED_Smart_Baby_Monitor_Technical_UX_Evaluation_Report.md"
docx_path = root / "docs" / "VAUED_Smart_Baby_Monitor_Technical_UX_Evaluation_Report.docx"
pdf_path = root / "docs" / "VAUED_Smart_Baby_Monitor_Technical_UX_Evaluation_Report.pdf"

text = md_path.read_text(encoding="utf-8")
lines = text.splitlines()

heading_re = re.compile(r'^(#{1,6})\s+(.*)$')
img_re = re.compile(r'^!\[(.*?)\]\((.*?)\)$')
bullet_re = re.compile(r'^\s*[-*]\s+(.*)$')
num_re = re.compile(r'^\s*\d+\.\s+(.*)$')

# Collect headings for manual TOC
headings = []
for ln in lines:
    m = heading_re.match(ln)
    if m:
        level = len(m.group(1))
        title = m.group(2).strip()
        if level <= 3:
            headings.append((level, title))

def clean_inline(md):
    s = md
    s = re.sub(r'\*\*([^*]+)\*\*', r'\1', s)
    s = re.sub(r'`([^`]+)`', r'\1', s)
    s = re.sub(r'\[(.*?)\]\((.*?)\)', r'\1 (\2)', s)
    return s

# -------- DOCX --------
doc = Document()
section = doc.sections[0]
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)

styles = doc.styles
styles['Normal'].font.name = 'Times New Roman'
styles['Normal'].font.size = Pt(12)

# Title page
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = title.add_run('Smart Baby Monitor\n')
r.bold = True
r.font.size = Pt(20)
sub = title.add_run('A Visual Analytics and Conversational Decision-Support System\nfor Live and Historical Nursery Monitoring')
sub.font.size = Pt(14)

doc.add_paragraph('')
for label, value in [
    ('Student', 'Kajamalan'),
    ('Project', 'VAUED Final-Year Undergraduate Project'),
    ('Document', 'Technical & UX Evaluation Report'),
    ('Date', 'April 2026'),
]:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(f'{label}: ').bold = True
    p.add_run(value)

doc.add_page_break()

# TOC page (manual + updatable field)
doc.add_heading('Table of Contents', level=1)
for lvl, t in headings:
    indent = '    ' * max(0, lvl - 1)
    doc.add_paragraph(f'{indent}{t}')

doc.add_paragraph('')
p = doc.add_paragraph('Update fields in Word to refresh page numbering if required.')
p.runs[0].italic = True

doc.add_page_break()

in_list = False
list_items = []

def flush_list_docx():
    global in_list, list_items
    if list_items:
        for item in list_items:
            doc.add_paragraph(clean_inline(item), style='List Bullet')
    list_items = []

for ln in lines:
    if ln.strip() == '---':
        flush_list_docx()
        continue
    m = heading_re.match(ln)
    if m:
        flush_list_docx()
        lvl = min(4, len(m.group(1)))
        doc.add_heading(clean_inline(m.group(2).strip()), level=lvl)
        continue
    im = img_re.match(ln.strip())
    if im:
        flush_list_docx()
        caption, rel = im.group(1).strip(), im.group(2).strip()
        img_file = (md_path.parent / rel).resolve()
        cap = doc.add_paragraph(caption)
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.runs[0].italic = True
        if img_file.exists():
            doc.add_picture(str(img_file), width=Inches(5.8))
        else:
            ph = doc.add_paragraph(f'[Figure placeholder: {rel}]')
            ph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            ph.runs[0].italic = True
        continue
    b = bullet_re.match(ln)
    n = num_re.match(ln)
    if b:
        list_items.append(b.group(1))
        continue
    if n:
        flush_list_docx()
        doc.add_paragraph(clean_inline(n.group(1)), style='List Number')
        continue
    if ln.strip() == '':
        flush_list_docx()
        doc.add_paragraph('')
        continue
    flush_list_docx()
    doc.add_paragraph(clean_inline(ln))

flush_list_docx()

# Footer page numbers
for sec in doc.sections:
    f = sec.footer.paragraphs[0]
    f.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = f.add_run('Page ')
    fld = OxmlElement('w:fldSimple')
    fld.set(qn('w:instr'), 'PAGE')
    run._r.append(fld)

doc.save(docx_path)

# -------- PDF --------
styles_pdf = getSampleStyleSheet()
body = ParagraphStyle('Body', parent=styles_pdf['Normal'], fontName='Times-Roman', fontSize=11.5, leading=15)
h1 = ParagraphStyle('H1', parent=styles_pdf['Heading1'], fontName='Times-Bold', fontSize=16, spaceBefore=12, spaceAfter=8)
h2 = ParagraphStyle('H2', parent=styles_pdf['Heading2'], fontName='Times-Bold', fontSize=13, spaceBefore=10, spaceAfter=6)
h3 = ParagraphStyle('H3', parent=styles_pdf['Heading3'], fontName='Times-Bold', fontSize=12, spaceBefore=8, spaceAfter=4)
cap = ParagraphStyle('Cap', parent=body, alignment=1, italic=True)

elems = []
# Title page
elems.append(Spacer(1, 2.0 * inch))
elems.append(Paragraph('Smart Baby Monitor', ParagraphStyle('T1', parent=h1, alignment=1, fontSize=22)))
elems.append(Spacer(1, 0.2 * inch))
elems.append(Paragraph('A Visual Analytics and Conversational Decision-Support System<br/>for Live and Historical Nursery Monitoring', ParagraphStyle('T2', parent=body, alignment=1, fontSize=13, leading=18)))
elems.append(Spacer(1, 0.8 * inch))
for label, value in [
    ('Student', 'Kajamalan'),
    ('Project', 'VAUED Final-Year Undergraduate Project'),
    ('Document', 'Technical & UX Evaluation Report'),
    ('Date', 'April 2026'),
]:
    elems.append(Paragraph(f'<b>{label}:</b> {value}', ParagraphStyle('C', parent=body, alignment=1)))
elems.append(PageBreak())

# TOC
elems.append(Paragraph('Table of Contents', h1))
for lvl, t in headings:
    indent = '&nbsp;' * (lvl - 1) * 6
    elems.append(Paragraph(f'{indent}{clean_inline(t)}', body))
elems.append(PageBreak())

for ln in lines:
    if ln.strip() == '---':
        continue
    m = heading_re.match(ln)
    if m:
        lvl = len(m.group(1))
        t = clean_inline(m.group(2).strip())
        elems.append(Paragraph(t, h1 if lvl == 1 else h2 if lvl == 2 else h3))
        continue
    im = img_re.match(ln.strip())
    if im:
        caption, rel = im.group(1).strip(), im.group(2).strip()
        elems.append(Paragraph(clean_inline(caption), cap))
        elems.append(Paragraph(f'[Figure placeholder: {rel}]', cap))
        elems.append(Spacer(1, 8))
        continue
    b = bullet_re.match(ln)
    n = num_re.match(ln)
    if b:
        elems.append(Paragraph(f'• {clean_inline(b.group(1))}', body))
        continue
    if n:
        elems.append(Paragraph(f'{clean_inline(ln)}', body))
        continue
    if not ln.strip():
        elems.append(Spacer(1, 6))
        continue
    elems.append(Paragraph(clean_inline(ln), body))


def add_page_number(canvas, doc_obj):
    canvas.saveState()
    canvas.setFont('Times-Roman', 10)
    canvas.drawCentredString(A4[0] / 2, 0.55 * inch, f'Page {doc_obj.page}')
    canvas.restoreState()

pdf = SimpleDocTemplate(
    str(pdf_path),
    pagesize=A4,
    leftMargin=1 * inch,
    rightMargin=1 * inch,
    topMargin=1 * inch,
    bottomMargin=0.85 * inch,
)
pdf.build(elems, onFirstPage=add_page_number, onLaterPages=add_page_number)

print('Generated:', docx_path)
print('Generated:', pdf_path)
