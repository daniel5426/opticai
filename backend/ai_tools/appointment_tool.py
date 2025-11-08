"""
Appointment operations tool.
"""
from typing import Any, List
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
import re

from models import Appointment, Client
from .base import BaseTool, ToolResponse, FuzzyMatcher


class AppointmentOperationsTool(BaseTool):
    """
    Unified appointment operations tool with bulk support.
    
    Actions:
    - list: List appointments with filters
    - search: Search appointments
    - get: Get single appointment
    - create: Create appointments (bulk support)
    - update: Update appointments (bulk support)
    - check_conflicts: Check scheduling conflicts
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
            elif action == "create":
                return self._create(session, **kwargs)
            elif action == "update":
                return self._update(session, **kwargs)
            elif action == "check_conflicts":
                return self._check_conflicts(session, **kwargs)
            else:
                return ToolResponse.error(f"פעולה לא נתמכת: {action}")
        except Exception as e:
            return self.handle_error(e, action)
        finally:
            session.close()
    
    def _parse_date(self, value: Any) -> date:
        """Parse date from various formats."""
        if isinstance(value, dict):
            for key in ("date", "value", "iso", "text"):
                if key in value:
                    return self._parse_date(value[key])
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, datetime):
            return value.date()
        if not isinstance(value, str) or not value.strip():
            raise ValueError("Invalid date")
        
        txt = value.strip()
        try:
            return datetime.fromisoformat(txt).date()
        except:
            pass
        
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(txt, fmt).date()
            except:
                continue
        
        raise ValueError(f"Could not parse date: {value}")
    
    def _list(self, session: Session, **kwargs) -> str:
        client_id = kwargs.get("client_id")
        user_id = kwargs.get("user_id")
        date_from = kwargs.get("date_from")
        date_to = kwargs.get("date_to")
        limit = kwargs.get("limit", 20)
        
        query = session.query(Appointment)
        query = self.apply_company_scope(query, Appointment)
        if client_id:
            try:
                query = query.filter(Appointment.client_id == self.coerce_int(client_id))
            except:
                return ToolResponse.error(f"client_id לא תקין: {client_id}")
        if user_id:
            try:
                query = query.filter(Appointment.user_id == self.coerce_int(user_id))
            except:
                return ToolResponse.error(f"user_id לא תקין: {user_id}")
        if date_from:
            try:
                query = query.filter(Appointment.date >= self._parse_date(date_from))
            except:
                pass
        if date_to:
            try:
                query = query.filter(Appointment.date <= self._parse_date(date_to))
            except:
                pass
        
        appointments = query.order_by(Appointment.date.desc(), Appointment.time.desc()).limit(limit).all()
        
        data = [{
            "id": a.id,
            "client_id": a.client_id,
            "date": a.date.isoformat() if a.date else None,
            "time": a.time,
            "exam_name": a.exam_name,
            "note": a.note
        } for a in appointments]
        
        return ToolResponse.success(data, message=f"נמצאו {len(data)} תורים")
    
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
        
        query = session.query(Appointment).filter(Appointment.client_id.in_(client_ids))
        query = self.apply_company_scope(query, Appointment)
        
        appointments = query.order_by(Appointment.date.desc()).limit(20).all()
        
        data = [{
            "id": a.id,
            "client_id": a.client_id,
            "date": a.date.isoformat() if a.date else None,
            "time": a.time,
            "exam_name": a.exam_name
        } for a in appointments]
        
        return ToolResponse.success(data, message=f"נמצאו {len(data)} תורים")
    
    def _get(self, session: Session, **kwargs) -> str:
        appointment_id = kwargs.get("appointment_id")
        if not appointment_id:
            return ToolResponse.error("חסר פרמטר appointment_id")
        
        try:
            appointment_id = self.coerce_int(appointment_id)
        except:
            return ToolResponse.error(f"appointment_id לא תקין: {appointment_id}")
        
        query = session.query(Appointment).filter(Appointment.id == appointment_id)
        query = self.apply_company_scope(query, Appointment)
        
        appointment = query.first()
        if not appointment:
            return ToolResponse.error(f"תור {appointment_id} לא נמצא")
        
        data = {
            "id": appointment.id,
            "client_id": appointment.client_id,
            "date": appointment.date.isoformat() if appointment.date else None,
            "time": appointment.time,
            "duration": appointment.duration,
            "exam_name": appointment.exam_name,
            "note": appointment.note
        }
        return ToolResponse.success(data, message="תור נמצא")
    
    def _create(self, session: Session, **kwargs) -> str:
        appointments_data = kwargs.get("appointments", [kwargs])
        if not isinstance(appointments_data, list):
            appointments_data = [appointments_data]
        
        if not appointments_data:
            return ToolResponse.error("חסרים נתוני תורים ליצירה")
        
        results = {"succeeded": [], "failed": [], "total": len(appointments_data)}
        
        for idx, appt_data in enumerate(appointments_data):
            try:
                client_id = appt_data.get("client_id")
                if not client_id:
                    raise ValueError("חסר client_id")
                
                client_id = self.coerce_int(client_id)
                client_query = session.query(Client).filter(Client.id == client_id)
                client_query = self.apply_company_scope(client_query, Client)
                client = client_query.first()
                if not client:
                    raise ValueError(f"מטופל {client_id} לא נמצא")
                
                appt_clinic_id = self.clinic_id or client.clinic_id
                if not appt_clinic_id:
                    raise ValueError("לא נמצא clinic_id")
                
                date_val = self._parse_date(appt_data.get("date"))
                time_val = str(appt_data.get("time", "10:00")).strip()
                
                appointment = Appointment(
                    client_id=client_id,
                    clinic_id=appt_clinic_id,
                    user_id=self.user.id,
                    date=date_val,
                    time=time_val,
                    exam_name=appt_data.get("exam_name"),
                    note=appt_data.get("note")
                )
                session.add(appointment)
                session.commit()
                session.refresh(appointment)
                
                # Update client timestamp
                client.client_updated_date = datetime.utcnow()
                client.ai_appointment_state = None
                session.commit()
                
                results["succeeded"].append({
                    "index": idx + 1,
                    "appointment_id": appointment.id,
                    "client_name": f"{client.first_name} {client.last_name}",
                    "date": date_val.isoformat(),
                    "time": time_val
                })
                
            except Exception as e:
                session.rollback()
                results["failed"].append({
                    "index": idx + 1,
                    "error": str(e),
                    "data": appt_data
                })
        
        success_count = len(results["succeeded"])
        fail_count = len(results["failed"])
        
        if success_count > 0 and fail_count == 0:
            message = f"נוצרו {success_count} תורים בהצלחה"
        elif success_count > 0:
            message = f"נוצרו {success_count} תורים, {fail_count} נכשלו"
        else:
            message = f"כל {fail_count} התורים נכשלו"
        
        return ToolResponse.success(results, message=message, progress={
            "succeeded": success_count,
            "failed": fail_count,
            "total": results["total"]
        })
    
    def _check_conflicts(self, session: Session, **kwargs) -> str:
        try:
            date_val = self._parse_date(kwargs.get("date"))
        except:
            return ToolResponse.error("תאריך לא תקין או חסר")
        
        time_val = kwargs.get("time")
        user_id = kwargs.get("user_id")
        
        if not time_val:
            return ToolResponse.error("חסרה שעה")
        
        query = session.query(Appointment).filter(
            Appointment.date == date_val,
            Appointment.time == time_val
        )
        query = self.apply_company_scope(query, Appointment)
        if user_id:
            try:
                query = query.filter(Appointment.user_id == self.coerce_int(user_id))
            except:
                pass
        
        conflicts = query.all()
        
        if conflicts:
            data = [{
                "id": a.id,
                "client_id": a.client_id,
                "time": a.time,
                "exam_name": a.exam_name
            } for a in conflicts]
            return ToolResponse.success(data, message=f"נמצאו {len(conflicts)} תורים מתנגשים")
        else:
            return ToolResponse.success([], message="אין תורים מתנגשים")
    
    def _update(self, session: Session, **kwargs) -> str:
        appointments_data = kwargs.get("appointments", [kwargs])
        if not isinstance(appointments_data, list):
            appointments_data = [appointments_data]
        
        results = {"succeeded": [], "failed": [], "total": len(appointments_data)}
        
        for idx, appt_data in enumerate(appointments_data):
            try:
                appointment_id = appt_data.get("appointment_id")
                if not appointment_id:
                    raise ValueError("חסר appointment_id")
                
                appointment_id = self.coerce_int(appointment_id)
                
                query = session.query(Appointment).filter(Appointment.id == appointment_id)
                query = self.apply_company_scope(query, Appointment)
                appointment = query.first()
                
                if not appointment:
                    raise ValueError(f"תור {appointment_id} לא נמצא")
                
                if "client_id" in appt_data:
                    client_id = self.coerce_int(appt_data["client_id"])
                    client_query = session.query(Client).filter(Client.id == client_id)
                    client_query = self.apply_company_scope(client_query, Client)
                    client = client_query.first()
                    if not client:
                        raise ValueError(f"מטופל {client_id} לא נמצא")
                    appointment.client_id = client_id
                
                if "date" in appt_data and appt_data["date"]:
                    appointment.date = self._parse_date(appt_data["date"])
                
                if "time" in appt_data:
                    appointment.time = str(appt_data["time"]).strip()
                
                if "duration" in appt_data:
                    try:
                        appointment.duration = int(appt_data["duration"])
                    except:
                        pass
                
                if "exam_name" in appt_data:
                    appointment.exam_name = appt_data["exam_name"]
                
                if "note" in appt_data:
                    appointment.note = appt_data["note"]
                
                session.commit()
                
                client = session.query(Client).filter(Client.id == appointment.client_id).first()
                if client:
                    client.client_updated_date = datetime.utcnow()
                    client.ai_appointment_state = None
                    session.commit()
                
                results["succeeded"].append({
                    "index": idx + 1,
                    "appointment_id": appointment.id,
                    "date": appointment.date.isoformat() if appointment.date else None,
                    "time": appointment.time
                })
                
            except Exception as e:
                session.rollback()
                results["failed"].append({
                    "index": idx + 1,
                    "error": str(e),
                    "data": appt_data
                })
        
        success_count = len(results["succeeded"])
        fail_count = len(results["failed"])
        
        if success_count > 0 and fail_count == 0:
            message = f"עודכנו {success_count} תורים בהצלחה"
        elif success_count > 0:
            message = f"עודכנו {success_count} תורים, {fail_count} נכשלו"
        else:
            message = f"כל {fail_count} התורים נכשלו"
        
        return ToolResponse.success(results, message=message, progress={
            "succeeded": success_count,
            "failed": fail_count,
            "total": results["total"]
        })

