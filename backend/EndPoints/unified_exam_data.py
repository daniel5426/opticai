from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Dict, Any
from database import get_db
from models import ExamLayoutInstance
# Unified exam data now stored on ExamLayoutInstance.exam_data
from auth import get_current_user
from models import User
from services.prescription_search_index import rebuild_exam_instance_index
import json

router = APIRouter(prefix="/unified-exam-data", tags=["Unified Exam Data"])


def _normalize_npc_key(key: str) -> str:
    return "npc" + key[3:] if key == "opc" or key.startswith("opc-") else key


def _legacy_npc_key(key: str) -> str:
    return "opc" + key[3:] if key == "npc" or key.startswith("npc-") else key


def _normalize_npc_exam_data(exam_data: Dict[str, Any]) -> Dict[str, Any]:
    """Upgrade legacy OPC JSON keys while preserving canonical NPC values."""
    normalized = {
        key: value
        for key, value in exam_data.items()
        if _normalize_npc_key(key) == key
    }
    for key, value in exam_data.items():
        normalized.setdefault(_normalize_npc_key(key), value)
    return normalized


@router.get("/{layout_instance_id}")
async def get_exam_data(
    layout_instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all exam data for a specific layout instance
    """
    # Verify the layout instance exists and user has access
    layout_instance = db.query(ExamLayoutInstance).filter(
        ExamLayoutInstance.id == layout_instance_id
    ).first()
    
    if not layout_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout instance not found"
        )
    
    # Return instance-level JSON
    return _normalize_npc_exam_data(layout_instance.exam_data or {})

@router.post("/{layout_instance_id}")
async def save_exam_data(
    layout_instance_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save all exam data for a specific layout instance
    """
    print(f"DEBUG: Received request to save exam data for layout_instance_id: {layout_instance_id}")
    
    # Parse the request body manually
    try:
        body = await request.body()
        print(f"DEBUG: Raw request body: {body}")
        
        exam_data = await request.json()
        print(f"DEBUG: Parsed exam data: {exam_data}")
        print(f"DEBUG: Exam data type: {type(exam_data)}")
    except Exception as e:
        print(f"DEBUG: Error parsing request body: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid JSON in request body: {str(e)}"
        )
    
    # Verify the layout instance exists and user has access
    layout_instance = db.query(ExamLayoutInstance).filter(
        ExamLayoutInstance.id == layout_instance_id
    ).first()
    
    print(f"DEBUG: Layout instance found: {layout_instance is not None}")
    
    if not layout_instance:
        print(f"DEBUG: Layout instance not found for ID: {layout_instance_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout instance not found"
        )
    
    # Upsert directly on instance row, upgrading legacy OPC keys to NPC.
    layout_instance.exam_data = _normalize_npc_exam_data(exam_data)
    rebuild_exam_instance_index(db, layout_instance)
    db.commit()
    db.refresh(layout_instance)
    print(f"DEBUG: Upserted exam data on instance")
    return {"success": True, "message": "Exam data saved successfully"}

@router.delete("/{layout_instance_id}")
async def delete_exam_data(
    layout_instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete all exam data for a specific layout instance
    """
    # Verify the layout instance exists and user has access
    layout_instance = db.query(ExamLayoutInstance).filter(
        ExamLayoutInstance.id == layout_instance_id
    ).first()
    
    if not layout_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout instance not found"
        )
    
    # Clear instance JSON
    layout_instance.exam_data = {}
    rebuild_exam_instance_index(db, layout_instance)
    db.commit()
    return {"success": True, "message": "Exam data cleared successfully"}

@router.get("/{layout_instance_id}/component/{component_type}")
async def get_exam_component_data(
    layout_instance_id: int,
    component_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get specific exam component data
    """
    # Verify the layout instance exists and user has access
    layout_instance = db.query(ExamLayoutInstance).filter(
        ExamLayoutInstance.id == layout_instance_id
    ).first()
    
    if not layout_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout instance not found"
        )
    
    data = layout_instance.exam_data or {}
    canonical_component_type = _normalize_npc_key(component_type)
    if canonical_component_type in data:
        return data[canonical_component_type]
    legacy_component_type = _legacy_npc_key(canonical_component_type)
    if legacy_component_type in data:
        return data[legacy_component_type]
    if component_type not in data:
        return None
    return data[component_type]

@router.post("/{layout_instance_id}/component/{component_type}")
async def save_exam_component_data(
    layout_instance_id: int,
    component_type: str,
    component_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save specific exam component data
    """
    # Verify the layout instance exists and user has access
    layout_instance = db.query(ExamLayoutInstance).filter(
        ExamLayoutInstance.id == layout_instance_id
    ).first()
    
    if not layout_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout instance not found"
        )
    
    # Update the specific component on instance JSON
    merged = _normalize_npc_exam_data(dict(layout_instance.exam_data or {}))
    merged[_normalize_npc_key(component_type)] = component_data
    layout_instance.exam_data = merged
    rebuild_exam_instance_index(db, layout_instance)
    db.commit()
    db.refresh(layout_instance)
    return {"success": True, "message": f"{component_type} data saved successfully"}
