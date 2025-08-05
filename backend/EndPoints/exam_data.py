from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from database import get_db
from models import (
    NotesExam, OldRefractionExam, OldRefractionExtensionExam, ObjectiveExam,
    SubjectiveExam, AdditionExam, RetinoscopExam, RetinoscopDilationExam,
    FinalSubjectiveExam, FinalPrescriptionExam, CompactPrescriptionExam,
    UncorrectedVAExam, KeratometerExam, KeratometerFullExam, CornealTopographyExam,
    CoverTestExam, SchirmerTestExam, OldRefExam, ContactLensDiameters,
    ContactLensDetails, KeratometerContactLens, ContactLensExam, ContactLensOrder,
    OldContactLenses, OverRefraction, SensationVisionStabilityExam,
    DiopterAdjustmentPanel, FusionRangeExam, MaddoxRodExam, StereoTestExam,
    OcularMotorAssessmentExam, RGExam, AnamnesisExam
)
from pydantic import BaseModel

router = APIRouter(prefix="/exam-data", tags=["exam-data"])

# Exam type mapping
EXAM_MODELS = {
    'notes': NotesExam,
    'old-refraction': OldRefractionExam,
    'old-refraction-extension': OldRefractionExtensionExam,
    'objective': ObjectiveExam,
    'subjective': SubjectiveExam,
    'addition': AdditionExam,
    'retinoscop': RetinoscopExam,
    'retinoscop-dilation': RetinoscopDilationExam,
    'final-subjective': FinalSubjectiveExam,
    'final-prescription': FinalPrescriptionExam,
    'compact-prescription': CompactPrescriptionExam,
    'uncorrected-va': UncorrectedVAExam,
    'keratometer': KeratometerExam,
    'keratometer-full': KeratometerFullExam,
    'corneal-topography': CornealTopographyExam,
    'cover-test': CoverTestExam,
    'schirmer-test': SchirmerTestExam,
    'old-ref': OldRefExam,
    'contact-lens-diameters': ContactLensDiameters,
    'contact-lens-details': ContactLensDetails,
    'keratometer-contact-lens': KeratometerContactLens,
    'contact-lens-exam': ContactLensExam,
    'contact-lens-order': ContactLensOrder,
    'old-contact-lenses': OldContactLenses,
    'over-refraction': OverRefraction,
    'sensation-vision-stability': SensationVisionStabilityExam,
    'diopter-adjustment-panel': DiopterAdjustmentPanel,
    'fusion-range': FusionRangeExam,
    'maddox-rod': MaddoxRodExam,
    'stereo-test': StereoTestExam,
    'ocular-motor-assessment': OcularMotorAssessmentExam,
    'rg': RGExam,
    'anamnesis': AnamnesisExam
}

class ExamDataCreate(BaseModel):
    layout_instance_id: int
    data: Dict[str, Any]

class ExamDataUpdate(BaseModel):
    data: Dict[str, Any]

class BatchExamDataCreate(BaseModel):
    layout_instance_id: int
    exam_data: Dict[str, Dict[str, Any]]

# Batch API endpoints - must be defined BEFORE individual exam type routes
@router.get("/batch/{layout_instance_id}")
def get_all_exam_data(layout_instance_id: int, db: Session = Depends(get_db)):
    """Get all exam data for a layout instance in a single request"""
    result = {}
    
    for exam_type, model_class in EXAM_MODELS.items():
        try:
            if exam_type == 'notes':
                # Notes can have multiple records per layout instance
                exam_data = db.query(model_class).filter(
                    model_class.layout_instance_id == layout_instance_id
                ).all()
                if exam_data:
                    # Group by card_instance_id if present
                    notes_by_card = {}
                    for note in exam_data:
                        if hasattr(note, 'card_instance_id') and note.card_instance_id:
                            notes_by_card[f"notes-{note.card_instance_id}"] = note
                        else:
                            notes_by_card['notes'] = note
                    result.update(notes_by_card)
            elif exam_type == 'cover-test':
                # Cover test can have multiple records per layout instance
                exam_data = db.query(model_class).filter(
                    model_class.layout_instance_id == layout_instance_id
                ).all()
                if exam_data:
                    # Group by card_id and card_instance_id
                    cover_tests_by_card = {}
                    for cover_test in exam_data:
                        if hasattr(cover_test, 'card_id') and hasattr(cover_test, 'card_instance_id'):
                            key = f"cover-test-{cover_test.card_id}-{cover_test.card_instance_id}"
                            cover_tests_by_card[key] = cover_test
                        else:
                            cover_tests_by_card['cover-test'] = cover_test
                    result.update(cover_tests_by_card)
            else:
                # Single record per layout instance for other types
                exam_data = db.query(model_class).filter(
                    model_class.layout_instance_id == layout_instance_id
                ).first()
                if exam_data:
                    result[exam_type] = exam_data
        except Exception as e:
            # Log error but continue with other exam types
            print(f"Error loading {exam_type} data: {e}")
            continue
    
    return result

@router.post("/batch/{layout_instance_id}")
def save_all_exam_data(layout_instance_id: int, batch_data: BatchExamDataCreate, db: Session = Depends(get_db)):
    """Save all exam data for a layout instance in a single request"""
    result = {}
    
    try:
        for key, exam_data in batch_data.exam_data.items():
            # Extract the base exam type from the key (e.g., 'notes-cardId' -> 'notes')
            exam_type = key.split('-')[0] if '-' in key else key
            
            if exam_type not in EXAM_MODELS:
                print(f"Skipping unknown exam type: {exam_type} from key: {key}")
                continue
                
            model_class = EXAM_MODELS[exam_type]
            
            # Check if record exists
            existing_record = None
            if 'id' in exam_data and exam_data['id']:
                existing_record = db.query(model_class).filter(model_class.id == exam_data['id']).first()
            
            if existing_record:
                # Update existing record
                for field, value in exam_data.items():
                    if hasattr(existing_record, field) and field != 'id':
                        setattr(existing_record, field, value)
                db.commit()
                db.refresh(existing_record)
                result[key] = existing_record
            else:
                # Create new record
                exam_dict = {"layout_instance_id": layout_instance_id}
                exam_dict.update(exam_data)
                
                # Remove id if present (for new records)
                exam_dict.pop('id', None)
                
                db_exam = model_class(**exam_dict)
                db.add(db_exam)
                db.commit()
                db.refresh(db_exam)
                result[key] = db_exam
                
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving exam data: {str(e)}")
    
    return result


@router.post("/{exam_type}")
def create_exam_data(exam_type: str, exam_data: ExamDataCreate, db: Session = Depends(get_db)):
    if exam_type not in EXAM_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid exam type: {exam_type}")
    
    model_class = EXAM_MODELS[exam_type]
    
    # Create the exam data with layout_instance_id and additional data
    exam_dict = {"layout_instance_id": exam_data.layout_instance_id}
    exam_dict.update(exam_data.data)
    
    db_exam = model_class(**exam_dict)
    db.add(db_exam)
    db.commit()
    db.refresh(db_exam)
    
    return db_exam

@router.get("/{exam_type}/{layout_instance_id}")
def get_exam_data(exam_type: str, layout_instance_id: int, db: Session = Depends(get_db)):
    if exam_type not in EXAM_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid exam type: {exam_type}")
    
    model_class = EXAM_MODELS[exam_type]
    exam_data = db.query(model_class).filter(
        model_class.layout_instance_id == layout_instance_id
    ).first()
    
    if not exam_data:
        return None
    
    return exam_data

@router.put("/{exam_type}/{exam_id}")
def update_exam_data(exam_type: str, exam_id: int, exam_data: ExamDataUpdate, db: Session = Depends(get_db)):
    if exam_type not in EXAM_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid exam type: {exam_type}")
    
    model_class = EXAM_MODELS[exam_type]
    db_exam = db.query(model_class).filter(model_class.id == exam_id).first()
    
    if not db_exam:
        raise HTTPException(status_code=404, detail="Exam data not found")
    
    for field, value in exam_data.data.items():
        if hasattr(db_exam, field):
            setattr(db_exam, field, value)
    
    db.commit()
    db.refresh(db_exam)
    return db_exam

@router.delete("/{exam_type}/{exam_id}")
def delete_exam_data(exam_type: str, exam_id: int, db: Session = Depends(get_db)):
    if exam_type not in EXAM_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid exam type: {exam_type}")
    
    model_class = EXAM_MODELS[exam_type]
    exam_data = db.query(model_class).filter(model_class.id == exam_id).first()
    
    if not exam_data:
        raise HTTPException(status_code=404, detail="Exam data not found")
    
    db.delete(exam_data)
    db.commit()
    return {"message": "Exam data deleted successfully"}

@router.get("/batch/{layout_instance_id}")
def get_all_exam_data(layout_instance_id: int, db: Session = Depends(get_db)):
    """Get all exam data for a layout instance in a single request"""
    result = {}
    
    for exam_type, model_class in EXAM_MODELS.items():
        try:
            if exam_type == 'notes':
                # Notes can have multiple records per layout instance
                exam_data = db.query(model_class).filter(
                    model_class.layout_instance_id == layout_instance_id
                ).all()
                if exam_data:
                    # Group by card_instance_id if present
                    notes_by_card = {}
                    for note in exam_data:
                        if hasattr(note, 'card_instance_id') and note.card_instance_id:
                            notes_by_card[f"notes-{note.card_instance_id}"] = note
                        else:
                            notes_by_card['notes'] = note
                    result.update(notes_by_card)
            elif exam_type == 'cover-test':
                # Cover test can have multiple records per layout instance
                exam_data = db.query(model_class).filter(
                    model_class.layout_instance_id == layout_instance_id
                ).all()
                if exam_data:
                    # Group by card_id and card_instance_id
                    cover_tests_by_card = {}
                    for cover_test in exam_data:
                        if hasattr(cover_test, 'card_id') and hasattr(cover_test, 'card_instance_id'):
                            key = f"cover-test-{cover_test.card_id}-{cover_test.card_instance_id}"
                            cover_tests_by_card[key] = cover_test
                        else:
                            cover_tests_by_card['cover-test'] = cover_test
                    result.update(cover_tests_by_card)
            else:
                # Single record per layout instance for other types
                exam_data = db.query(model_class).filter(
                    model_class.layout_instance_id == layout_instance_id
                ).first()
                if exam_data:
                    result[exam_type] = exam_data
        except Exception as e:
            # Log error but continue with other exam types
            print(f"Error loading {exam_type} data: {e}")
            continue
    
    return result

@router.post("/batch/{layout_instance_id}")
def save_all_exam_data(layout_instance_id: int, batch_data: BatchExamDataCreate, db: Session = Depends(get_db)):
    """Save all exam data for a layout instance in a single request"""
    result = {}
    
    try:
        for key, exam_data in batch_data.exam_data.items():
            # Extract the base exam type from the key (e.g., 'notes-cardId' -> 'notes')
            exam_type = key.split('-')[0] if '-' in key else key
            
            if exam_type not in EXAM_MODELS:
                print(f"Skipping unknown exam type: {exam_type} from key: {key}")
                continue
                
            model_class = EXAM_MODELS[exam_type]
            
            # Check if record exists
            existing_record = None
            if 'id' in exam_data and exam_data['id']:
                existing_record = db.query(model_class).filter(model_class.id == exam_data['id']).first()
            
            if existing_record:
                # Update existing record
                for field, value in exam_data.items():
                    if hasattr(existing_record, field) and field != 'id':
                        setattr(existing_record, field, value)
                db.commit()
                db.refresh(existing_record)
                result[key] = existing_record
            else:
                # Create new record
                exam_dict = {"layout_instance_id": layout_instance_id}
                exam_dict.update(exam_data)
                
                # Remove id if present (for new records)
                exam_dict.pop('id', None)
                
                db_exam = model_class(**exam_dict)
                db.add(db_exam)
                db.commit()
                db.refresh(db_exam)
                result[key] = db_exam
                
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving exam data: {str(e)}")
    
    return result

@router.get("/types")
def get_exam_types():
    return {"exam_types": list(EXAM_MODELS.keys())} 