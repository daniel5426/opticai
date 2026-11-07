from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Dict, Any
from database import get_db
from models import ExamLayoutInstance
# Unified exam data now stored on ExamLayoutInstance.exam_data
from auth import get_current_user
from models import User, OpticalExam
from security.scope import assert_record_scope
from services.exam_workspace import lock_instance_exam
from services.prescription_search_index import rebuild_exam_instance_index
from services.legacy_exam_compatibility import preserve_unrepresented_components
from services.prism_axis_compatibility import (
    is_prism_axis_component_key,
    normalize_prism_axis_block,
    normalize_prism_axis_exam_data,
)
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


def _normalize_exam_payload(exam_data: Dict[str, Any] | None) -> Dict[str, Any]:
    return normalize_prism_axis_exam_data(_normalize_npc_exam_data(exam_data or {}))


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

    assert_record_scope(db, current_user, db.get(OpticalExam, layout_instance.exam_id))
    # Return instance-level JSON
    return _normalize_exam_payload(layout_instance.exam_data or {})

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
    
    # Parse the request body manually
    try:
        
        exam_data = await request.json()
        if not isinstance(exam_data, dict):
            raise ValueError("Body must be a JSON object")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid JSON in request body: {str(e)}"
        )
    
    # Verify the layout instance exists and user has access
    lock_instance_exam(db, current_user, layout_instance_id)
    layout_instance = db.query(ExamLayoutInstance).populate_existing().with_for_update().filter(
        ExamLayoutInstance.id == layout_instance_id
    ).first()
    
    
    if not layout_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout instance not found"
        )

    assert_record_scope(db, current_user, db.get(OpticalExam, layout_instance.exam_id))
    # Upsert directly on instance row, upgrading legacy OPC keys to NPC.
    layout_instance.exam_data = preserve_unrepresented_components(
        _normalize_exam_payload(layout_instance.exam_data), _normalize_exam_payload(exam_data), request)
    rebuild_exam_instance_index(db, layout_instance)
    db.commit()
    db.refresh(layout_instance)
    return {"success": True, "message": "Exam data saved successfully"}

@router.delete("/{layout_instance_id}")
async def delete_exam_data(
    layout_instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Delete all exam data for a specific layout instance
    """
    # Verify the layout instance exists and user has access
    lock_instance_exam(db, current_user, layout_instance_id)
    layout_instance = db.query(ExamLayoutInstance).populate_existing().with_for_update().filter(
        ExamLayoutInstance.id == layout_instance_id
    ).first()
    
    if not layout_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout instance not found"
        )

    assert_record_scope(db, current_user, db.get(OpticalExam, layout_instance.exam_id))
    
    # Clear instance JSON
    layout_instance.exam_data = preserve_unrepresented_components(layout_instance.exam_data, {}, request)
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

    assert_record_scope(db, current_user, db.get(OpticalExam, layout_instance.exam_id))
    
    data = _normalize_exam_payload(layout_instance.exam_data or {})
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
    lock_instance_exam(db, current_user, layout_instance_id)
    layout_instance = db.query(ExamLayoutInstance).populate_existing().with_for_update().filter(
        ExamLayoutInstance.id == layout_instance_id
    ).first()
    
    if not layout_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout instance not found"
        )

    assert_record_scope(db, current_user, db.get(OpticalExam, layout_instance.exam_id))
    
    # Update the specific component on instance JSON
    merged = _normalize_exam_payload(dict(layout_instance.exam_data or {}))
    component_key = _normalize_npc_key(component_type)
    if is_prism_axis_component_key(component_key) and isinstance(component_data, dict):
        merged[component_key] = normalize_prism_axis_block(component_data)
    else:
        merged[component_key] = component_data
    layout_instance.exam_data = merged
    rebuild_exam_instance_index(db, layout_instance)
    db.commit()
    db.refresh(layout_instance)
    return {"success": True, "message": f"{component_type} data saved successfully"}
