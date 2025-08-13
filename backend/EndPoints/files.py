from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import File, Client, User
from sqlalchemy import func
from schemas import FileCreate, FileUpdate, File as FileSchema

router = APIRouter(prefix="/files", tags=["files"])

@router.post("/", response_model=FileSchema)
def create_file(file: FileCreate, db: Session = Depends(get_db)):
    db_file = File(**file.dict())
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    # bump client_updated_date
    try:
        if db_file.client_id:
            client = db.query(Client).filter(Client.id == db_file.client_id).first()
            if client:
                client.client_updated_date = func.now()
                db.commit()
    except Exception:
        pass
    return db_file

@router.get("/{file_id}", response_model=FileSchema)
def get_file(file_id: int, db: Session = Depends(get_db)):
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file

@router.get("/", response_model=List[FileSchema])
def get_all_files(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(File)
    if clinic_id:
        query = query.filter(File.clinic_id == clinic_id)
    return query.all()

@router.get("/client/{client_id}", response_model=List[FileSchema])
def get_files_by_client(client_id: int, db: Session = Depends(get_db)):
    files = db.query(File).filter(File.client_id == client_id).all()
    return files

@router.put("/{file_id}", response_model=FileSchema)
def update_file(file_id: int, file: FileUpdate, db: Session = Depends(get_db)):
    db_file = db.query(File).filter(File.id == file_id).first()
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
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    client_id = file.client_id
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