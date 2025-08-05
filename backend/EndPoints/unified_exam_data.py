from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Dict, Any
from database import get_db
from models import ExamData, ExamLayoutInstance
from schemas import ExamDataCreate, ExamDataUpdate, ExamData as ExamDataSchema
from auth import get_current_user
from models import User
import json

router = APIRouter(prefix="/unified-exam-data", tags=["Unified Exam Data"])

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
    
    # Get exam data
    exam_data = db.query(ExamData).filter(
        ExamData.layout_instance_id == layout_instance_id
    ).first()
    
    if not exam_data:
        return {}
    
    return exam_data.exam_data

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
    
    # Check if exam data already exists
    existing_data = db.query(ExamData).filter(
        ExamData.layout_instance_id == layout_instance_id
    ).first()
    
    print(f"DEBUG: Existing data found: {existing_data is not None}")
    
    if existing_data:
        # Update existing data
        existing_data.exam_data = exam_data
        db.commit()
        db.refresh(existing_data)
        print(f"DEBUG: Updated existing exam data")
        return {"success": True, "message": "Exam data updated successfully"}
    else:
        # Create new data
        new_exam_data = ExamData(
            layout_instance_id=layout_instance_id,
            exam_data=exam_data
        )
        db.add(new_exam_data)
        db.commit()
        db.refresh(new_exam_data)
        print(f"DEBUG: Created new exam data")
        return {"success": True, "message": "Exam data created successfully"}

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
    
    # Delete exam data
    exam_data = db.query(ExamData).filter(
        ExamData.layout_instance_id == layout_instance_id
    ).first()
    
    if exam_data:
        db.delete(exam_data)
        db.commit()
        return {"success": True, "message": "Exam data deleted successfully"}
    else:
        return {"success": True, "message": "No exam data found to delete"}

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
    
    # Get exam data
    exam_data = db.query(ExamData).filter(
        ExamData.layout_instance_id == layout_instance_id
    ).first()
    
    if not exam_data or component_type not in exam_data.exam_data:
        return None
    
    return exam_data.exam_data[component_type]

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
    
    # Get or create exam data
    exam_data = db.query(ExamData).filter(
        ExamData.layout_instance_id == layout_instance_id
    ).first()
    
    if not exam_data:
        exam_data = ExamData(
            layout_instance_id=layout_instance_id,
            exam_data={}
        )
        db.add(exam_data)
    
    # Update the specific component
    exam_data.exam_data[component_type] = component_data
    db.commit()
    db.refresh(exam_data)
    
    return {"success": True, "message": f"{component_type} data saved successfully"} 