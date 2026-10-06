"""
Base classes and utilities for AI tools.
"""
import json
import logging
import traceback
from typing import Any, Dict, List, Optional
from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from rapidfuzz import process, fuzz

from database import SessionLocal
from models import User, Client, Clinic

logger = logging.getLogger("uvicorn.error")
CEO_LEVEL = 4


class ToolResponse:
    """Standardized tool response."""
    
    @staticmethod
    def success(data: Any, message: str = "Success", progress: Optional[Dict[str, Any]] = None) -> str:
        return json.dumps({
            "status": "success",
            "data": data,
            "message": message,
            "progress": progress
        }, ensure_ascii=False)
    
    @staticmethod
    def error(error: str, suggestions: Optional[List[Dict[str, Any]]] = None) -> str:
        return json.dumps({
            "status": "error",
            "error": error,
            "suggestions": suggestions or []
        }, ensure_ascii=False)
    
    @staticmethod
    def confirmation_required(action: str, data: Any, message: str) -> str:
        return json.dumps({
            "status": "confirmation_required",
            "action": action,
            "data": data,
            "message": message
        }, ensure_ascii=False)


class FuzzyMatcher:
    """Fuzzy matching utilities."""
    
    @staticmethod
    def match_clients(
        session: Session,
        search_query: str,
        clinic_id: Optional[int] = None,
        threshold: int = 85
    ) -> Dict[str, Any]:
        """
        Fuzzy match clients by name, phone, or national ID.
        """
        query = session.query(Client)
        if clinic_id:
            query = query.filter(Client.clinic_id == clinic_id)
        
        all_clients = query.all()
        
        if not search_query or not search_query.strip():
            return {
                "exact": [],
                "suggestions": [],
                "did_you_mean": None,
                "message": "חיפוש ריק"
            }
        
        search_lower = search_query.lower().strip()
        exact_matches = []
        
        # Check for exact matches first
        for client in all_clients:
            full_name = f"{client.first_name or ''} {client.last_name or ''}".strip()
            if (
                (client.first_name or "").lower() == search_lower or
                (client.last_name or "").lower() == search_lower or
                full_name.lower() == search_lower or
                (client.phone_mobile or "").find(search_query) != -1 or
                (client.national_id or "").find(search_query) != -1
            ):
                exact_matches.append({
                    "id": client.id,
                    "first_name": client.first_name,
                    "last_name": client.last_name,
                    "phone_mobile": client.phone_mobile,
                    "national_id": client.national_id
                })
        
        if exact_matches:
            return {
                "exact": exact_matches,
                "suggestions": [],
                "did_you_mean": None,
                "message": f"נמצאו {len(exact_matches)} תוצאות מדויקות"
            }
        
        # No exact matches - perform fuzzy search
        candidates = []
        for client in all_clients:
            full_name = f"{client.first_name or ''} {client.last_name or ''}".strip()
            if full_name:
                candidates.append((client, full_name))
        
        if not candidates:
            return {
                "exact": [],
                "suggestions": [],
                "did_you_mean": None,
                "message": "לא נמצאו מטופלים במערכת"
            }
        
        # Use rapidfuzz to find similar matches
        matches = process.extract(
            search_query,
            [name for _, name in candidates],
            scorer=fuzz.WRatio,
            limit=5
        )
        
        suggestions = []
        best_match = None
        
        for match_text, confidence, idx in matches:
            if confidence >= 60:
                client = candidates[idx][0]
                suggestion = {
                    "id": client.id,
                    "first_name": client.first_name,
                    "last_name": client.last_name,
                    "phone_mobile": client.phone_mobile,
                    "national_id": client.national_id,
                    "confidence": confidence,
                    "match_text": match_text
                }
                suggestions.append(suggestion)
                
                if confidence >= threshold and best_match is None:
                    best_match = match_text
        
        did_you_mean_msg = None
        if best_match:
            did_you_mean_msg = f"האם התכוונת ל: {best_match}?"
        elif suggestions:
            did_you_mean_msg = f"לא נמצא '{search_query}' במדויק. האם התכוונת לאחד מאלה?"
        
        return {
            "exact": [],
            "suggestions": suggestions,
            "did_you_mean": did_you_mean_msg,
            "message": f"לא נמצאו תוצאות מדויקות. נמצאו {len(suggestions)} הצעות"
        }


class BaseTool(ABC):
    """Base class for all AI tools."""
    
    def __init__(self, user: User):
        self.user = user
        # Security: Scope by clinic for non-CEO users, by company for CEO
        self.clinic_id = user.clinic_id if user.role_level < CEO_LEVEL else None
        self.company_id = user.company_id  # Always scope by company
    
    def _parse_action_and_kwargs(self, action_or_dict: Any, **kwargs) -> tuple[str, Dict[str, Any]]:
        if isinstance(action_or_dict, dict):
            values = dict(action_or_dict)
            action = values.pop("action", None)
            if not isinstance(action, str):
                raise ValueError("invalid action")
            return action, {**values, **kwargs}
        if not isinstance(action_or_dict, str):
            raise ValueError("invalid action")
        return action_or_dict, kwargs

    @abstractmethod
    def execute(self, action: str, **kwargs) -> str:
        """Execute the tool action. Must be implemented by subclasses."""
        pass
    
    def get_session(self) -> Session:
        """Get a new database session."""
        return SessionLocal()
    
    def apply_company_scope(self, query, model_class):
        """
        Apply company-level security scoping to queries.
        Always filter by company_id, and by clinic_id for non-CEO users.
        """
        # For models with clinic_id, join through Clinic to filter by company_id
        if hasattr(model_class, 'clinic_id'):
            # Check if Clinic is already joined (avoid duplicate joins)
            try:
                query = query.join(Clinic, model_class.clinic_id == Clinic.id)
            except Exception:
                # Join might already exist, try outerjoin or skip
                pass
            query = query.filter(Clinic.company_id == self.company_id)
            
            # Non-CEO users: also filter by clinic_id
            if self.clinic_id:
                query = query.filter(model_class.clinic_id == self.clinic_id)
        # For models with direct company_id field
        elif hasattr(model_class, 'company_id'):
            query = query.filter(model_class.company_id == self.company_id)
        else:
            # Model without clinic_id or company_id - log warning but don't fail
            logger.warning(f"Model {model_class.__name__} has no clinic_id or company_id field for scoping")
        
        return query
    
    def handle_error(self, error: Exception, context: str) -> str:
        """Standard error handling."""
        logger.warning("ai_tool_failed tool=%s code=ai.toolFailed", self.__class__.__name__)
        return ToolResponse.error("ai.toolFailed")
    
    def coerce_int(self, value: Any) -> int:
        """Coerce value to int with validation."""
        if isinstance(value, bool):
            raise ValueError("invalid integer value")
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            if value.is_integer():
                return int(value)
            raise ValueError("invalid integer value")
        if isinstance(value, str):
            return int(value)
        if isinstance(value, dict):
            for key in ("id", "client_id", "value"):
                if key in value:
                    return self.coerce_int(value[key])
        raise ValueError("invalid integer value")

