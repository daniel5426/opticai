from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File as FastAPIFile, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import config
from auth import get_current_user
from database import get_db
from models import Client, File as FileModel, User
from schemas import File as FileSchema, FileUpdate
from security.scope import (
    get_allowed_clinic_ids,
    get_scoped_client,
    get_scoped_file,
)
from services.file_storage_service import FileStorageService, get_file_storage_service

router = APIRouter(prefix="/files", tags=["files"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
DEFAULT_CONTENT_TYPE = "application/octet-stream"

ALLOWED_EXTENSIONS = {
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "txt",
    "csv",
    "rtf",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "tif",
    "tiff",
    "heic",
    "zip",
    "rar",
    "7z",
    "gz",
}

DANGEROUS_EXTENSIONS = {
    "app",
    "bat",
    "bin",
    "cmd",
    "com",
    "dll",
    "dmg",
    "exe",
    "jar",
    "js",
    "msi",
    "ps1",
    "scr",
    "sh",
}

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/rtf",
    "application/zip",
    "application/x-zip-compressed",
    "application/vnd.rar",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/gzip",
    "text/plain",
    "text/csv",
    "text/rtf",
}

EXTENSION_BY_CONTENT_TYPE = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/rtf": "rtf",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
    "application/vnd.rar": "rar",
    "application/x-rar-compressed": "rar",
    "application/x-7z-compressed": "7z",
    "application/gzip": "gz",
    "text/plain": "txt",
    "text/csv": "csv",
    "text/rtf": "rtf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/heic": "heic",
}


def build_file_category_filter(file_category: str):
    normalized = (file_category or "").strip().lower()
    if normalized in {"", "all"}:
        return None
    if normalized == "image":
        return FileModel.file_type.ilike("image/%")
    if normalized == "video":
        return FileModel.file_type.ilike("video/%")
    if normalized == "audio":
        return FileModel.file_type.ilike("audio/%")
    if normalized == "archive":
        return (
            FileModel.file_type.ilike("%zip%")
            | FileModel.file_type.ilike("%rar%")
            | FileModel.file_type.ilike("%7z%")
            | FileModel.file_type.ilike("%gzip%")
            | FileModel.file_type.ilike("%archive%")
        )
    if normalized == "document":
        return (
            FileModel.file_type.ilike("%pdf%")
            | FileModel.file_type.ilike("%word%")
            | FileModel.file_type.ilike("%document%")
            | FileModel.file_type.ilike("%sheet%")
            | FileModel.file_type.ilike("%excel%")
            | FileModel.file_type.ilike("%spreadsheet%")
            | FileModel.file_type.ilike("%presentation%")
            | FileModel.file_type.ilike("%powerpoint%")
            | FileModel.file_type.ilike("%text%")
            | FileModel.file_type.ilike("%rtf%")
            | FileModel.file_type.ilike("%csv%")
        )
    return ~(
        FileModel.file_type.ilike("image/%")
        | FileModel.file_type.ilike("video/%")
        | FileModel.file_type.ilike("audio/%")
        | FileModel.file_type.ilike("%zip%")
        | FileModel.file_type.ilike("%rar%")
        | FileModel.file_type.ilike("%7z%")
        | FileModel.file_type.ilike("%gzip%")
        | FileModel.file_type.ilike("%archive%")
        | FileModel.file_type.ilike("%pdf%")
        | FileModel.file_type.ilike("%word%")
        | FileModel.file_type.ilike("%document%")
        | FileModel.file_type.ilike("%sheet%")
        | FileModel.file_type.ilike("%excel%")
        | FileModel.file_type.ilike("%spreadsheet%")
        | FileModel.file_type.ilike("%presentation%")
        | FileModel.file_type.ilike("%powerpoint%")
        | FileModel.file_type.ilike("%text%")
        | FileModel.file_type.ilike("%rtf%")
        | FileModel.file_type.ilike("%csv%")
    )


async def read_upload_bytes(upload: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File is too large. Maximum size is 25 MB")
        chunks.append(chunk)
    return b"".join(chunks)


def normalize_file_name(raw_name: Optional[str]) -> str:
    cleaned = (raw_name or "file").replace("\\", "/").split("/")[-1].strip()
    if not cleaned:
        cleaned = "file"
    return cleaned[:255]


def normalize_content_type(content_type: Optional[str]) -> str:
    value = (content_type or DEFAULT_CONTENT_TYPE).split(";", 1)[0].strip().lower()
    return value or DEFAULT_CONTENT_TYPE


def validate_upload_type(file_name: str, content_type: str) -> str:
    suffix = Path(file_name).suffix.lower().lstrip(".")
    if suffix in DANGEROUS_EXTENSIONS:
        raise HTTPException(status_code=415, detail="File type is not allowed")

    content_type_allowed = content_type in ALLOWED_CONTENT_TYPES or content_type.startswith("image/")
    extension_allowed = suffix in ALLOWED_EXTENSIONS
    if not content_type_allowed and not extension_allowed:
        raise HTTPException(status_code=415, detail="File type is not allowed")

    object_extension = suffix or EXTENSION_BY_CONTENT_TYPE.get(content_type)
    if not object_extension or object_extension in DANGEROUS_EXTENSIONS:
        raise HTTPException(status_code=415, detail="File type is not allowed")
    return object_extension


def bump_client_updated_date(db: Session, client_id: Optional[int]) -> None:
    if not client_id:
        return
    client = db.query(Client).filter(Client.id == client_id).first()
    if client:
        client.client_updated_date = func.now()
        db.commit()


def require_storage_metadata(file: FileModel) -> tuple[str, str]:
    if not file.storage_bucket or not file.storage_key:
        raise HTTPException(
            status_code=409,
            detail="File storage metadata is missing. Re-upload this file.",
        )
    return file.storage_bucket, file.storage_key


@router.post("/", response_model=FileSchema)
async def create_file(
    client_id: int = Form(...),
    clinic_id: Optional[int] = Form(None),
    uploaded_by: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
    upload: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_file_storage_service),
):
    scoped_client = get_scoped_client(db, current_user, client_id)
    display_name = normalize_file_name(upload.filename)
    content_type = normalize_content_type(upload.content_type)
    object_extension = validate_upload_type(display_name, content_type)
    file_bytes = await read_upload_bytes(upload)
    if not file_bytes:
        raise HTTPException(status_code=422, detail="File is empty")

    bucket = config.settings.SUPABASE_BUCKET or "opticai"
    storage_key = f"clinics/{scoped_client.clinic_id}/clients/{scoped_client.id}/files/{uuid4().hex}.{object_extension}"
    storage.upload(bucket, storage_key, file_bytes, content_type)

    db_file = FileModel(
        client_id=scoped_client.id,
        clinic_id=scoped_client.clinic_id,
        file_name=display_name,
        original_file_name=display_name,
        storage_bucket=bucket,
        storage_key=storage_key,
        file_size=len(file_bytes),
        file_type=content_type,
        uploaded_by=current_user.id,
        notes=notes or "",
    )
    try:
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        bump_client_updated_date(db, db_file.client_id)
    except Exception as exc:
        db.rollback()
        try:
            storage.remove(bucket, storage_key)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"File metadata save failed: {exc}") from exc

    return db_file


@router.get("/paginated")
def get_files_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("upload_date_desc", description="Sort order: upload_date_desc|upload_date_asc|id_desc|id_asc"),
    search: Optional[str] = Query(None, description="Search by file name/type/uploader/client name/notes"),
    file_category: Optional[str] = Query(None, description="Filter by file category"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    base = (
        db.query(
            FileModel,
            func.concat(Client.first_name, " ", Client.last_name).label("client_full_name"),
        )
        .outerjoin(Client, Client.id == FileModel.client_id)
        .filter(FileModel.clinic_id.in_(allowed_clinic_ids))
    )
    file_category_filter = build_file_category_filter(file_category or "")
    if file_category_filter is not None:
        base = base.filter(file_category_filter)
    if search:
        like = f"%{search.strip()}%"
        base = (
            base.outerjoin(User, User.id == FileModel.uploaded_by)
            .filter(
                or_(
                    FileModel.file_name.ilike(like),
                    FileModel.original_file_name.ilike(like),
                    FileModel.file_type.ilike(like),
                    FileModel.notes.ilike(like),
                    func.concat(Client.first_name, " ", Client.last_name).ilike(like),
                    User.full_name.ilike(like),
                    User.username.ilike(like),
                )
            )
        )
    order_columns = {
        "upload_date": FileModel.upload_date,
        "id": FileModel.id,
        "file_name": FileModel.file_name,
        "type": FileModel.file_type,
        "file_size": FileModel.file_size,
        "client": func.concat(Client.first_name, " ", Client.last_name),
    }
    order_key, _, order_direction = (order or "upload_date_desc").rpartition("_")
    order_column = order_columns.get(order_key, FileModel.upload_date)
    if order_direction == "asc":
        base = base.order_by(order_column.asc().nulls_last(), FileModel.id.asc())
    else:
        base = base.order_by(order_column.desc().nulls_last(), FileModel.id.desc())

    total = base.count()
    rows = base.offset(offset).limit(limit).all()
    items = []
    for row in rows:
        f = row[0]
        setattr(f, "client_full_name", row[1])
        items.append(f)
    return {"items": items, "total": total}


@router.get("/", response_model=List[FileSchema])
def get_all_files(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    return db.query(FileModel).filter(FileModel.clinic_id.in_(allowed_clinic_ids)).all()


@router.get("/client/{client_id}", response_model=List[FileSchema])
def get_files_by_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_scoped_client(db, current_user, client_id)
    return db.query(FileModel).filter(FileModel.client_id == client_id).all()


@router.get("/{file_id}", response_model=FileSchema)
def get_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_scoped_file(db, current_user, file_id)


@router.patch("/{file_id}", response_model=FileSchema)
def update_file(
    file_id: int,
    file: FileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_file = get_scoped_file(db, current_user, file_id)
    payload = file.model_dump(exclude_unset=True)
    if "file_name" in payload:
        db_file.file_name = normalize_file_name(payload["file_name"])
    if "notes" in payload:
        db_file.notes = payload["notes"] or ""
    db.commit()
    bump_client_updated_date(db, db_file.client_id)
    db.refresh(db_file)
    return db_file


@router.delete("/{file_id}")
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_file_storage_service),
):
    file = get_scoped_file(db, current_user, file_id)
    client_id = file.client_id
    storage_bucket, storage_key = require_storage_metadata(file)
    storage.remove(storage_bucket, storage_key)
    db.delete(file)
    db.commit()
    bump_client_updated_date(db, client_id)
    return {"message": "File deleted successfully"}


@router.get("/{file_id}/download-url")
def get_file_download_url(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_file_storage_service),
):
    file = get_scoped_file(db, current_user, file_id)
    storage_bucket, storage_key = require_storage_metadata(file)
    return {"url": storage.create_signed_url(storage_bucket, storage_key, 3600)}
