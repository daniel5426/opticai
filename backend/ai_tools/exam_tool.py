"""
Exam operations tool.
"""
from typing import Any
from datetime import datetime, date
from sqlalchemy.orm import Session

from models import OpticalExam, Client
from .base import BaseTool, ToolResponse


class ExamOperationsTool(BaseTool):
    """
    Unified exam operations tool.
    
    Actions:
    - list: List exams with filters
    - search: Search exams by client name
    - get: Get single exam
    - get_latest: Get client's latest exam
    - create: Create new exams (bulk support)
    - update: Update existing exams (bulk support)
    """
    
    def execute(self, action: Any, **kwargs) -> str:
        """Execute with flexible action parameter parsing."""
        # Parse action from dict if needed (LangChain may pass all params as dict)
        action, kwargs = self._parse_action_and_kwargs(action, **kwargs)
        
        session = self.get_session()
        try:
            if action == "list":
                return self._list(session, **kwargs)
            elif action == "search":
                return self._search(session, **kwargs)
            elif action == "get":
                return self._get(session, **kwargs)
            elif action == "get_latest":
                return self._get_latest(session, **kwargs)
            elif action == "create":
                return self._create(session, **kwargs)
            elif action == "update":
                return self._update(session, **kwargs)
            else:
                return ToolResponse.error(f"פעולה לא נתמכת: {action}")
        except Exception as e:
            return self.handle_error(e, action)
        finally:
            session.close()
    
    def _list(self, session: Session, **kwargs) -> str:
        client_id = kwargs.get("client_id")
        exam_type = kwargs.get("type", kwargs.get("exam_type"))
        limit = kwargs.get("limit", 20)
        
        query = session.query(OpticalExam)
        query = self.apply_company_scope(query, OpticalExam)
        if client_id:
            try:
                query = query.filter(OpticalExam.client_id == self.coerce_int(client_id))
            except:
                return ToolResponse.error(f"client_id לא תקין: {client_id}")
        if exam_type:
            query = query.filter(OpticalExam.type == exam_type)
        
        exams = query.order_by(OpticalExam.exam_date.desc()).limit(limit).all()
        
        data = [{
            "id": e.id,
            "client_id": e.client_id,
            "exam_date": e.exam_date.isoformat() if e.exam_date else None,
            "test_name": e.test_name,
            "type": e.type,
            "dominant_eye": e.dominant_eye
        } for e in exams]
        
        return ToolResponse.success(data, message=f"נמצאו {len(data)} בדיקות")
    
    def _search(self, session: Session, **kwargs) -> str:
        search_query = kwargs.get("search", kwargs.get("query", ""))
        if not search_query:
            return ToolResponse.error("חסר פרמטר חיפוש")
        
        # Company-scoped client search
        from ai_tools.client_tool import ClientOperationsTool
        client_tool = ClientOperationsTool(self.user)
        client_result = client_tool._fuzzy_match_clients_scoped(session, search_query)
        client_ids = []
        
        if client_result["exact"]:
            client_ids = [c["id"] for c in client_result["exact"]]
        elif client_result["suggestions"]:
            client_ids = [c["id"] for c in client_result["suggestions"][:3]]
        
        if not client_ids:
            return ToolResponse.error(f"לא נמצאו מטופלים התואמים: {search_query}")
        
        query = session.query(OpticalExam).filter(OpticalExam.client_id.in_(client_ids))
        query = self.apply_company_scope(query, OpticalExam)
        
        exams = query.order_by(OpticalExam.exam_date.desc()).limit(20).all()
        
        data = [{
            "id": e.id,
            "client_id": e.client_id,
            "exam_date": e.exam_date.isoformat() if e.exam_date else None,
            "test_name": e.test_name,
            "type": e.type
        } for e in exams]
        
        return ToolResponse.success(data, message=f"נמצאו {len(data)} בדיקות")
    
    def _get(self, session: Session, **kwargs) -> str:
        exam_id = kwargs.get("exam_id")
        if not exam_id:
            return ToolResponse.error("חסר פרמטר exam_id")
        
        try:
            exam_id = self.coerce_int(exam_id)
        except:
            return ToolResponse.error(f"exam_id לא תקין: {exam_id}")
        
        query = session.query(OpticalExam).filter(OpticalExam.id == exam_id)
        query = self.apply_company_scope(query, OpticalExam)
        
        exam = query.first()
        if not exam:
            return ToolResponse.error(f"בדיקה {exam_id} לא נמצאה")
        
        data = {
            "id": exam.id,
            "client_id": exam.client_id,
            "exam_date": exam.exam_date.isoformat() if exam.exam_date else None,
            "test_name": exam.test_name,
            "type": exam.type,
            "dominant_eye": exam.dominant_eye
        }
        return ToolResponse.success(data, message="בדיקה נמצאה")
    
    def _get_latest(self, session: Session, **kwargs) -> str:
        client_id = kwargs.get("client_id")
        if not client_id:
            return ToolResponse.error("חסר פרמטר client_id")
        
        try:
            client_id = self.coerce_int(client_id)
        except:
            return ToolResponse.error(f"client_id לא תקין: {client_id}")
        
        query = session.query(OpticalExam).filter(OpticalExam.client_id == client_id)
        query = self.apply_company_scope(query, OpticalExam)
        
        exam = query.order_by(OpticalExam.exam_date.desc()).first()
        if not exam:
            return ToolResponse.error(f"לא נמצאו בדיקות למטופל {client_id}")
        
        data = {
            "id": exam.id,
            "client_id": exam.client_id,
            "exam_date": exam.exam_date.isoformat() if exam.exam_date else None,
            "test_name": exam.test_name,
            "type": exam.type,
            "dominant_eye": exam.dominant_eye
        }
        return ToolResponse.success(data, message="בדיקה אחרונה נמצאה")
    
    def _parse_date(self, value: Any) -> date:
        """Parse date from various formats."""
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str) and value.strip():
            try:
                return datetime.fromisoformat(value.strip()).date()
            except:
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                    try:
                        return datetime.strptime(value.strip(), fmt).date()
                    except:
                        continue
        raise ValueError(f"Invalid date: {value}")
    
    def _create(self, session: Session, **kwargs) -> str:
        exams_data = kwargs.get("exams", [kwargs])
        if not isinstance(exams_data, list):
            exams_data = [exams_data]
        
        results = {"succeeded": [], "failed": [], "total": len(exams_data)}
        
        for idx, exam_data in enumerate(exams_data):
            try:
                client_id = exam_data.get("client_id")
                if not client_id:
                    raise ValueError("חסר client_id")
                
                client_id = self.coerce_int(client_id)
                client_query = session.query(Client).filter(Client.id == client_id)
                client_query = self.apply_company_scope(client_query, Client)
                client = client_query.first()
                if not client:
                    raise ValueError(f"מטופל {client_id} לא נמצא")
                
                exam_clinic_id = self.clinic_id or client.clinic_id
                if not exam_clinic_id:
                    raise ValueError("לא נמצא clinic_id")
                
                exam_date = None
                if exam_data.get("exam_date"):
                    try:
                        exam_date = self._parse_date(exam_data.get("exam_date"))
                    except:
                        exam_date = datetime.utcnow().date()
                else:
                    exam_date = datetime.utcnow().date()
                
                exam = OpticalExam(
                    client_id=client_id,
                    clinic_id=exam_clinic_id,
                    user_id=self.user.id,
                    exam_date=exam_date,
                    test_name=exam_data.get("test_name"),
                    dominant_eye=exam_data.get("dominant_eye"),
                    type=exam_data.get("type", "exam")
                )
                session.add(exam)
                session.commit()
                session.refresh(exam)
                
                client.client_updated_date = datetime.utcnow()
                client.ai_exam_state = None
                session.commit()
                
                results["succeeded"].append({
                    "index": idx + 1,
                    "exam_id": exam.id,
                    "client_name": f"{client.first_name} {client.last_name}",
                    "exam_date": exam_date.isoformat()
                })
                
            except Exception as e:
                session.rollback()
                results["failed"].append({
                    "index": idx + 1,
                    "error": str(e),
                    "data": exam_data
                })
        
        success_count = len(results["succeeded"])
        fail_count = len(results["failed"])
        
        if success_count > 0 and fail_count == 0:
            message = f"נוצרו {success_count} בדיקות בהצלחה"
        elif success_count > 0:
            message = f"נוצרו {success_count} בדיקות, {fail_count} נכשלו"
        else:
            message = f"כל {fail_count} הבדיקות נכשלו"
        
        return ToolResponse.success(results, message=message, progress={
            "succeeded": success_count,
            "failed": fail_count,
            "total": results["total"]
        })
    
    def _update(self, session: Session, **kwargs) -> str:
        exams_data = kwargs.get("exams", [kwargs])
        if not isinstance(exams_data, list):
            exams_data = [exams_data]
        
        results = {"succeeded": [], "failed": [], "total": len(exams_data)}
        
        for idx, exam_data in enumerate(exams_data):
            try:
                exam_id = exam_data.get("exam_id")
                if not exam_id:
                    raise ValueError("חסר exam_id")
                
                exam_id = self.coerce_int(exam_id)
                
                query = session.query(OpticalExam).filter(OpticalExam.id == exam_id)
                query = self.apply_company_scope(query, OpticalExam)
                exam = query.first()
                
                if not exam:
                    raise ValueError(f"בדיקה {exam_id} לא נמצאה")
                
                if "exam_date" in exam_data and exam_data["exam_date"]:
                    try:
                        exam.exam_date = self._parse_date(exam_data["exam_date"])
                    except:
                        pass
                
                if "test_name" in exam_data:
                    exam.test_name = exam_data["test_name"]
                
                if "dominant_eye" in exam_data:
                    exam.dominant_eye = exam_data["dominant_eye"]
                
                if "type" in exam_data:
                    exam.type = exam_data["type"]
                
                session.commit()
                
                client = session.query(Client).filter(Client.id == exam.client_id).first()
                if client:
                    client.client_updated_date = datetime.utcnow()
                    client.ai_exam_state = None
                    session.commit()
                
                results["succeeded"].append({
                    "index": idx + 1,
                    "exam_id": exam.id,
                    "exam_date": exam.exam_date.isoformat() if exam.exam_date else None
                })
                
            except Exception as e:
                session.rollback()
                results["failed"].append({
                    "index": idx + 1,
                    "error": str(e),
                    "data": exam_data
                })
        
        success_count = len(results["succeeded"])
        fail_count = len(results["failed"])
        
        if success_count > 0 and fail_count == 0:
            message = f"עודכנו {success_count} בדיקות בהצלחה"
        elif success_count > 0:
            message = f"עודכנו {success_count} בדיקות, {fail_count} נכשלו"
        else:
            message = f"כל {fail_count} הבדיקות נכשלו"
        
        return ToolResponse.success(results, message=message, progress={
            "succeeded": success_count,
            "failed": fail_count,
            "total": results["total"]
        })

