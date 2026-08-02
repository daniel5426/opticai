import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

from scripts.generate_order_docx_templates import (
    ROOT,
    build_contact_xml,
    build_regular_xml,
    replace_document_xml,
)


SOURCE_PREVIEWS = ROOT / "output" / "order-template-previews"
OUTPUT_DIR = ROOT / "output" / "docx" / "order-rtl-corrected"
LTR_MARK = "\u200e"


def document_text_runs(docx_path: Path) -> list[str]:
    with zipfile.ZipFile(docx_path) as archive:
        document_xml = archive.read("word/document.xml").decode("utf-8")
    return re.findall(r"<w:t(?: [^>]*)?>(.*?)</w:t>", document_xml)


def sample_values(kind: str) -> dict[str, str]:
    baseline_bytes = subprocess.check_output(
        ["git", "show", f"HEAD:public/templates/{kind}-order.docx"], cwd=ROOT
    )
    with tempfile.NamedTemporaryFile(suffix=".docx") as baseline_file:
        baseline_file.write(baseline_bytes)
        baseline_file.flush()
        baseline_runs = document_text_runs(Path(baseline_file.name))

    filled_runs = document_text_runs(SOURCE_PREVIEWS / f"{kind}-order-preview.docx")
    if len(baseline_runs) != len(filled_runs):
        raise RuntimeError(f"Cannot map {kind} sample values: text run counts differ")

    return {
        placeholder[1:-1]: value
        for placeholder, value in zip(baseline_runs, filled_runs)
        if placeholder.startswith("{") and placeholder.endswith("}")
    }


def fill_docx(docx_path: Path, values: dict[str, str]) -> None:
    temp_path = docx_path.with_suffix(".filled.docx")
    with zipfile.ZipFile(docx_path) as source, zipfile.ZipFile(temp_path, "w") as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == "word/document.xml":
                text = data.decode("utf-8")
                for key, value in values.items():
                    if re.fullmatch(r"[+-]\d+(?:\.\d+)?", value):
                        value = f"{LTR_MARK}{value}{LTR_MARK}"
                    text = text.replace(f">{{{key}}}<", f">{value}<")
                data = text.encode("utf-8")
            target.writestr(item, data)
    temp_path.replace(docx_path)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for kind, builder in (("regular", build_regular_xml), ("contact", build_contact_xml)):
        values = sample_values(kind)
        destination = OUTPUT_DIR / f"{kind}-order-corrected.docx"
        destination.write_bytes((ROOT / "public" / "templates" / f"{kind}-order.docx").read_bytes())
        replace_document_xml(destination, builder("balanced"))
        fill_docx(destination, values)


if __name__ == "__main__":
    main()
