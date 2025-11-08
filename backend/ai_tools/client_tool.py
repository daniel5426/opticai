"""
Client operations tool.
"""
import traceback
from typing import Any
from datetime import datetime, date
from sqlalchemy.orm import Session

from models import Client, OpticalExam, Order, Appointment
from .base import BaseTool, ToolResponse


class ClientOperationsTool(BaseTool):
    """
    Unified client operations tool with fuzzy search and bulk support.
    
    Actions:
    - search: Fuzzy search by name/phone/national_id
    - get: Get single client by ID
    - get_summary: Get client with latest exam/order/appointment counts
    - list_recent: List recently updated clients
    - create: Create new clients (bulk support)
    - update: Update existing clients (bulk support)
    """
    
    def execute(self, action: Any, **kwargs) -> str:
        """Execute with flexible action parameter parsing."""
        from .base import logger
        logger.info(f"ClientOperationsTool.execute called with action={action}, kwargs={kwargs}")
        
        action, kwargs = self._parse_action_and_kwargs(action, **kwargs)
        logger.info(f"After parsing: action={action}, kwargs={kwargs}")
        
        session = self.get_session()
        try:
            if action == "search":
                logger.info(f"Executing search with kwargs: {kwargs}")
                result = self._search(session, **kwargs)
                logger.info(f"Search result: {str(result)[:200]}")
                return result
            elif action == "get":
                return self._get(session, **kwargs)
            elif action == "get_summary":
                return self._get_summary(session, **kwargs)
            elif action == "list_recent":
                return self._list_recent(session, **kwargs)
            elif action == "create":
                return self._create(session, **kwargs)
            elif action == "update":
                return self._update(session, **kwargs)
            else:
                error_msg = f"פעולה לא נתמכת: {action}. השתמש ב: search, get, get_summary, list_recent, create, update"
                logger.error(f"Unsupported action: {action}")
                return ToolResponse.error(error_msg)
        except Exception as e:
            logger.error(f"Exception in execute: {e}\n{traceback.format_exc()}")
            return self.handle_error(e, action)
        finally:
            session.close()
    
    def _search(self, session: Session, **kwargs) -> str:
        search_query = kwargs.get("search", kwargs.get("query", kwargs.get("name", "")))
        if not search_query:
            return ToolResponse.error("חסר פרמטר חיפוש (search)")
        
        # Use company-scoped fuzzy matcher
        result = self._fuzzy_match_clients_scoped(session, search_query)
        
        if result["exact"]:
            return ToolResponse.success(result["exact"], message=result["message"])
        elif result["suggestions"]:
            return ToolResponse.success(
                result["suggestions"],
                message=result.get("did_you_mean") or result["message"]
            )
        else:
            return ToolResponse.error(result["message"], suggestions=[])
    
    def _get(self, session: Session, **kwargs) -> str:
        client_id = kwargs.get("client_id")
        if not client_id:
            return ToolResponse.error("חסר פרמטר client_id")
        
        try:
            client_id = self.coerce_int(client_id)
        except:
            return ToolResponse.error(f"client_id לא תקין: {client_id}")
        
        query = session.query(Client).filter(Client.id == client_id)
        if self.clinic_id:
            query = query.filter(Client.clinic_id == self.clinic_id)
        
        client = query.first()
        if not client:
            return ToolResponse.error(f"מטופל {client_id} לא נמצא")
        
        data = {
            "id": client.id,
            "first_name": client.first_name,
            "last_name": client.last_name,
            "gender": client.gender,
            "date_of_birth": client.date_of_birth.isoformat() if client.date_of_birth else None,
            "phone_mobile": client.phone_mobile,
            "phone_home": client.phone_home,
            "email": client.email,
            "national_id": client.national_id,
            "health_fund": client.health_fund,
            "address_city": client.address_city,
            "address_street": client.address_street,
            "family_id": client.family_id,
            "family_role": client.family_role
        }
        return ToolResponse.success(data, message=f"נמצא מטופל: {client.first_name} {client.last_name}")
    
    def _get_summary(self, session: Session, **kwargs) -> str:
        client_id = kwargs.get("client_id")
        if not client_id:
            return ToolResponse.error("חסר פרמטר client_id")
        
        try:
            client_id = self.coerce_int(client_id)
        except:
            return ToolResponse.error(f"client_id לא תקין: {client_id}")
        
        query = session.query(Client).filter(Client.id == client_id)
        query = self.apply_company_scope(query, Client)
        
        client = query.first()
        if not client:
            return ToolResponse.error(f"מטופל {client_id} לא נמצא")
        
        # Count related records (scoped to company)
        exams_query = session.query(OpticalExam).filter(OpticalExam.client_id == client_id)
        exams_query = self.apply_company_scope(exams_query, OpticalExam)
        exams_count = exams_query.count()
        
        orders_query = session.query(Order).filter(Order.client_id == client_id)
        orders_query = self.apply_company_scope(orders_query, Order)
        orders_count = orders_query.count()
        
        appointments_query = session.query(Appointment).filter(Appointment.client_id == client_id)
        appointments_query = self.apply_company_scope(appointments_query, Appointment)
        appointments_count = appointments_query.count()
        
        # Get latest exam (scoped)
        latest_exam_query = session.query(OpticalExam).filter(OpticalExam.client_id == client_id)
        latest_exam_query = self.apply_company_scope(latest_exam_query, OpticalExam)
        latest_exam = latest_exam_query.order_by(OpticalExam.exam_date.desc()).first()
        
        data = {
            "id": client.id,
            "first_name": client.first_name,
            "last_name": client.last_name,
            "phone_mobile": client.phone_mobile,
            "email": client.email,
            "exams_count": exams_count,
            "orders_count": orders_count,
            "appointments_count": appointments_count,
            "latest_exam_date": latest_exam.exam_date.isoformat() if latest_exam and latest_exam.exam_date else None
        }
        return ToolResponse.success(data, message=f"סיכום עבור {client.first_name} {client.last_name}")
    
    def _list_recent(self, session: Session, **kwargs) -> str:
        limit = kwargs.get("limit", 10)
        try:
            limit = int(limit)
        except:
            limit = 10
        
        query = session.query(Client)
        query = self.apply_company_scope(query, Client)
        clients = query.order_by(Client.client_updated_date.desc()).limit(limit).all()
        
        data = [{
            "id": c.id,
            "first_name": c.first_name,
            "last_name": c.last_name,
            "phone_mobile": c.phone_mobile,
            "last_updated": c.client_updated_date.isoformat() if c.client_updated_date else None
        } for c in clients]
        
        return ToolResponse.success(data, message=f"נמצאו {len(data)} מטופלים אחרונים")
    
    def _fuzzy_match_clients_scoped(self, session: Session, search_query: str) -> dict:
        """Company-scoped fuzzy client matching."""
        from rapidfuzz import process, fuzz
        
        query = session.query(Client)
        query = self.apply_company_scope(query, Client)
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
                
                if confidence >= 85 and best_match is None:
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
        clients_data = kwargs.get("clients", [kwargs])
        if not isinstance(clients_data, list):
            clients_data = [clients_data]
        
        results = {"succeeded": [], "failed": [], "total": len(clients_data)}
        
        for idx, client_data in enumerate(clients_data):
            try:
                first_name = client_data.get("first_name")
                last_name = client_data.get("last_name")
                
                if not first_name or not last_name:
                    raise ValueError("חסרים שם פרטי ושם משפחה")
                
                clinic_id = self.clinic_id
                if not clinic_id:
                    clinic_id_param = client_data.get("clinic_id")
                    if clinic_id_param:
                        clinic_id = self.coerce_int(clinic_id_param)
                
                if not clinic_id:
                    raise ValueError("לא נמצא clinic_id")
                
                date_of_birth = None
                if client_data.get("date_of_birth"):
                    try:
                        date_of_birth = self._parse_date(client_data.get("date_of_birth"))
                    except:
                        pass
                
                client = Client(
                    clinic_id=clinic_id,
                    first_name=first_name,
                    last_name=last_name,
                    gender=client_data.get("gender"),
                    national_id=client_data.get("national_id"),
                    date_of_birth=date_of_birth,
                    health_fund=client_data.get("health_fund"),
                    address_city=client_data.get("address_city"),
                    address_street=client_data.get("address_street"),
                    address_number=client_data.get("address_number"),
                    postal_code=client_data.get("postal_code"),
                    phone_home=client_data.get("phone_home"),
                    phone_work=client_data.get("phone_work"),
                    phone_mobile=client_data.get("phone_mobile"),
                    fax=client_data.get("fax"),
                    email=client_data.get("email"),
                    occupation=client_data.get("occupation"),
                    notes=client_data.get("notes"),
                    client_updated_date=datetime.utcnow()
                )
                session.add(client)
                session.commit()
                session.refresh(client)
                
                results["succeeded"].append({
                    "index": idx + 1,
                    "client_id": client.id,
                    "name": f"{client.first_name} {client.last_name}"
                })
                
            except Exception as e:
                session.rollback()
                results["failed"].append({
                    "index": idx + 1,
                    "error": str(e),
                    "data": client_data
                })
        
        success_count = len(results["succeeded"])
        fail_count = len(results["failed"])
        
        if success_count > 0 and fail_count == 0:
            message = f"נוצרו {success_count} מטופלים בהצלחה"
        elif success_count > 0:
            message = f"נוצרו {success_count} מטופלים, {fail_count} נכשלו"
        else:
            message = f"כל {fail_count} המטופלים נכשלו"
        
        return ToolResponse.success(results, message=message, progress={
            "succeeded": success_count,
            "failed": fail_count,
            "total": results["total"]
        })
    
    def _update(self, session: Session, **kwargs) -> str:
        from datetime import datetime
        
        clients_data = kwargs.get("clients", [kwargs])
        if not isinstance(clients_data, list):
            clients_data = [clients_data]
        
        results = {"succeeded": [], "failed": [], "total": len(clients_data)}
        
        for idx, client_data in enumerate(clients_data):
            try:
                client_id = client_data.get("client_id")
                if not client_id:
                    raise ValueError("חסר client_id")
                
                client_id = self.coerce_int(client_id)
                
                query = session.query(Client).filter(Client.id == client_id)
                query = self.apply_company_scope(query, Client)
                client = query.first()
                
                if not client:
                    raise ValueError(f"מטופל {client_id} לא נמצא")
                
                if "first_name" in client_data:
                    client.first_name = client_data["first_name"]
                if "last_name" in client_data:
                    client.last_name = client_data["last_name"]
                if "gender" in client_data:
                    client.gender = client_data["gender"]
                if "national_id" in client_data:
                    client.national_id = client_data["national_id"]
                if "date_of_birth" in client_data and client_data["date_of_birth"]:
                    try:
                        client.date_of_birth = self._parse_date(client_data["date_of_birth"])
                    except:
                        pass
                if "health_fund" in client_data:
                    client.health_fund = client_data["health_fund"]
                if "address_city" in client_data:
                    client.address_city = client_data["address_city"]
                if "address_street" in client_data:
                    client.address_street = client_data["address_street"]
                if "address_number" in client_data:
                    client.address_number = client_data["address_number"]
                if "postal_code" in client_data:
                    client.postal_code = client_data["postal_code"]
                if "phone_home" in client_data:
                    client.phone_home = client_data["phone_home"]
                if "phone_work" in client_data:
                    client.phone_work = client_data["phone_work"]
                if "phone_mobile" in client_data:
                    client.phone_mobile = client_data["phone_mobile"]
                if "fax" in client_data:
                    client.fax = client_data["fax"]
                if "email" in client_data:
                    client.email = client_data["email"]
                if "occupation" in client_data:
                    client.occupation = client_data["occupation"]
                if "notes" in client_data:
                    client.notes = client_data["notes"]
                
                client.client_updated_date = datetime.utcnow()
                session.commit()
                
                results["succeeded"].append({
                    "index": idx + 1,
                    "client_id": client.id,
                    "name": f"{client.first_name} {client.last_name}"
                })
                
            except Exception as e:
                session.rollback()
                results["failed"].append({
                    "index": idx + 1,
                    "error": str(e),
                    "data": client_data
                })
        
        success_count = len(results["succeeded"])
        fail_count = len(results["failed"])
        
        if success_count > 0 and fail_count == 0:
            message = f"עודכנו {success_count} מטופלים בהצלחה"
        elif success_count > 0:
            message = f"עודכנו {success_count} מטופלים, {fail_count} נכשלו"
        else:
            message = f"כל {fail_count} המטופלים נכשלו"
        
        return ToolResponse.success(results, message=message, progress={
            "succeeded": success_count,
            "failed": fail_count,
            "total": results["total"]
        })

