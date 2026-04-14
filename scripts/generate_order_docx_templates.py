from __future__ import annotations

import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = ROOT / "public" / "templates"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

PAGE_WIDTH = 10080
DEFAULT_BORDER = "D3DCE3"
LABEL_FILL = "EAF1F5"
SECTION_FILL = "D7E4EA"
HEADER_FILL = "244550"
HEADER_TEXT = "FFFFFF"
SUBTLE_FILL = "F7F9FA"


def xml(text: str) -> str:
    return escape(text)


def run(
    text: str,
    *,
    bold: bool = False,
    size: int = 22,
    color: str | None = None,
) -> str:
    props = [f'<w:sz w:val="{size}"/>', f'<w:szCs w:val="{size}"/>', "<w:rtl/>"]
    if bold:
        props.append("<w:b/>")
        props.append("<w:bCs/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    return f"<w:r><w:rPr>{''.join(props)}</w:rPr><w:t xml:space=\"preserve\">{xml(text)}</w:t></w:r>"


def field(key: str, *, size: int = 22, bold: bool = False, color: str | None = None) -> str:
    props = [f'<w:sz w:val="{size}"/>', f'<w:szCs w:val="{size}"/>', "<w:rtl/>"]
    if bold:
        props.append("<w:b/>")
        props.append("<w:bCs/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    return f"<w:r><w:rPr>{''.join(props)}</w:rPr><w:t>{{{key}}}</w:t></w:r>"


def paragraph(
    runs: str,
    *,
    align: str = "right",
    spacing_before: int = 0,
    spacing_after: int = 120,
    keep_next: bool = False,
) -> str:
    keep_next_xml = "<w:keepNext/>" if keep_next else ""
    return (
        "<w:p>"
        f"<w:pPr><w:jc w:val=\"{align}\"/><w:bidi/><w:spacing w:before=\"{spacing_before}\" "
        f"w:after=\"{spacing_after}\"/>{keep_next_xml}</w:pPr>"
        f"{runs}</w:p>"
    )


def empty_paragraph(height: int = 80) -> str:
    return f"<w:p><w:pPr><w:bidi/><w:spacing w:after=\"{height}\"/></w:pPr></w:p>"


def cell(
    content: str,
    *,
    width: int,
    fill: str | None = None,
    borders: bool = True,
    align: str = "right",
    span: int | None = None,
    vertical: str = "center",
    margins: tuple[int, int, int, int] = (90, 80, 90, 80),
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
            f'<w:top w:val="single" w:sz="6" w:space="0" w:color="{DEFAULT_BORDER}"/>'
            f'<w:right w:val="single" w:sz="6" w:space="0" w:color="{DEFAULT_BORDER}"/>'
            f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{DEFAULT_BORDER}"/>'
            f'<w:left w:val="single" w:sz="6" w:space="0" w:color="{DEFAULT_BORDER}"/>'
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


def table(rows: list[str], widths: list[int], *, layout: str = "fixed") -> str:
    grid = "".join(f'<w:gridCol w:w="{width}"/>' for width in widths)
    return (
        "<w:tbl>"
        "<w:tblPr>"
        f'<w:tblW w:w="{PAGE_WIDTH}" w:type="dxa"/>'
        f'<w:tblLayout w:type="{layout}"/>'
        '<w:jc w:val="center"/>'
        '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/>'
        '<w:bottom w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/></w:tblCellMar>'
        "</w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>"
        f"{''.join(rows)}"
        "</w:tbl>"
    )


def section_title(title: str) -> str:
    return table(
        [
            row(
                [
                    cell(
                        paragraph(
                            run(title, bold=True, size=24, color=HEADER_FILL),
                            spacing_after=0,
                            keep_next=True,
                            align="right",
                        ),
                        width=PAGE_WIDTH,
                        fill=SECTION_FILL,
                        align="right",
                        margins=(110, 180, 110, 180),
                    )
                ]
            )
        ],
        [PAGE_WIDTH],
    )


def header_block(title: str, subtitle_key: str) -> str:
    subtitle = paragraph(
        run("סניף: ", bold=True, size=20, color=HEADER_TEXT)
        + field(subtitle_key, size=20, color=HEADER_TEXT),
        align="right",
        spacing_after=0,
    )
    return table(
        [
            row(
                [
                    cell(
                        paragraph(
                            run(title, bold=True, size=30, color=HEADER_TEXT),
                            align="right",
                            spacing_after=40,
                        )
                        + subtitle,
                        width=PAGE_WIDTH,
                        fill=HEADER_FILL,
                        margins=(120, 120, 120, 120),
                    )
                ],
                height=720,
            )
        ],
        [PAGE_WIDTH],
    )


def metric_table(items: list[tuple[str, str]]) -> str:
    widths = [1320, 1200, 1320, 1200, 1320, 1200, 1320, 1200]
    rows = []
    for i in range(0, len(items), 4):
        chunk = items[i : i + 4]
        row_cells = []
        for label, key in reversed(chunk):
            row_cells.append(
                cell(
                    paragraph(field(key, size=20), spacing_after=0),
                    width=1320,
                    align="center",
                )
            )
            row_cells.append(
                cell(
                    paragraph(run(label, bold=True, size=20), spacing_after=0),
                    width=1200,
                    fill=LABEL_FILL,
                    align="right",
                )
            )
        while len(row_cells) < 8:
            row_cells.append(
                cell(
                    "",
                    width=1320 if len(row_cells) % 2 == 0 else 1200,
                    fill=None if len(row_cells) % 2 == 0 else LABEL_FILL,
                )
            )
        rows.append(row(row_cells))
    return table(rows, widths)


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
            row_cells.append(cell(paragraph(field(key, size=20), spacing_after=0), width=value_width))
            row_cells.append(
                cell(
                    paragraph(run(label, bold=True, size=20), spacing_after=0),
                    width=label_width,
                    fill=LABEL_FILL,
                    align="right",
                )
            )
        while len(chunk) < pairs_per_row:
            row_cells.append(cell("", width=value_width))
            row_cells.append(cell("", width=label_width, fill=LABEL_FILL))
            chunk.append(("", ""))
        rows.append(row(row_cells))
    return table(rows, widths)


def eye_table(row_label_title: str, labels: list[str], right_keys: list[str], left_keys: list[str]) -> str:
    eye_width = 1100
    value_width = (PAGE_WIDTH - eye_width) // len(labels)
    widths = [value_width] * len(labels) + [eye_width]
    rows = [
        row(
            [
                *[
                    cell(
                        paragraph(run(label, bold=True, size=20), align="center", spacing_after=0),
                        width=value_width,
                        fill=LABEL_FILL,
                        align="center",
                    )
                    for label in reversed(labels)
                ],
                cell(
                    paragraph(run(row_label_title, bold=True, size=20), align="center", spacing_after=0),
                    width=eye_width,
                    fill=SECTION_FILL,
                    align="center",
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
                        )
                        for key in reversed(keys)
                    ],
                    cell(
                        paragraph(run(eye_label, bold=True, size=20), align="center", spacing_after=0),
                        width=eye_width,
                        fill=SECTION_FILL,
                        align="center",
                    ),
                ]
            )
        )
    return table(rows, widths)


def comparison_table(headers: list[str], right_keys: list[str], left_keys: list[str]) -> str:
    eye_width = 1100
    value_width = (PAGE_WIDTH - eye_width) // len(headers)
    widths = [value_width] * len(headers) + [eye_width]
    rows = [
        row(
            [
                *[
                    cell(
                        paragraph(run(header, bold=True, size=20), align="center", spacing_after=0),
                        width=value_width,
                        fill=LABEL_FILL,
                        align="center",
                    )
                    for header in reversed(headers)
                ],
                cell(
                    paragraph(run("עין", bold=True, size=20), align="center", spacing_after=0),
                    width=eye_width,
                    fill=SECTION_FILL,
                    align="center",
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
                        )
                        for key in reversed(keys)
                    ],
                    cell(
                        paragraph(run(eye_label, bold=True, size=20), align="center", spacing_after=0),
                        width=eye_width,
                        fill=SECTION_FILL,
                        align="center",
                    ),
                ]
            )
        )
    return table(rows, widths)


def text_box(title: str, key: str) -> str:
    return table(
        [
            row(
                [
                    cell(
                        paragraph(run(title, bold=True, size=20, color=HEADER_FILL), spacing_after=0),
                        width=PAGE_WIDTH,
                        fill=LABEL_FILL,
                    )
                ]
            ),
            row([cell(paragraph(field(key, size=20), spacing_after=40), width=PAGE_WIDTH, fill=SUBTLE_FILL, vertical="top", margins=(120, 120, 220, 120))], height=760),
        ],
        [PAGE_WIDTH],
    )


def notes_row(right_title: str, right_key: str, left_title: str, left_key: str) -> str:
    half_width = PAGE_WIDTH // 2
    right_cell = (
        paragraph(run(right_title, bold=True, size=20, color=HEADER_FILL), spacing_after=70, keep_next=True)
        + paragraph(field(right_key, size=20), spacing_after=20)
    )
    left_cell = (
        paragraph(run(left_title, bold=True, size=20, color=HEADER_FILL), spacing_after=70, keep_next=True)
        + paragraph(field(left_key, size=20), spacing_after=20)
    )
    return table(
        [
            row(
                [
                    cell(left_cell, width=half_width, fill=SUBTLE_FILL, vertical="top", margins=(120, 120, 180, 120)),
                    cell(right_cell, width=half_width, fill=SUBTLE_FILL, vertical="top", margins=(120, 120, 180, 120)),
                ],
                height=980,
            )
        ],
        [half_width, half_width],
    )


def expanded_billing_block() -> str:
    return table(
        [
            row(
                [
                    cell(
                        paragraph(run("שורות חיוב", bold=True, size=20, color=HEADER_FILL), align="right", spacing_after=0),
                        width=PAGE_WIDTH,
                        fill=LABEL_FILL,
                        align="right",
                    )
                ]
            ),
            row(
                [
                    cell(
                        paragraph(field("line_items_block", size=20), align="right", spacing_after=20),
                        width=PAGE_WIDTH,
                        fill=SUBTLE_FILL,
                        vertical="top",
                        margins=(120, 120, 180, 120),
                    )
                ],
                height=980,
            ),
        ],
        [PAGE_WIDTH],
    )


def build_regular_xml() -> str:
    content = [
        header_block("הזמנה רגילה", "clinic_name"),
        empty_paragraph(),
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
        empty_paragraph(),
        section_title("פרטי לקוח"),
        kv_table(
            [
                ("שם לקוח", "client_name"),
                ("מספר לקוח", "client_id"),
                ("נייד", "phone_mobile"),
                ("טלפון בית", "phone_home"),
                ("טלפון עבודה", "phone_work"),
                ("כתובת", "client_address"),
            ],
            pairs_per_row=3,
        ),
        empty_paragraph(),
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
        empty_paragraph(),
        section_title("מרשם"),
        eye_table(
            "עין",
            ["SPH", "CYL", "AX", "PRISM", "BASE", "ADD", "DIAM", "HEIGHT", "PD"],
            ["r_sph", "r_cyl", "r_ax", "r_pris", "r_base", "r_add", "r_diam", "r_high", "r_pd"],
            ["l_sph", "l_cyl", "l_ax", "l_pris", "l_base", "l_add", "l_diam", "l_high", "l_pd"],
        ),
        empty_paragraph(40),
        kv_table([("PD משולב", "comb_pd"), ("רב מוקדי", "multifocal_block")], pairs_per_row=2),
        empty_paragraph(),
        section_title("פרטי עדשות"),
        comparison_table(
            ["דגם", "ספק", "חומר", "ציפוי", "צבע", "קוטר"],
            ["r_lens_model", "r_lens_supplier", "r_lens_material", "r_lens_coating", "r_lens_color", "r_lens_diameter"],
            ["l_lens_model", "l_lens_supplier", "l_lens_material", "l_lens_coating", "l_lens_color", "l_lens_diameter"],
        ),
        empty_paragraph(),
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
        empty_paragraph(),
        section_title("פריטי חיוב"),
        expanded_billing_block(),
        empty_paragraph(),
        section_title("סיכום כספי"),
        metric_table(
            [
                ("סה\"כ", "total_price"),
                ("שולם", "amount_paid"),
                ("יתרה", "balance_due"),
            ]
        ),
        empty_paragraph(),
        section_title("הערות"),
        notes_row("הערות קליניות", "clinic_notes", "הערות לספק", "supplier_notes"),
    ]
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W_NS}"><w:body>'
        f"{''.join(content)}"
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="900" '
        'w:bottom="1080" w:left="900" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr>'
        "</w:body></w:document>"
    )


def build_contact_xml() -> str:
    content = [
        header_block("הזמנת עדשות מגע", "clinic_name"),
        empty_paragraph(),
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
        empty_paragraph(),
        section_title("פרטי לקוח"),
        kv_table(
            [
                ("שם לקוח", "client_name"),
                ("מספר לקוח", "client_id"),
                ("נייד", "phone_mobile"),
                ("טלפון בית", "phone_home"),
                ("טלפון עבודה", "phone_work"),
                ("כתובת", "client_address"),
            ],
            pairs_per_row=3,
        ),
        empty_paragraph(),
        section_title("צוות ותפעול"),
        kv_table(
            [
                ("אופטומטריסט", "optician_name"),
                ("יועץ", "advisor_name"),
                ("מוסר עבודה", "deliverer_name"),
            ],
            pairs_per_row=3,
        ),
        empty_paragraph(),
        section_title("פרטי עדשות"),
        comparison_table(
            ["סוג", "דגם", "ספק", "חומר", "צבע", "כמות"],
            ["r_lens_type", "r_model", "r_supplier", "r_material", "r_color", "r_quantity"],
            ["l_lens_type", "l_model", "l_supplier", "l_material", "l_color", "l_quantity"],
        ),
        empty_paragraph(),
        section_title("מרשם עדשות מגע"),
        eye_table(
            "עין",
            ["BC1", "BC2", "OZ", "DIAM", "SPH", "CYL", "AX", "READ/ADD"],
            ["r_bc1", "r_bc2", "r_oz", "r_diam", "r_sph", "r_cyl", "r_ax", "r_read_add"],
            ["l_bc1", "l_bc2", "l_oz", "l_diam", "l_sph", "l_cyl", "l_ax", "l_read_add"],
        ),
        empty_paragraph(),
        section_title("תמיסות"),
        kv_table(
            [
                ("ניקוי", "cleaning_solution"),
                ("חיטוי", "disinfection_solution"),
                ("שטיפה", "rinsing_solution"),
            ],
            pairs_per_row=3,
        ),
        empty_paragraph(),
        section_title("סיכום כספי"),
        metric_table(
            [
                ("סה\"כ", "total_price"),
                ("שולם", "amount_paid"),
                ("יתרה", "balance_due"),
            ]
        ),
        empty_paragraph(),
        section_title("הערות"),
        notes_row("הערות קליניות", "clinic_notes", "הערות לספק", "supplier_notes"),
    ]
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W_NS}"><w:body>'
        f"{''.join(content)}"
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="900" '
        'w:bottom="1080" w:left="900" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr>'
        "</w:body></w:document>"
    )


def replace_document_xml(docx_path: Path, xml_content: str) -> None:
    temp_path = docx_path.with_suffix(".tmp")
    with zipfile.ZipFile(docx_path, "r") as source, zipfile.ZipFile(temp_path, "w") as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == "word/document.xml":
                data = xml_content.encode("utf-8")
            target.writestr(item, data)
    temp_path.replace(docx_path)


def main() -> None:
    replace_document_xml(TEMPLATES_DIR / "regular-order.docx", build_regular_xml())
    replace_document_xml(TEMPLATES_DIR / "contact-order.docx", build_contact_xml())


if __name__ == "__main__":
    main()
