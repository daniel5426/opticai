"""
Medical log operations tool.
"""
from typing import Any
from datetime import datetime, date
from sqlalchemy.orm import Session

from models import MedicalLog, Client
from .base import BaseTool, ToolResponse


class MedicalLogOperationsTool(BaseTool):
    """
    Medical log operations tool with bulk support.
    
    Actions:
    - list: List medical logs
    - get: Get single medical log
    - get_by_client: Get all logs for a client
    - create: Create medical logs (bulk support)
    - update: Update medical logs (bulk support)
    """
    
    def execute(self, action: Any, **kwargs) -> str:
        """Execute with flexible action parameter parsing."""
        # Parse action from dict if needed (LangChain may pass all params as dict)
        action, kwargs = self._parse_action_and_kwargs(action, **kwargs)
        
        session = self.get_session()
        try:
            if action == "list":
                return self._list(session, **kwargs)
            elif action == "get":
                return self._get(session, **kwargs)
            elif action == "get_by_client":
                return self._get_by_client(session, **kwargs)
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
    
    def _parse_date(self, value) -> date:
        """Parse date from various formats."""
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.strip()).date()
            except:
                pass
        raise ValueError(f"Invalid date: {value}")
    
    def _list(self, session: Session, **kwargs) -> str:
        client_id = kwargs.get("client_id")
        limit = kwargs.get("limit", 20)
        
        query = session.query(MedicalLog)
        query = self.apply_company_scope(query, MedicalLog)
        if client_id:
            try:
                query = query.filter(MedicalLog.client_id == self.coerce_int(client_id))
            except:
                return ToolResponse.error(f"client_id לא תקין: {client_id}")
        
        logs = query.order_by(MedicalLog.log_date.desc()).limit(limit).all()
        
        data = [{
            "id": log.id,
            "client_id": log.client_id,
            "log_date": log.log_date.isoformat() if log.log_date else None,
            "log": log.log[:200] if log.log else ""
        } for log in logs]
        
        return ToolResponse.success(data, message=f"נמצאו {len(data)} רשומות רפואיות")
    
    def _get(self, session: Session, **kwargs) -> str:
        log_id = kwargs.get("log_id")
        if not log_id:
            return ToolResponse.error("חסר פרמטר log_id")
        
        try:
            log_id = self.coerce_int(log_id)
        except:
            return ToolResponse.error(f"log_id לא תקין: {log_id}")
        
        query = session.query(MedicalLog).filter(MedicalLog.id == log_id)
        query = self.apply_company_scope(query, MedicalLog)
        
        log = query.first()
        if not log:
            return ToolResponse.error(f"רשומה {log_id} לא נמצאה")
        
        data = {
            "id": log.id,
            "client_id": log.client_id,
            "log_date": log.log_date.isoformat() if log.log_date else None,
            "log": log.log
        }
        return ToolResponse.success(data, message="רשומה רפואית נמצאה")
    
    def _get_by_client(self, session: Session, **kwargs) -> str:
        client_id = kwargs.get("client_id")
        if not client_id:
            return ToolResponse.error("חסר פרמטר client_id")
        
        try:
            client_id = self.coerce_int(client_id)
        except:
            return ToolResponse.error(f"client_id לא תקין: {client_id}")
        
        query = session.query(MedicalLog).filter(MedicalLog.client_id == client_id)
        query = self.apply_company_scope(query, MedicalLog)
        
        logs = query.order_by(MedicalLog.log_date.desc()).all()
        
        data = [{
            "id": log.id,
            "log_date": log.log_date.isoformat() if log.log_date else None,
            "log": log.log
        } for log in logs]
        
        return ToolResponse.success(data, message=f"נמצאו {len(data)} רשומות למטופל")
    
    def _create(self, session: Session, **kwargs) -> str:
        logs_data = kwargs.get("logs", [kwargs])
        if not isinstance(logs_data, list):
            logs_data = [logs_data]
        
        results = {"succeeded": [], "failed": [], "total": len(logs_data)}
        
        for idx, log_data in enumerate(logs_data):
            try:
                client_id = log_data.get("client_id")
                log_text = log_data.get("log")
                
                if not client_id or not log_text:
                    raise ValueError("חסרים client_id או log")
                
                client_id = self.coerce_int(client_id)
                client_query = session.query(Client).filter(Client.id == client_id)
                client_query = self.apply_company_scope(client_query, Client)
                client = client_query.first()
                if not client:
                    raise ValueError(f"מטופל {client_id} לא נמצא")
                
                try:
                    log_date = self._parse_date(log_data.get("log_date"))
                except:
                    log_date = datetime.utcnow().date()
                
                medical_log = MedicalLog(
                    client_id=client_id,
                    clinic_id=self.clinic_id or client.clinic_id,
                    user_id=self.user.id,
                    log_date=log_date,
                    log=log_text
                )
                session.add(medical_log)
                session.commit()
                session.refresh(medical_log)
                
                client.client_updated_date = datetime.utcnow()
                client.ai_medical_state = None
                session.commit()
                
                results["succeeded"].append({
                    "index": idx + 1,
                    "log_id": medical_log.id,
                    "client_name": f"{client.first_name} {client.last_name}"
                })
                
            except Exception as e:
                session.rollback()
                results["failed"].append({
                    "index": idx + 1,
                    "error": str(e),
                    "data": log_data
                })
        
        success_count = len(results["succeeded"])
        fail_count = len(results["failed"])
        
        if success_count > 0 and fail_count == 0:
            message = f"נוצרו {success_count} רשומות רפואיות בהצלחה"
        elif success_count > 0:
            message = f"נוצרו {success_count} רשומות, {fail_count} נכשלו"
        else:
            message = f"כל {fail_count} הרשומות נכשלו"
        
        return ToolResponse.success(results, message=message)
    
    def _update(self, session: Session, **kwargs) -> str:
        logs_data = kwargs.get("logs", [kwargs])
        if not isinstance(logs_data, list):
            logs_data = [logs_data]
        
        results = {"succeeded": [], "failed": [], "total": len(logs_data)}
        
        for idx, log_data in enumerate(logs_data):
            try:
                log_id = log_data.get("log_id")
                if not log_id:
                    raise ValueError("חסר log_id")
                
                log_id = self.coerce_int(log_id)
                
                query = session.query(MedicalLog).filter(MedicalLog.id == log_id)
                query = self.apply_company_scope(query, MedicalLog)
                medical_log = query.first()
                
                if not medical_log:
                    raise ValueError(f"רשומה {log_id} לא נמצאה")
                
                if "log" in log_data:
                    medical_log.log = log_data["log"]
                
                if "log_date" in log_data and log_data["log_date"]:
                    try:
                        medical_log.log_date = self._parse_date(log_data["log_date"])
                    except:
                        pass
                
                session.commit()
                
                client = session.query(Client).filter(Client.id == medical_log.client_id).first()
                if client:
                    client.client_updated_date = datetime.utcnow()
                    client.ai_medical_state = None
                    session.commit()
                
                results["succeeded"].append({
                    "index": idx + 1,
                    "log_id": medical_log.id
                })
                
            except Exception as e:
                session.rollback()
                results["failed"].append({
                    "index": idx + 1,
                    "error": str(e),
                    "data": log_data
                })
        
        success_count = len(results["succeeded"])
        fail_count = len(results["failed"])
        
        if success_count > 0 and fail_count == 0:
            message = f"עודכנו {success_count} רשומות רפואיות בהצלחה"
        elif success_count > 0:
            message = f"עודכנו {success_count} רשומות, {fail_count} נכשלו"
        else:
            message = f"כל {fail_count} הרשומות נכשלו"
        
        return ToolResponse.success(results, message=message, progress={
            "succeeded": success_count,
            "failed": fail_count,
            "total": results["total"]
        })

