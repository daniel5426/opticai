"""Deterministic spreadsheet intake shared by manual imports and chat attachments."""
import csv
import io
import struct
from pathlib import Path
from fastapi import HTTPException

MAX_BYTES = 25 * 1024 * 1024
MAX_ROWS = 10000


def _xls_formula_cells(data):
    """Read BIFF FORMULA coordinates, since xlrd exposes only cached values."""
    from xlrd.compdoc import CompDoc
    stream = data
    if data.startswith(b'\xd0\xcf\x11\xe0'):
        document = CompDoc(data, logfile=io.StringIO())
        stream = document.get_named_stream('Workbook') or document.get_named_stream('Book')
    if not stream:
        raise ValueError('Missing workbook stream')
    sheets, formulas = {}, {}
    offset, current_sheet = 0, None
    while offset + 4 <= len(stream):
        record, size = struct.unpack_from('<HH', stream, offset)
        body = stream[offset + 4:offset + 4 + size]
        if len(body) != size:
            raise ValueError('Truncated workbook')
        if record == 0x0085 and size >= 8:  # BOUNDSHEET (BIFF8)
            position = struct.unpack_from('<I', body)[0]
            count, wide = body[6], body[7] & 1
            name = body[8:8 + count * (2 if wide else 1)].decode('utf-16le' if wide else 'latin1')
            sheets[position] = name
        if offset in sheets:
            current_sheet = sheets[offset]
        if record == 0x0006 and current_sheet and size >= 6:
            row, column = struct.unpack_from('<HH', body)
            formulas.setdefault(current_sheet, {}).setdefault(row + 1, []).append(column)
        offset += size + 4
    return formulas


def spreadsheet(filename, data):
    """Keep all nonempty source rows, sheet coordinates and textual identifiers."""
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(422, 'supply.tooLarge')
    suffix = Path(filename).suffix.lower()
    if suffix not in {'.xlsx', '.xls', '.csv'}:
        raise HTTPException(422, 'supply.invalidFile')
    rows = []

    def append(sheet, number, cells, formulas=()):
        if any(value not in (None, '') for value in cells) or formulas:
            row = {'sheet': sheet, 'row': number, 'cells': cells}
            if formulas:
                row['formula_columns'] = list(formulas)
            rows.append(row)
            if len(rows) > MAX_ROWS:
                raise HTTPException(422, 'supply.tooLarge')

    if suffix == '.xlsx':
        import openpyxl
        from zipfile import ZipFile
        with ZipFile(io.BytesIO(data)) as archive:
            if sum(item.file_size for item in archive.infolist()) > 100 * 1024 * 1024:
                raise HTTPException(422, 'supply.tooLarge')
        book = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=False)
        try:
            for sheet in book:
                for index, cells in enumerate(sheet.iter_rows(), 1):
                    values, formulas = [], []
                    for column, cell in enumerate(cells):
                        value = cell.value
                        if cell.data_type == 'f':
                            formulas.append(column)
                            value = None
                        elif isinstance(value, (int, float)) and not isinstance(value, bool) and cell.number_format and set(cell.number_format) == {'0'}:
                            value = str(int(value)).zfill(len(cell.number_format))
                        values.append(value if isinstance(value, (str, int, float, bool, type(None))) else str(value))
                    append(sheet.title, index, values, formulas)
        finally:
            book.close()
    elif suffix == '.xls':
        import xlrd
        book = xlrd.open_workbook(file_contents=data, formatting_info=True)
        try:
            if book.biff_version != 80:
                raise HTTPException(422, 'supply.legacyExcel')
            formulas = _xls_formula_cells(data)
            for sheet in book.sheets():
                for index in range(sheet.nrows):
                    formula_columns = formulas.get(sheet.name, {}).get(index + 1, [])
                    values = []
                    for column in range(sheet.ncols):
                        cell = sheet.cell(index, column)
                        value = cell.value
                        if column in formula_columns:
                            value = None
                        elif cell.ctype == xlrd.XL_CELL_NUMBER:
                            pattern = book.format_map[book.xf_list[sheet.cell_xf_index(index, column)].format_key].format_str
                            if pattern and set(pattern) == {'0'}:
                                value = str(int(value)).zfill(len(pattern))
                        values.append(value)
                    append(sheet.name, index + 1, values, formula_columns)
        finally:
            book.release_resources()
    else:
        if data.startswith((b'\xff\xfe', b'\xfe\xff')):
            text = data.decode('utf-16')
        else:
            try:
                text = data.decode('utf-8-sig')
            except UnicodeDecodeError:
                text = data.decode('cp1255')
        try:
            dialect = csv.Sniffer().sniff(text[:8192], delimiters=',;\t')
        except csv.Error:
            dialect = csv.excel
        for index, values in enumerate(csv.reader(io.StringIO(text), dialect), 1):
            append(filename, index, values)
    return rows
