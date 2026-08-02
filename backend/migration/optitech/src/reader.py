from __future__ import annotations

import csv
import os
from pathlib import Path
import subprocess
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Dict, Generator, Iterable, List, Mapping, Optional, Sequence


SOURCE_DB_PATH = Path(
    "/Users/danielbenassaya/Code/personal/opticai/random-files-finding-db/opt/optData.xns"
)
WORKSPACE_ROOT = Path(
    "/Users/danielbenassaya/Code/personal/opticai/backend/migration/optitech"
)
EXTRACTS_DIR = WORKSPACE_ROOT / "artifacts" / "extracts"
SCANS_DIR = SOURCE_DB_PATH.parent / "Scans"
_active_extracts_dir: ContextVar[Optional[Path]] = ContextVar("optitech_extracts_dir", default=None)
_active_scans_dir: ContextVar[Optional[Path]] = ContextVar("optitech_scans_dir", default=None)
DEFAULT_ENV = {
    "LC_ALL": "en_US.UTF-8",
    "LANG": "en_US.UTF-8",
}


try:
    csv.field_size_limit(1024 * 1024 * 64)
except Exception:
    pass


def ensure_source_db(source_db: Path = SOURCE_DB_PATH) -> Path:
    if not source_db.exists():
        raise FileNotFoundError(f"OptiTech source DB not found: {source_db}")
    return source_db


def ensure_extracts_dir(path: Path = EXTRACTS_DIR) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def run_mdbtools(args: Sequence[str], source_db: Path = SOURCE_DB_PATH) -> str:
    ensure_source_db(source_db)
    result = subprocess.run(
        list(args),
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env={**os.environ, **DEFAULT_ENV},
    )
    return result.stdout.decode("utf-8", errors="replace")


def export_table_text(table_name: str, source_db: Path = SOURCE_DB_PATH) -> str:
    return run_mdbtools(
        [
            "mdb-export",
            "-d",
            "\t",
            "-R",
            "\n",
            "-q",
            '"',
            "-e",
            "-T",
            "%Y-%m-%d %H:%M:%S",
            str(source_db),
            table_name,
        ],
        source_db=source_db,
    )


def export_table_to_tsv(
    table_name: str,
    output_path: Path,
    source_db: Path = SOURCE_DB_PATH,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(export_table_text(table_name, source_db=source_db), encoding="utf-8")
    return output_path


def export_tables(
    table_names: Iterable[str],
    extracts_dir: Path = EXTRACTS_DIR,
    source_db: Path = SOURCE_DB_PATH,
) -> Dict[str, Path]:
    ensure_extracts_dir(extracts_dir)
    exported: Dict[str, Path] = {}
    for table_name in table_names:
        exported[table_name] = export_table_to_tsv(
            table_name,
            extracts_dir / f"{table_name}.tsv",
            source_db=source_db,
        )
    return exported


def iter_tsv_rows(path: Path) -> Generator[Dict[str, str], None, None]:
    if not path.exists():
        return
    with path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle, delimiter="\t", quotechar='"')
        for row in reader:
            yield row


def iter_exported_rows(
    table_name: str,
    extracts_dir: Optional[Path] = None,
) -> Generator[Dict[str, str], None, None]:
    root = extracts_dir or _active_extracts_dir.get() or EXTRACTS_DIR
    tsv_path = root / f"{table_name}.tsv"
    csv_path = root / f"{table_name}.csv"
    if tsv_path.exists():
        yield from iter_tsv_rows(tsv_path)
        return
    if csv_path.exists():
        with csv_path.open("r", newline="", encoding="utf-8-sig") as handle:
            yield from csv.DictReader(handle)


def current_scans_dir() -> Path:
    return _active_scans_dir.get() or SCANS_DIR


def current_extracts_dir() -> Path:
    return _active_extracts_dir.get() or EXTRACTS_DIR


def bundle_paths_active() -> bool:
    return _active_extracts_dir.get() is not None


@contextmanager
def use_bundle_paths(extracts_dir: Path, scans_dir: Optional[Path] = None):
    extracts_token = _active_extracts_dir.set(extracts_dir)
    scans_token = _active_scans_dir.set(scans_dir)
    try:
        yield
    finally:
        _active_extracts_dir.reset(extracts_token)
        _active_scans_dir.reset(scans_token)


def count_table(table_name: str, source_db: Path = SOURCE_DB_PATH) -> int:
    output = run_mdbtools(["mdb-count", str(source_db), table_name], source_db=source_db)
    return int(output.strip())


def describe_table(table_name: str, source_db: Path = SOURCE_DB_PATH) -> str:
    return run_mdbtools(
        [
            "mdb-schema",
            "-T",
            table_name,
            "--no-relations",
            "--no-comments",
            "--no-default-values",
            str(source_db),
            "sqlite",
        ],
        source_db=source_db,
    )


def count_scan_files(scans_dir: Path = SCANS_DIR) -> int:
    if not scans_dir.exists():
        return 0
    return sum(1 for path in scans_dir.iterdir() if path.is_file())
