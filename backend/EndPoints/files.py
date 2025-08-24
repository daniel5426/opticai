from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File as FastAPIFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import File as FileModel, Client, User
from sqlalchemy import func
from schemas import FileCreate, FileUpdate, File as FileSchema
from uuid import uuid4
from supabase import create_client
import config

router = APIRouter(prefix="/files", tags=["files"])

def get_supabase_client():
    supabase_url = getattr(config.settings, 'SUPABASE_URL', None)
    supabase_key = getattr(config.settings, 'SUPABASE_KEY', None) or getattr(config.settings, 'SUPABASE_ANON_KEY', None)
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    return create_client(supabase_url, supabase_key)

@router.post("/", response_model=FileSchema)
async def create_file(
    client_id: int = Form(...),
    clinic_id: Optional[int] = Form(None),
    uploaded_by: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
    upload: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db)
):
    try:
        sb = get_supabase_client()
        file_bytes = await upload.read()
        unique_name = f"{uuid4().hex}_{upload.filename}"
        base_path = f"{clinic_id or 'no-clinic'}/{client_id}"
        storage_path = f"{base_path}/{unique_name}"
        bucket = config.settings.SUPABASE_BUCKET or "opticai-files"
        sb.storage.from_(bucket).upload(
            file=file_bytes,
            path=storage_path,
            file_options={"content-type": upload.content_type or "application/octet-stream"}
        )
        public_url_resp = sb.storage.from_(bucket).get_public_url(storage_path)
        public_url = (
            public_url_resp.get('data', {}).get('publicUrl')
            if isinstance(public_url_resp, dict)
            else str(public_url_resp)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    db_file = FileModel(
        client_id=client_id,
        clinic_id=clinic_id,
        file_name=upload.filename,
        file_path=public_url,
        file_size=len(file_bytes),
        file_type=upload.content_type,
        uploaded_by=uploaded_by,
        notes=notes or "",
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    try:
        if db_file.client_id:
            client = db.query(Client).filter(Client.id == db_file.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    return db_file

@router.get("/paginated")
def get_files_paginated(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("upload_date_desc", description="Sort order: upload_date_desc|upload_date_asc|id_desc|id_asc"),
    db: Session = Depends(get_db)
):
    base = db.query(FileModel)
    if clinic_id:
        base = base.filter(FileModel.clinic_id == clinic_id)
    
    # Apply ordering
    if order == "upload_date_desc":
        base = base.order_by(FileModel.upload_date.desc().nulls_last())
    elif order == "upload_date_asc":
        base = base.order_by(FileModel.upload_date.asc().nulls_last())
    elif order == "id_asc":
        base = base.order_by(FileModel.id.asc())
    else:  # default to id_desc
        base = base.order_by(FileModel.id.desc())
    
    total = base.count()
    items = base.offset(offset).limit(limit).all()
    
    return {"items": items, "total": total}

@router.get("/{file_id}", response_model=FileSchema)
def get_file(file_id: int, db: Session = Depends(get_db)):
    file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file

@router.get("/", response_model=List[FileSchema])
def get_all_files(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(FileModel)
    if clinic_id:
        query = query.filter(FileModel.clinic_id == clinic_id)
    return query.all()

@router.get("/client/{client_id}", response_model=List[FileSchema])
def get_files_by_client(client_id: int, db: Session = Depends(get_db)):
    files = db.query(FileModel).filter(FileModel.client_id == client_id).all()
    return files

@router.put("/{file_id}", response_model=FileSchema)
def update_file(file_id: int, file: FileUpdate, db: Session = Depends(get_db)):
    db_file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    for field, value in file.dict(exclude_unset=True).items():
        setattr(db_file, field, value)
    
    db.commit()
    # bump client_updated_date
    try:
        if db_file.client_id:
            client = db.query(Client).filter(Client.id == db_file.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    db.refresh(db_file)
    return db_file

@router.delete("/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)):
    file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    client_id = file.client_id
    try:
        if file.file_path:
            bucket = config.settings.SUPABASE_BUCKET or "opticai"
            fp = file.file_path
            prefix_public = "/storage/v1/object/public/"
            prefix_object = "/storage/v1/object/"
            storage_path = None
            try:
                if prefix_public in fp:
                    after = fp.split(prefix_public, 1)[1]
                elif prefix_object in fp:
                    after = fp.split(prefix_object, 1)[1]
                else:
                    after = fp
                parts = after.split("/", 1)
                storage_path = parts[1] if len(parts) == 2 else after
                sb = get_supabase_client()
                sb.storage.from_(bucket).remove([storage_path])
            except Exception:
                pass
    finally:
        db.delete(file)
        db.commit()
    # bump client_updated_date
    try:
        if client_id:
            client = db.query(Client).filter(Client.id == client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    return {"message": "File deleted successfully"} 


@router.get("/{file_id}/download-url")
def get_file_download_url(file_id: int, db: Session = Depends(get_db)):
    file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if not file.file_path:
        raise HTTPException(status_code=400, detail="No file path available")

    bucket = config.settings.SUPABASE_BUCKET or "opticai"
    path = None
    try:
        fp = file.file_path
        prefix_public = "/storage/v1/object/public/"
        prefix_object = "/storage/v1/object/"
        if prefix_public in fp:
            after = fp.split(prefix_public, 1)[1]
        elif prefix_object in fp:
            after = fp.split(prefix_object, 1)[1]
        else:
            after = fp
        parts = after.split("/", 1)
        if len(parts) == 2:
            path = parts[1]
        else:
            path = after
    except Exception:
        path = None

    if not path:
        raise HTTPException(status_code=400, detail="Could not resolve storage path from file path")

    try:
        sb = get_supabase_client()
        resp = sb.storage.from_(bucket).create_signed_url(path, 3600)
        url = None
        if isinstance(resp, dict):
            data = resp.get('data') or resp
            url = (
                data.get('signed_url')
                or data.get('signedUrl')
                or data.get('publicUrl')
                or data.get('signedURL')
            )
        if not url and not isinstance(resp, dict):
            url = str(resp)
        if not url:
            raise Exception("No signed URL returned")
        return {"url": url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create signed URL: {str(e)}")