import zipfile
import shutil
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path("/Users/danielbenassaya/Code/personal/opticai").resolve()
TEMPLATES_DIR = ROOT / "public" / "templates"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

PAGE_WIDTH = 10080
DEFAULT_BORDER = "E4E4E7" # Zinc 200
LABEL_FILL = "F4F4F5" # Zinc 100
SECTION_FILL = "18181B" # Zinc 900
HEADER_TEXT = "18181B"
SUBTLE_FILL = "FAFAFA" # Zinc 50


def xml(text: str) -> str:
    return escape(text)


def run(
    text: str,
    *,
    bold: bool = False,
    size: int = 18,
    color: str | None = None,
    font: str = "Assistant",
) -> str:
    props = [
        f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}" w:eastAsia="{font}"/>',
        f'<w:sz w:val="{size}"/>',
        f'<w:szCs w:val="{size}"/>',
        "<w:rtl/>"
    ]
    if bold:
        props.append("<w:b/>")
        props.append("<w:bCs/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    return f"<w:r><w:rPr>{''.join(props)}</w:rPr><w:t xml:space=\"preserve\">{xml(text)}</w:t></w:r>"


def field(key: str, *, size: int = 18, bold: bool = False, color: str | None = None, font: str = "Assistant") -> str:
    props = [
        f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}" w:eastAsia="{font}"/>',
        f'<w:sz w:val="{size}"/>',
        f'<w:szCs w:val="{size}"/>',
        "<w:rtl/>"
    ]
    if bold:
        props.append("<w:b/>")
        props.append("<w:bCs/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    return f"<w:r><w:rPr>{''.join(props)}</w:rPr><w:t>{{{key}}}</w:t></w:r>"


def logo(width_emus: int = 800000, height_emus: int = 800000) -> str:
    return (
        '<w:r>'
        '<w:drawing>'
        '<wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{width_emus}" cy="{height_emus}"/>'
        '<wp:docPr id="1" name="Picture 1"/>'
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>'
        '<pic:blipFill><a:blip r:embed="rIdLogo" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{width_emus}" cy="{height_emus}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        '</pic:pic>'
        '</a:graphicData>'
        '</a:graphic>'
        '</wp:inline>'
        '</w:drawing>'
        '</w:r>'
    )


def paragraph(
    runs: str,
    *,
    align: str = "right",
    spacing_before: int = 0,
    spacing_after: int = 60,
    keep_next: bool = False,
    indent_left: int = 0,
    bidi: bool = True,
) -> str:
    keep_next_xml = "<w:keepNext/>" if keep_next else ""
    ind_xml = f'<w:ind w:left="{indent_left}"/>' if indent_left != 0 else ""
    bidi_xml = "<w:bidi/>" if bidi else ""
    return (
        "<w:p>"
        f"<w:pPr><w:jc w:val=\"{align}\"/>{bidi_xml}{ind_xml}<w:spacing w:before=\"{spacing_before}\" "
        f"w:after=\"{spacing_after}\"/>{keep_next_xml}</w:pPr>"
        f"{runs}</w:p>"
    )


def empty_paragraph(height: int = 40) -> str:
    return f"<w:p><w:pPr><w:bidi/><w:spacing w:after=\"{height}\"/></w:pPr></w:p>"


def cell(
    content: str,
    *,
    width: int,
    fill: str | None = None,
    borders: bool = True,
    border_color: str = DEFAULT_BORDER,
    align: str = "right",
    span: int | None = None,
    vertical: str = "center",
    margins: tuple[int, int, int, int] = (40, 120, 40, 120),
) -> str:
    top, right, bottom, left = margins
    tc_pr = [f'<w:tcW w:w="{width}" w:type="dxa"/>']
    if span:
        tc_pr.append(f'<w:gridSpan w:val="{span}"/>')
    if fill:
        tc_pr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>')
    if borders:
        tc_pr.append(
            "<w:tcBorders>"
            f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
            f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
            f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
            f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
            "</w:tcBorders>"
        )
    tc_pr.append(
        f'<w:tcMar><w:top w:w="{top}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/></w:tcMar>'
    )
    tc_pr.append(f'<w:vAlign w:val="{vertical}"/>')
    if "<w:p" not in content:
        content = paragraph(content, align=align, spacing_after=0)
    return f"<w:tc><w:tcPr>{''.join(tc_pr)}</w:tcPr>{content}</w:tc>"


def row(cells: list[str], *, height: int | None = None) -> str:
    tr_pr = f"<w:trPr><w:trHeight w:val=\"{height}\"/></w:trPr>" if height else ""
    return f"<w:tr>{tr_pr}{''.join(cells)}</w:tr>"


def table(rows: list[str], widths: list[int], *, layout: str = "fixed", borders: bool = True) -> str:
    grid = "".join(f'<w:gridCol w:w="{width}"/>' for width in widths)
    tbl_borders = ""
    if borders:
        tbl_borders = (
            "<w:tblBorders>"
            f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{DEFAULT_BORDER}"/>'
            f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{DEFAULT_BORDER}"/>'
            f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{DEFAULT_BORDER}"/>'
            f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{DEFAULT_BORDER}"/>'
            f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{DEFAULT_BORDER}"/>'
            f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="{DEFAULT_BORDER}"/>'
            "</w:tblBorders>"
        )
        
    return (
        "<w:tbl>"
        "<w:tblPr>"
        '<w:tblW w:w="5000" w:type="pct"/>'
        f'<w:tblLayout w:type="{layout}"/>'
        '<w:jc w:val="right"/>'
        f'{tbl_borders}'
        '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/>'
        '<w:bottom w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/></w:tblCellMar>'
        "</w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>"
        f"{''.join(rows)}"
        "</w:tbl>"
    )


def section_title(title: str) -> str:
    return paragraph(
        run(title, bold=True, size=20, color="18181B"),
        align="center",
        spacing_before=120,
        spacing_after=40,
        keep_next=True
    )


def header_block(title: str, subtitle_key: str) -> str:
    logo_width = 1700
    title_width = PAGE_WIDTH // 2
    spacer_width = PAGE_WIDTH - logo_width - title_width
    left_cell = cell(
        paragraph(logo(1000000, 1000000), align="left", spacing_after=0, bidi=False),
        width=logo_width,
        borders=False,
        fill=None,
        margins=(0, 0, 0, 0),
        vertical="center"
    )
    spacer_cell = cell(
        "",
        width=spacer_width,
        borders=False,
        fill=None,
        margins=(0, 0, 0, 0),
        vertical="center"
    )
    title_run = run(title, bold=True, size=32, color=HEADER_TEXT)
    subtitle_run = run("סניף: ", bold=True, size=20, color="71717A") + field(subtitle_key, size=20, color="71717A")
    
    right_cell = cell(
        paragraph(title_run, align="right", spacing_after=40) + paragraph(subtitle_run, align="right", spacing_after=0),
        width=title_width,
        borders=False,
        fill=None,
        margins=(0, 0, 0, 0),
        vertical="center"
    )
    
    return table([row([left_cell, spacer_cell, right_cell])], [logo_width, spacer_width, title_width], borders=False)


def metric_table(items: list[tuple[str, str]], *, pairs_per_row: int = 4) -> str:
    label_width = 1200
    value_width = (PAGE_WIDTH - (label_width * pairs_per_row)) // pairs_per_row
    widths = []
    for _ in range(pairs_per_row):
        widths.extend([value_width, label_width])
    rows = []
    for i in range(0, len(items), pairs_per_row):
        chunk = items[i : i + pairs_per_row]
        row_cells = []
        for label, key in reversed(chunk):
            row_cells.append(
                cell(
                    paragraph(field(key, size=20), align="right", spacing_after=0),
                    width=value_width,
                    align="right",
                    borders=False,
                    fill=None
                )
            )
            row_cells.append(
                cell(
                    paragraph(run(label, bold=True, size=18, color="52525B"), spacing_after=0),
                    width=label_width,
                    fill=None,
                    align="right",
                    borders=False
                )
            )
        while len(chunk) < pairs_per_row:
            row_cells.append(cell("", width=value_width, fill=None, borders=False))
            row_cells.append(cell("", width=label_width, fill=None, borders=False))
            chunk.append(("", ""))
        rows.append(row(row_cells))
    return table(rows, widths, borders=True)


def kv_table(pairs: list[tuple[str, str]], *, pairs_per_row: int = 2) -> str:
    label_width = 1200
    value_width = 3840 if pairs_per_row == 2 else 2160
    widths = []
    for _ in range(pairs_per_row):
        widths.extend([value_width, label_width])
    rows = []
    for i in range(0, len(pairs), pairs_per_row):
        chunk = pairs[i : i + pairs_per_row]
        row_cells = []
        for label, key in reversed(chunk):
            row_cells.append(
                cell(
                    paragraph(field(key, size=20), align="right", spacing_after=0),
                    width=value_width,
                    align="right",
                    borders=False,
                    fill=None
                )
            )
            row_cells.append(
                cell(
                    paragraph(run(label, bold=True, size=18, color="52525B"), spacing_after=0),
                    width=label_width,
                    fill=None,
                    align="right",
                    borders=False
                )
            )
        while len(chunk) < pairs_per_row:
            row_cells.append(cell("", width=value_width, fill=None, borders=False))
            row_cells.append(cell("", width=label_width, fill=None, borders=False))
            chunk.append(("", ""))
        rows.append(row(row_cells))
    return table(rows, widths, borders=True)


def eye_table(row_label_title: str, labels: list[str], right_keys: list[str], left_keys: list[str]) -> str:
    eye_width = 1100
    value_width = (PAGE_WIDTH - eye_width) // len(labels)
    widths = [value_width] * len(labels) + [eye_width]
    rows = [
        row(
            [
                *[
                    cell(
                        paragraph(run(label, bold=True, size=18, color="52525B"), align="center", spacing_after=0),
                        width=value_width,
                        fill=None,
                        align="center",
                        borders=False
                    )
                    for label in reversed(labels)
                ],
                cell(
                    paragraph(run(row_label_title, bold=True, size=18, color="18181B"), align="center", spacing_after=0),
                    width=eye_width,
                    fill=None,
                    align="center",
                    borders=False
                ),
            ]
        )
    ]
    for eye_label, keys in [("ימין", right_keys), ("שמאל", left_keys)]:
        rows.append(
            row(
                [
                    *[
                        cell(
                            paragraph(field(key, size=20), align="center", spacing_after=0),
                            width=value_width,
                            align="center",
                            borders=False,
                            fill=None
                        )
                        for key in reversed(keys)
                    ],
                    cell(
                        paragraph(run(eye_label, bold=True, size=20), align="center", spacing_after=0),
                        width=eye_width,
                        fill=None,
                        align="center",
                        borders=False
                    ),
                ]
            )
        )
    return table(rows, widths, borders=True)


def comparison_table(headers: list[str], right_keys: list[str], left_keys: list[str]) -> str:
    eye_width = 1100
    value_width = (PAGE_WIDTH - eye_width) // len(headers)
    widths = [value_width] * len(headers) + [eye_width]
    rows = [
        row(
            [
                *[
                    cell(
                        paragraph(run(header, bold=True, size=18, color="52525B"), align="center", spacing_after=0),
                        width=value_width,
                        fill=None,
                        align="center",
                        borders=False
                    )
                    for header in reversed(headers)
                ],
                cell(
                    paragraph(run("עין", bold=True, size=18, color="18181B"), align="center", spacing_after=0),
                    width=eye_width,
                    fill=None,
                    align="center",
                    borders=False
                ),
            ]
        )
    ]
    for eye_label, keys in [("ימין", right_keys), ("שמאל", left_keys)]:
        rows.append(
            row(
                [
                    *[
                        cell(
                            paragraph(field(key, size=20), align="center", spacing_after=0),
                            width=value_width,
                            align="center",
                            borders=False,
                            fill=None
                        )
                        for key in reversed(keys)
                    ],
                    cell(
                        paragraph(run(eye_label, bold=True, size=20), align="center", spacing_after=0),
                        width=eye_width,
                        fill=None,
                        align="center",
                        borders=False
                    ),
                ]
            )
        )
    return table(rows, widths, borders=True)


def notes_row(right_title: str, right_key: str, left_title: str, left_key: str) -> str:
    half_width = PAGE_WIDTH // 2
    right_cell = (
        paragraph(run(right_title, bold=True, size=20, color="18181B"), align="right", spacing_after=40, keep_next=True)
        + paragraph(field(right_key, size=20), align="right", spacing_after=20)
    )
    left_cell = (
        paragraph(run(left_title, bold=True, size=20, color="18181B"), align="right", spacing_after=40, keep_next=True)
        + paragraph(field(left_key, size=20), align="right", spacing_after=20)
    )
    return table(
        [
            row(
                [
                    cell(left_cell, width=half_width, fill=None, vertical="top", margins=(80, 120, 80, 120), borders=False),
                    cell(right_cell, width=half_width, fill=None, vertical="top", margins=(80, 120, 80, 120), borders=False),
                ],
                
            )
        ],
        [half_width, half_width],
        borders=True
    )


def build_regular_xml() -> str:
    content = [
        header_block("הזמנה רגילה", "clinic_info"),
        empty_paragraph(120),
        metric_table(
            [
                ("מס' הזמנה", "order_number"),
                ("מס' שקית", "bag_number"),
                ("תאריך הזמנה", "order_date"),
                ("תאריך אישור", "approval_date"),
                ("סטטוס", "order_status"),
                ("עדיפות", "priority"),
                ("אספקה", "delivery_clinic_name"),
                ("הובטח", "promised_date"),
            ]
        ),
        empty_paragraph(60),
        section_title("פרטי לקוח"),
        kv_table(
            [
                ("שם לקוח", "client_name"),
                ("ת.ז", "client_id"),
                ("נייד", "phone_mobile"),
                ("טלפון בית", "phone_home"),
                ("טלפון עבודה", "phone_work"),
                ("כתובת", "client_address"),
            ],
            pairs_per_row=3,
        ),
        empty_paragraph(60),
        section_title("צוות ותפעול"),
        kv_table(
            [
                ("אופטומטריסט", "optician_name"),
                ("יועץ", "advisor_name"),
                ("נמסר על ידי", "delivered_by"),
                ("תאריך מסירה", "delivered_date"),
                ("מעבדה", "manufacturing_lab"),
                ("סוג טאב", "lens_tab_type"),
            ],
            pairs_per_row=3,
        ),
        empty_paragraph(60),
        section_title("מרשם"),
        eye_table(
            "עין",
            ["גובה", "PD", "ADD", "BASE", "PRISM", "AX", "CYL", "SPH"],
            ["r_high", "r_pd", "r_add", "r_base", "r_pris", "r_ax", "r_cyl", "r_sph"],
            ["l_high", "l_pd", "l_add", "l_base", "l_pris", "l_ax", "l_cyl", "l_sph"],
        ),
        empty_paragraph(40),
        kv_table([("PD משולב", "comb_pd"), ("רב מוקדי", "multifocal_block")], pairs_per_row=2),
        empty_paragraph(60),
        section_title("פרטי עדשות"),
        comparison_table(
            ["דגם", "ספק", "חומר", "ציפוי", "צבע", "קוטר"],
            ["r_lens_model", "r_lens_supplier", "r_lens_material", "r_lens_coating", "r_lens_color", "r_lens_diameter"],
            ["l_lens_model", "l_lens_supplier", "l_lens_material", "l_lens_coating", "l_lens_color", "l_lens_diameter"],
        ),
        empty_paragraph(60),
        section_title("מסגרת"),
        kv_table(
            [
                ("ספק", "frame_supplier"),
                ("מותג", "frame_brand"),
                ("דגם", "frame_model"),
                ("צבע", "frame_color"),
                ("רוחב", "frame_width"),
                ("גשר", "frame_bridge"),
                ("גובה", "frame_height"),
                ("אורך זרוע", "frame_length"),
                ("סופק על ידי", "frame_supplied_by"),
            ],
            pairs_per_row=3,
        ),
        empty_paragraph(60),
        section_title("סיכום כספי"),
        metric_table(
            [
                ("סה\"כ", "total_price"),
                ("שולם", "amount_paid"),
                ("יתרה", "balance_due"),
                ("סטטוס תשלום", "payment_status"),
            ],
            pairs_per_row=4,
        ),
        empty_paragraph(60),
        section_title("הערות"),
        notes_row("הערות קליניות", "clinic_notes", "הערות לספק", "supplier_notes"),
    ]
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W_NS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'
        f"{''.join(content)}"
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="567" w:right="900" '
        'w:bottom="567" w:left="900" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr>'
        "</w:body></w:document>"
    )


def build_contact_xml() -> str:
    content = [
        header_block("הזמנת עדשות מגע", "clinic_info"),
        empty_paragraph(120),
        metric_table(
            [
                ("מס' הזמנה", "order_number"),
                ("תאריך הזמנה", "order_date"),
                ("סטטוס", "order_status"),
                ("עדיפות", "priority"),
                ("אספקה", "supply_clinic_name"),
                ("הובטח", "guaranteed_date"),
                ("אושר", "approval_date"),
                ("נמסר", "delivery_date"),
            ]
        ),
        empty_paragraph(60),
        section_title("פרטי לקוח"),
        kv_table(
            [
                ("שם לקוח", "client_name"),
                ("ת.ז", "client_id"),
                ("נייד", "phone_mobile"),
                ("טלפון בית", "phone_home"),
                ("טלפון עבודה", "phone_work"),
                ("כתובת", "client_address"),
            ],
            pairs_per_row=3,
        ),
        empty_paragraph(60),
        section_title("צוות ותפעול"),
        kv_table(
            [
                ("אופטומטריסט", "optician_name"),
                ("יועץ", "advisor_name"),
                ("מוסר עבודה", "deliverer_name"),
            ],
            pairs_per_row=3,
        ),
        empty_paragraph(60),
        section_title("פרטי עדשות"),
        comparison_table(
            ["סוג", "דגם", "ספק", "חומר", "צבע", "כמות"],
            ["r_lens_type", "r_model", "r_supplier", "r_material", "r_color", "r_quantity"],
            ["l_lens_type", "l_model", "l_supplier", "l_material", "l_color", "l_quantity"],
        ),
        empty_paragraph(60),
        section_title("מרשם עדשות מגע"),
        eye_table(
            "עין",
            ["BC", "OZ", "DIAM", "SPH", "CYL", "AX", "READ/ADD"],
            ["r_bc", "r_oz", "r_diam", "r_sph", "r_cyl", "r_ax", "r_read_add"],
            ["l_bc", "l_oz", "l_diam", "l_sph", "l_cyl", "l_ax", "l_read_add"],
        ),
        empty_paragraph(60),
        section_title("תמיסות"),
        kv_table(
            [
                ("ניקוי", "cleaning_solution"),
                ("חיטוי", "disinfection_solution"),
                ("שטיפה", "rinsing_solution"),
            ],
            pairs_per_row=3,
        ),
        empty_paragraph(60),
        section_title("סיכום כספי"),
        metric_table(
            [
                ("סה\"כ", "total_price"),
                ("שולם", "amount_paid"),
                ("יתרה", "balance_due"),
                ("סטטוס תשלום", "payment_status"),
            ],
            pairs_per_row=4,
        ),
        empty_paragraph(60),
        section_title("הערות"),
        notes_row("הערות קליניות", "clinic_notes", "הערות לספק", "supplier_notes"),
    ]
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W_NS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'
        f"{''.join(content)}"
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="567" w:right="900" '
        'w:bottom="567" w:left="900" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr>'
        "</w:body></w:document>"
    )


def build_referral_xml() -> str:
    logo_width = 1700
    title_width = PAGE_WIDTH // 2
    spacer_width = PAGE_WIDTH - logo_width - title_width
    left_cell = cell(
        paragraph(logo(1000000, 1000000), align="left", spacing_after=0, bidi=False),
        width=logo_width, borders=False, fill=None, margins=(0,0,0,0), vertical="center"
    )
    spacer_cell = cell(
        "",
        width=spacer_width, borders=False, fill=None, margins=(0,0,0,0), vertical="center"
    )
    title_run = run("מכתב הפניה", bold=True, size=32, color=HEADER_TEXT)
    clinic_para = paragraph(
        field("#has_clinic_info") + run("סניף: ", bold=True, size=20, color="71717A") + field("clinic_info", size=20, color="71717A") + field("/has_clinic_info"),
        align="right",
        spacing_after=0
    )
    right_cell = cell(
        paragraph(title_run, align="right", spacing_after=40) + clinic_para,
        width=title_width, borders=False, fill=None, margins=(0,0,0,0), vertical="center"
    )

    content = [
        table([row([left_cell, spacer_cell, right_cell])], [logo_width, spacer_width, title_width], borders=False),
        empty_paragraph(120),
        
        paragraph(field("#has_referral_details"), spacing_after=0),
        paragraph(field("referral_details", size=22), align="right", spacing_after=180),
        paragraph(field("/has_referral_details"), spacing_after=0),
        
        paragraph(field("#has_recipient"), spacing_after=0),
        paragraph(field("recipient_line", size=22, bold=True), align="right", spacing_after=180),
        paragraph(field("/has_recipient"), spacing_after=0),
        
        paragraph(field("#has_client_details"), spacing_after=0),
        paragraph(field("client_details", size=22), align="right", spacing_after=180),
        paragraph(field("/has_client_details"), spacing_after=0),
        
        paragraph(field("#has_client_contact"), spacing_after=0),
        paragraph(field("client_contact", size=22), align="right", spacing_after=180),
        paragraph(field("/has_client_contact"), spacing_after=0),
        
        paragraph(field("#has_referral_notes"), spacing_after=0),
        table([
            row([
                cell(
                    paragraph(run("הערות:", bold=True, size=22, color="18181B"), align="right", spacing_after=40) +
                    paragraph(field("referral_notes", size=22), align="right", spacing_after=0),
                    width=PAGE_WIDTH, borders=False, fill=None, margins=(80, 160, 80, 160)
                )
            ])
        ], [PAGE_WIDTH], borders=True),
        empty_paragraph(60),
        paragraph(field("/has_referral_notes"), spacing_after=0),
        
        paragraph(field("#has_clinical_findings"), spacing_after=0),
        table([
            row([
                cell(
                    paragraph(run("ממצאים קליניים:", bold=True, size=22, color="18181B"), align="right", spacing_after=40) +
                    paragraph(field("clinical_findings_text", size=22), align="right", spacing_after=0),
                    width=PAGE_WIDTH, borders=False, fill=None, margins=(80, 160, 80, 160)
                )
            ])
        ], [PAGE_WIDTH], borders=True),
        empty_paragraph(60),
        paragraph(field("/has_clinical_findings"), spacing_after=0),
        
        paragraph(field("#has_compact_prescription"), spacing_after=0),
        section_title("מרשם / כרטיס בדיקה"),
        eye_table(
            "עין",
            ["SPH", "CYL", "AX", "PRISM", "BASE", "VA", "ADD", "PD"],
            ["r_sph", "r_cyl", "r_ax", "r_pris", "r_base", "r_va", "r_add", "r_pd"],
            ["l_sph", "l_cyl", "l_ax", "l_pris", "l_base", "l_va", "l_add", "l_pd"],
        ),
        empty_paragraph(40),
        kv_table([("VA משולב", "comb_va"), ("PD משולב", "comb_pd")], pairs_per_row=2),
        empty_paragraph(120),
        paragraph(field("/has_compact_prescription"), spacing_after=0),
        
        paragraph(field("#has_signature"), spacing_after=0),
        paragraph(field("signature_text", size=20, color="52525B"), align="right", spacing_before=360, spacing_after=40),
        paragraph(field("/has_signature"), spacing_after=0),
    ]
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W_NS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'
        f"{''.join(content)}"
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="567" w:right="900" '
        'w:bottom="567" w:left="900" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr>'
        "</w:body></w:document>"
    )


def replace_document_xml(docx_path: Path, xml_content: str) -> None:
    temp_path = docx_path.with_suffix(".tmp")
    logo_path = ROOT / "public" / "logo-name.png"
    
    with zipfile.ZipFile(docx_path, "r") as source, zipfile.ZipFile(temp_path, "w") as target:
        for item in source.infolist():
            if item.filename == "word/media/logo.png":
                continue
            data = source.read(item.filename)
            if item.filename == "word/document.xml":
                data = xml_content.encode("utf-8")
            elif item.filename == "[Content_Types].xml":
                content = data.decode("utf-8")
                if 'Extension="png"' not in content:
                    content = content.replace("</Types>", '<Default Extension="png" ContentType="image/png"/></Types>')
                    data = content.encode("utf-8")
            elif item.filename == "word/_rels/document.xml.rels":
                content = data.decode("utf-8")
                if "rIdLogo" not in content:
                    rel = '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>'
                    content = content.replace("</Relationships>", f"{rel}</Relationships>")
                    data = content.encode("utf-8")
            target.writestr(item, data)
        
        if logo_path.exists():
            target.write(logo_path, "word/media/logo.png")
            
    temp_path.replace(docx_path)


def main() -> None:
    replace_document_xml(TEMPLATES_DIR / "regular-order.docx", build_regular_xml())
    replace_document_xml(TEMPLATES_DIR / "contact-order.docx", build_contact_xml())
    referral_path = TEMPLATES_DIR / "referral.docx"
    if not referral_path.exists():
        shutil.copyfile(TEMPLATES_DIR / "regular-order.docx", referral_path)
    replace_document_xml(referral_path, build_referral_xml())


if __name__ == "__main__":
    main()
