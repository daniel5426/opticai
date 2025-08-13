from fastapi import APIRouter, Depends, HTTPException
import logging
import traceback
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import re
import httpx
import json

from database import get_db, SessionLocal
from auth import get_current_user
from models import (
    User, Client, Appointment, MedicalLog, OpticalExam, Order, Referral, File as FileModel
)
from config import settings

# LangChain / LangGraph
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.tools import Tool
from langgraph.prebuilt import create_react_agent
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/ai", tags=["ai"])

logger = logging.getLogger("uvicorn.error")

# Simple in-memory conversation per user
USER_MEMORY: Dict[int, List[Any]] = {}


@router.post("/initialize")
async def ai_initialize(current_user: User = Depends(get_current_user)):
    return {"success": True}


def _openai_chat(messages: List[Dict[str, Any]], *, temperature: float = 0.7) -> str:
    payload = {
        "model": "gpt-4o",
        "messages": messages,
        "temperature": temperature,
    }
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(f"{settings.OPENAI_BASE_URL}/chat/completions", json=payload, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail=f"LLM error: {resp.text}")
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return content or ""


def _system_prompt() -> str:
    return (
        "אתה עוזר חכם של מרפאת עיניים \"אופטיק AI\". אתה עוזר בעברית ומסייע בניהול המרפאה.\n\n"
        "חשוב: אתה מדבר עם צוות המרפאה (רופאים/טכנאים), לא עם מטופלים! הם מורשים לגשת לכל המידע במערכת.\n\n"
        "כללים חשובים:\n"
        "- תמיד ענה בעברית\n"
        "- היה קצר ובהיר\n"
        "- כשמבקשים מידע על מטופלים, תורים או בדיקות - השתמש בכלים שלך מיד ללא בקשה לזיהוי\n"
        "- המשתמש הוא צוות המרפאה ויש לו גישה לכל המידע\n"
        "- תן תשובות מועילות ומקצועות\n"
        "- כשמבקשים ליצור או להוסיף משהו, הצע לבצע את הפעולה\n\n"
        "אתה יכול לעזור עם:\n\n"
        "קריאת מידע:\n"
        "- מידע על מטופלים - השתמש ב-get_clients\n"
        "- מידע על תורים - השתמש ב-get_appointments  \n"
        "- מידע על בדיקות עיניים - השתמש ב-get_exams\n\n"
        "יצירת רשומות חדשות:\n"
        "- יצירת תור חדש - השתמש ב-create_appointment\n"
        "- הוספת רשומה רפואית - השתמש ב-create_medical_log\n\n"
        "כשמבקשים \"בדיקות שלי\" או \"התורים שלי\" - הבן זאת כ\"הבדיקות/התורים במרפאה\" ולא כבקשה אישית.\n\n"
        "אם המשתמש מבקש ליצור תור או להוסיף רשומה רפואית, אתה יכול לבצע את הפעולה. בקש את הפרטים הדרושים אם הם חסרים.\n\n"
        "אם המשתמש שואל שאלה כללית, ענה בצורה ידידותית ותציע איך אתה יכול לעזור."
    )


def _parse_date_flexible(value: Any) -> Optional[date]:
    if isinstance(value, dict):
        for key in ("date", "value", "iso", "text"):
            if key in value:
                return _parse_date_flexible(value[key])
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if not isinstance(value, str) or not value.strip():
        return None
    txt = value.strip()
    try:
        return datetime.fromisoformat(txt).date()
    except Exception:
        pass
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(txt, fmt).date()
        except Exception:
            continue
    try:
        months_he = {
            "ינואר": 1, "פברואר": 2, "מרץ": 3, "אפריל": 4,
            "מאי": 5, "יוני": 6, "יולי": 7, "אוגוסט": 8,
            "ספטמבר": 9, "אוקטובר": 10, "נובמבר": 11, "דצמבר": 12,
        }
        m = re.search(r"(\d{1,2})\s*ב?([א-ת]+)\s*(\d{4})", txt)
        if m:
            day = int(m.group(1))
            mon_name = m.group(2)
            year = int(m.group(3))
            mon = months_he.get(mon_name)
            if mon:
                return date(year, mon, day)
    except Exception:
        pass
    return None


def _coerce_int(value: Any) -> int:
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
                return _coerce_int(value[key])
    raise ValueError("invalid integer value")


def _coerce_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float)):
        return str(value)
    if isinstance(value, dict):
        for key in ("time", "value", "text"):
            if key in value:
                return _coerce_str(value[key])
    return str(value)


def _make_tools_for_user(user: User) -> List[Tool]:
    def get_clients_tool(search: str = "") -> str:
        session = SessionLocal()
        try:
            q = session.query(Client)
            if user.role != "company_ceo" and user.clinic_id:
                q = q.filter(Client.clinic_id == user.clinic_id)
            clients = q.all()
            if not search or search.strip() == "" or search.lower() == "all":
                data = [{"id": c.id, "first_name": c.first_name, "last_name": c.last_name, "phone_mobile": c.phone_mobile, "national_id": c.national_id} for c in clients][:20]
                return json.dumps(data, ensure_ascii=False)
            s = search.lower()
            filtered = [
                c for c in clients
                if (c.first_name or "").lower().find(s) != -1
                or (c.last_name or "").lower().find(s) != -1
                or (c.phone_mobile or "").find(search) != -1
                or (c.national_id or "").find(search) != -1
            ]
            data = [{"id": c.id, "first_name": c.first_name, "last_name": c.last_name, "phone_mobile": c.phone_mobile, "national_id": c.national_id} for c in filtered]
            return json.dumps(data, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": f"get_clients failed: {str(e)}"}, ensure_ascii=False)
        finally:
            session.close()

    def get_appointments_tool(filter: str = "recent") -> str:
        session = SessionLocal()
        try:
            q = session.query(Appointment)
            if user.role != "company_ceo" and user.clinic_id:
                q = q.filter(Appointment.clinic_id == user.clinic_id)
            appts = q.all()
            # Sort by date then time when available
            def sort_key(a: Appointment):
                d = a.date.isoformat() if hasattr(a.date, 'isoformat') and a.date else (a.date or "")
                t = a.time or ""
                return f"{d}T{t}"
            appts_sorted = sorted(appts, key=sort_key, reverse=True)
            data = [{
                "id": a.id,
                "client_id": a.client_id,
                "date": (a.date.isoformat() if hasattr(a.date, 'isoformat') and a.date else a.date),
                "time": a.time,
                "exam_name": a.exam_name
            } for a in appts_sorted[:10]]
            return json.dumps(data, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": f"get_appointments failed: {str(e)}"}, ensure_ascii=False)
        finally:
            session.close()

    def get_exams_tool(filter: str = "recent") -> str:
        session = SessionLocal()
        try:
            q = session.query(OpticalExam)
            if user.role != "company_ceo" and user.clinic_id:
                q = q.filter(OpticalExam.clinic_id == user.clinic_id)
            exams = q.all()
            exams_sorted = sorted(exams, key=lambda e: (e.exam_date or ""), reverse=True)
            data = [{"id": e.id, "client_id": e.client_id, "exam_date": e.exam_date} for e in exams_sorted[:10]]
            return json.dumps(data, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": f"get_exams failed: {str(e)}"}, ensure_ascii=False)
        finally:
            session.close()

    def create_appointment_tool(client_id: int, date: Optional[str] = None, time: Optional[str] = None, first_name: Optional[str] = None, last_name: Optional[str] = None, phone_mobile: Optional[str] = None, exam_name: Optional[str] = None, note: Optional[str] = None) -> str:
        session = SessionLocal()
        try:
            print("[AI] create_appointment_tool called:", client_id, date, time, exam_name)
            logger.info("AI create_appointment_tool called with args", extra={
                "client_id": client_id,
                "date": date,
                "time": time,
                "exam_name": exam_name,
                "user_id": user.id,
                "user_role": user.role,
                "user_clinic_id": user.clinic_id,
            })
            try:
                client_id = _coerce_int(client_id)  # type: ignore
            except Exception:
                raise ValueError("invalid client_id")
            if not user.clinic_id and user.role != "company_ceo":
                raise ValueError("Clinic context required")
            client = session.query(Client).filter(Client.id == client_id).first()
            if not client:
                raise ValueError(f"Client {client_id} not found")
            clinic_id = user.clinic_id or client.clinic_id
            if not date or not time:
                try:
                    latest_appt = (
                        session.query(Appointment)
                        .filter(Appointment.client_id == client_id)
                        .order_by(Appointment.date.desc(), Appointment.time.desc())
                        .first()
                    )
                except Exception:
                    latest_appt = None
                if latest_appt and latest_appt.date:
                    computed_date = latest_appt.date + timedelta(days=3)
                    computed_time = latest_appt.time or "10:00"
                    date = date or computed_date.isoformat()
                    time = time or computed_time
                    print("[AI] create_appointment_tool defaulted missing date/time from latest appointment:", date, time)
                else:
                    raise ValueError(f"date and time are required in format YYYY-MM-DD and HH:MM. got date={date!r}, time={time!r}")
            date_value = _parse_date_flexible(date)
            if not date_value:
                raise ValueError(f"invalid date format: {date}")
            time_value = _coerce_str(time).strip() or "10:00"
            print("[AI] create_appointment_tool parsed:", client_id, clinic_id, date_value, time_value)
            logger.info("AI create_appointment_tool parsed values", extra={
                "resolved_client_id": client_id,
                "resolved_clinic_id": clinic_id,
                "resolved_date": str(date_value),
                "resolved_time": time_value,
            })
            a = Appointment(
                client_id=client_id,
                clinic_id=clinic_id,
                user_id=user.id,
                date=date_value,
                time=time_value,
                exam_name=exam_name,
                note=note,
            )
            session.add(a)
            session.commit()
            session.refresh(a)
            print("[AI] create_appointment_tool created appointment id:", a.id)
            logger.info("AI create_appointment_tool created appointment", extra={
                "appointment_id": a.id
            })
            try:
                client.client_updated_date = datetime.utcnow()
                client.ai_appointment_state = None
                session.commit()
            except Exception:
                session.rollback()
            return json.dumps({"status": "ok", "appointment_id": a.id}, ensure_ascii=False)
        except Exception as e:
            print("[AI] create_appointment_tool error:", str(e))
            logger.error("create_appointment_tool error: %s\n%s", str(e), traceback.format_exc())
            return json.dumps({"error": f"create_appointment failed: {str(e)}"}, ensure_ascii=False)
        finally:
            session.close()

    def create_medical_log_tool(client_id: int, log: str, log_date: Optional[str] = None) -> str:
        session = SessionLocal()
        try:
            client = session.query(Client).filter(Client.id == client_id).first()
            if not client:
                raise ValueError(f"Client {client_id} not found")
            ml = MedicalLog(
                client_id=client_id,
                log_date=log_date or datetime.utcnow().date(),
                log=log,
            )
            session.add(ml)
            session.commit()
            session.refresh(ml)
            try:
                client.client_updated_date = datetime.utcnow()
                client.ai_medical_state = None
                session.commit()
            except Exception:
                session.rollback()
            return json.dumps({"status": "ok", "medical_log_id": ml.id}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": f"create_medical_log failed: {str(e)}"}, ensure_ascii=False)
        finally:
            session.close()

    return [
        Tool.from_function(func=get_clients_tool, name="get_clients", description="Get all clients or search clients by name, phone, or ID. Use this when user asks about patients/clients (מטופלים)."),
        Tool.from_function(func=get_appointments_tool, name="get_appointments", description="Get appointments for today or recent appointments."),
        Tool.from_function(func=get_exams_tool, name="get_exams", description="Get recent optical exams."),
        Tool.from_function(
            func=create_appointment_tool,
            name="create_appointment",
            description=(
                "Create a new appointment. Required params: client_id (int), date (YYYY-MM-DD), time (HH:MM). "
                "Optional: exam_name, note. Return an explicit error if date/time are missing."
            ),
        ),
        Tool.from_function(func=create_medical_log_tool, name="create_medical_log", description="Create a new medical log entry."),
    ]


@router.post("/chat")
async def ai_chat(
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    message: str = body.get("message", "")
    conversation_history: List[Dict[str, str]] = body.get("conversationHistory", [])
    chat_id: Optional[int] = body.get("chat_id")
    if not message:
        raise HTTPException(status_code=422, detail="message is required")

    # Build agent with tools bound to user context
    llm = ChatOpenAI(model="gpt-4o", api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL, temperature=0.7)
    tools = _make_tools_for_user(current_user)
    agent = create_react_agent(llm, tools)

    memory_key = f"u:{current_user.id}:c:{chat_id or 0}"
    history = USER_MEMORY.setdefault(memory_key, [])
    # Merge provided conversationHistory (from UI) into memory for continuity
    if conversation_history:
        # Only append if memory is empty to avoid duplication
        if not history:
            for m in conversation_history:
                role = m.get("role", "user")
                content = m.get("content", "")
                if not content:
                    continue
                history.append(HumanMessage(content=content) if role == "user" else AIMessage(content=content))

    messages = [SystemMessage(content=_system_prompt()), *history, HumanMessage(content=message)]
    result = agent.invoke({"messages": messages})
    final_messages: List[Any] = result.get("messages", []) if isinstance(result, dict) else result
    last = final_messages[-1] if final_messages else None
    final_text = last.content if last else ""

    # Update memory
    history.append(HumanMessage(content=message))
    if final_text:
        history.append(AIMessage(content=final_text))

    return {"success": True, "message": final_text}


@router.post("/chat/stream")
async def ai_chat_stream(
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    message: str = body.get("message", "")
    conversation_history: List[Dict[str, str]] = body.get("conversationHistory", [])
    chat_id: Optional[int] = body.get("chat_id")
    if not message:
        raise HTTPException(status_code=422, detail="message is required")

    llm = ChatOpenAI(model="gpt-4o", api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL, temperature=0.7)
    tools = _make_tools_for_user(current_user)
    agent = create_react_agent(llm, tools)

    memory_key = f"u:{current_user.id}:c:{chat_id or 0}"
    history = USER_MEMORY.setdefault(memory_key, [])
    if conversation_history and not history:
        for m in conversation_history:
            role = m.get("role", "user")
            content = m.get("content", "")
            if not content:
                continue
            history.append(HumanMessage(content=content) if role == "user" else AIMessage(content=content))

    async def event_stream():
        full = ""
        parts = []
        part_order = 0
        current_text_part_content = ""
        def append_text_part_if_any():
            nonlocal part_order, current_text_part_content, parts
            if current_text_part_content and current_text_part_content.strip():
                parts.append({
                    "type": "text",
                    "content": current_text_part_content,
                    "timestamp": part_order,
                })
                part_order += 1
                current_text_part_content = ""
        async for event in agent.astream_events(
            {"messages": [SystemMessage(content=_system_prompt()), *history, HumanMessage(content=message)]},
            version="v2",
        ):
            ev = event.get("event")
            # Stream tool lifecycle for UI
            if ev == "on_tool_start":
                try:
                    name = event.get("name")
                    args = event.get("data", {}).get("input")
                    # If no text was emitted yet for this answer, inject a short preface line so tool doesn't lead
                    has_any_text = any(p.get("type") == "text" for p in parts) or bool(current_text_part_content.strip())
                    if not has_any_text:
                        parts.append({
                            "type": "text",
                            "content": "בודק את המידע עבורך...",
                            "timestamp": part_order,
                        })
                        part_order += 1
                    else:
                        append_text_part_if_any()
                    
                    parts.append({
                        "type": "tool",
                        "content": f"מבצע: {name}...",
                        "toolName": name,
                        "toolPhase": "start",
                        "timestamp": part_order
                    })
                    part_order += 1
                    yield f"data: {json.dumps({'tool': {'phase': 'start', 'name': name, 'args': args}, 'parts': parts}, ensure_ascii=False)}\n\n"
                except Exception:
                    pass
                continue
            if ev == "on_tool_end":
                try:
                    name = event.get("name")
                    output = event.get("data", {}).get("output")
                    # Update the last tool part to show completion instead of adding new part
                    if parts and parts[-1]["type"] == "tool" and parts[-1]["toolName"] == name:
                        parts[-1]["content"] = f"הושלם: {name}"
                        parts[-1]["toolPhase"] = "end"
                    # Surface tool output for debugging when available
                    if output:
                        try:
                            parsed_output = output
                            if isinstance(output, str):
                                try:
                                    parsed_output = json.loads(output)
                                except Exception:
                                    parsed_output = output
                            if isinstance(parsed_output, dict) and parsed_output.get("error"):
                                append_text_part_if_any()
                                parts.append({
                                    "type": "text",
                                    "content": f"שגיאת כלי: {parsed_output.get('error')}",
                                    "timestamp": part_order,
                                })
                                part_order += 1
                            elif isinstance(parsed_output, str):
                                # Add a short snippet of raw output
                                snippet = parsed_output
                                if len(snippet) > 400:
                                    snippet = snippet[:400] + "…"
                                append_text_part_if_any()
                                parts.append({
                                    "type": "text",
                                    "content": f"פלט כלי: {snippet}",
                                    "timestamp": part_order,
                                })
                                part_order += 1
                        except Exception:
                            pass
                    yield f"data: {json.dumps({'tool': {'phase': 'end', 'name': name, 'output': output}, 'parts': parts}, ensure_ascii=False)}\n\n"
                except Exception:
                    pass
                continue
            if ev == "on_chat_model_stream":
                data = event.get("data", {})
                chunk = data.get("chunk")
                if chunk is not None:
                    text = getattr(chunk, "content", None)
                    if text:
                        # Only accumulate into current text if not in a pending tool start
                        full += text
                        current_text_part_content += text
                        yield f"data: {json.dumps({'chunk': text, 'fullMessage': full, 'currentTextPart': current_text_part_content}, ensure_ascii=False)}\n\n"
        
        # Finalize last text part
        append_text_part_if_any()
        
        yield f"data: {json.dumps({'message': full, 'parts': parts, 'done': True}, ensure_ascii=False)}\n\n"

        history.append(HumanMessage(content=message))
        if full:
            history.append(AIMessage(content=full))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/execute-action")
def ai_execute_action(
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    action: str = body.get("action", "")
    data: Dict[str, Any] = body.get("data", {})

    if action == "create_appointment":
        print("[AI] execute_action:create_appointment called with:", data)
        logger.info("AI execute_action:create_appointment called", extra={"data": data, "user_id": current_user.id, "role": current_user.role, "clinic_id": current_user.clinic_id})
        client_id = data.get("client_id")
        if not client_id:
            raise HTTPException(status_code=422, detail="client_id is required")
        try:
            client_id = _coerce_int(client_id)
        except Exception:
            raise HTTPException(status_code=422, detail="invalid client_id")
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            raise HTTPException(status_code=422, detail=f"Client {client_id} not found")

        clinic_id = data.get("clinic_id") or current_user.clinic_id or client.clinic_id
        if not clinic_id:
            raise HTTPException(status_code=403, detail="Clinic context required")

        date_value = _parse_date_flexible(data.get("date"))
        if not date_value:
            print("[AI] execute_action:create_appointment missing/invalid date", data.get("date"))
            raise HTTPException(status_code=422, detail="date is required in format YYYY-MM-DD")

        appointment = Appointment(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=current_user.id,
            date=date_value,
            time=_coerce_str(data.get("time")).strip(),
            exam_name=data.get("exam_name"),
            note=data.get("note"),
        )
        try:
            db.add(appointment)
            db.commit()
            db.refresh(appointment)
        except Exception as e:
            print("[AI] execute_action:create_appointment DB error:", str(e))
            logger.error("AI execute_action:create_appointment DB error: %s\n%s", str(e), traceback.format_exc())
            raise

        try:
            client.client_updated_date = datetime.utcnow()
            client.ai_appointment_state = None
            db.commit()
        except Exception as e:
            db.rollback()
            print("[AI] execute_action:create_appointment client update error:", str(e))
            logger.error("AI execute_action:create_appointment client update error: %s\n%s", str(e), traceback.format_exc())

        return {"success": True, "message": "תור נוצר בהצלחה!", "data": appointment}

    if action == "create_medical_log":
        client_id = data.get("client_id")
        if not client_id:
            raise HTTPException(status_code=422, detail="client_id is required")
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            raise HTTPException(status_code=422, detail=f"Client {client_id} not found")

        log = MedicalLog(
            client_id=client_id,
            log_date=data.get("log_date") or datetime.utcnow().date(),
            log=data.get("log", ""),
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        try:
            client.client_updated_date = datetime.utcnow()
            client.ai_medical_state = None
            db.commit()
        except Exception:
            db.rollback()

        return {"success": True, "message": "רשומה רפואית נוצרה בהצלחה!", "data": log}

    raise HTTPException(status_code=400, detail=f"Unsupported action: {action}")


def _to_serializable(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _sa_to_dict(obj: Any) -> Dict[str, Any]:
    return {c.name: _to_serializable(getattr(obj, c.name)) for c in obj.__table__.columns}


def _collect_all_client_data(db: Session, client_id: int) -> Dict[str, Any]:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    exams = db.query(OpticalExam).filter(OpticalExam.client_id == client_id).all()
    appointments = db.query(Appointment).filter(Appointment.client_id == client_id).all()
    orders = db.query(Order).filter(Order.client_id == client_id).all()
    referrals = db.query(Referral).filter(Referral.client_id == client_id).all()
    files = db.query(FileModel).filter(FileModel.client_id == client_id).all()
    medical_logs = db.query(MedicalLog).filter(MedicalLog.client_id == client_id).all()
    return {
        "client": _sa_to_dict(client),
        "exams": [_sa_to_dict(x) for x in exams],
        "appointments": [_sa_to_dict(x) for x in appointments],
        "orders": [_sa_to_dict(x) for x in orders],
        "referrals": [_sa_to_dict(x) for x in referrals],
        "files": [_sa_to_dict(x) for x in files],
        "medical_logs": [_sa_to_dict(x) for x in medical_logs],
    }


def _extract_section(text: str, name: str) -> str:
    pattern = re.compile(rf"\[{name}\]\s*([\s\S]*?)\s*\[/{name}\]", re.IGNORECASE)
    m = pattern.search(text or "")
    if not m:
        return "לא נמצאו נתונים רלוונטיים לתחום זה"
    content = (m.group(1) or "").strip()
    return content or "לא נמצאו נתונים רלוונטיים לתחום זה"


@router.post("/generate-all-states/{client_id}")
def generate_all_states(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = _collect_all_client_data(db, client_id)
    try:
        data_json = json.dumps(data, ensure_ascii=False, indent=2)
    except TypeError:
        # Fallback: aggressively normalize any stray date/datetime values
        def normalize(o: Any) -> Any:
            if isinstance(o, dict):
                return {k: normalize(v) for k, v in o.items()}
            if isinstance(o, list):
                return [normalize(v) for v in o]
            if isinstance(o, (datetime, date)):
                return o.isoformat()
            return o
        data_json = json.dumps(normalize(data), ensure_ascii=False, indent=2)
    prompt = f"""
# Medical Eye Care Expert AI Agent Prompt

You are a medical assistant specializing in ophthalmology. Analyze client information and prepare relevant data points for each system area.

## Key Principles:

### 1. **Cross-Domain Distribution**: 
Information must appear in ALL relevant domains, regardless of source:
- Medical allergies → MEDICAL + EXAM (relevant for procedures)
- Diabetes → MEDICAL + EXAM + REFERRAL (affects vision, needs monitoring)
- Eye surgery history → FILE + EXAM + MEDICAL

### 2. **Domain Functions**:
- **EXAM**: Eye examinations, prescriptions, medical conditions affecting vision
- **ORDER**: Glasses/lens orders, prescriptions, technical details
- **REFERRAL**: Specialist referrals, urgent symptoms, follow-up needs
- **CONTACT_LENS**: Lens fitting, allergies to solutions, complications
- **APPOINTMENT**: Past/future appointments, required monitoring
- **FILE**: Documents, images, test results, reports
- **MEDICAL**: Medical history, medications, allergies, conditions

### 3. **Smart Diagnostics**: 
Add diagnostic suggestions when patterns emerge:
🔍 חשד: Brief explanation based on symptom combinations

## Client Information:
{data_json}

## Instructions:
- Provide 3-7 factual data points per relevant domain
- Include information in ALL domains where it's relevant
- Write ONLY factual information, NOT recommendations
- Always answer in Hebrew
- Skip domains with no relevant information

## Required Response Format:

[EXAM]
• First point
• Second point
• Third point

🔍 חשד: Diagnostic suggestion (if relevant)
[/EXAM]

[ORDER]
• First point
• Second point
• Third point
[/ORDER]

[REFERRAL]
• First point
• Second point
• Third point

🔍 חשד: Referral suggestion (if relevant)
[/REFERRAL]

[CONTACT_LENS]
• First point
• Second point
• Third point
[/CONTACT_LENS]

[APPOINTMENT]
• First point
• Second point
• Third point

🔍 חשד: Future examination recommendation (if relevant)
[/APPOINTMENT]

[FILE]
• First point
• Second point
• Third point
[/FILE]

[MEDICAL]
• First point
• Second point
• Third point

🔍 חשד: Pattern-based diagnostic suggestion (if relevant)
[/MEDICAL]

**Important**: Use exactly this format with the precise tags! If there's no relevant information for a domain, do not include its tags.
"""
    try:
        content = _openai_chat([
            {"role": "system", "content": "אתה עוזר רפואי מומחה לעיניים. ענה בעברית בלבד."},
            {"role": "user", "content": prompt},
        ])
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {str(e)}")

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.ai_exam_state = _extract_section(content, "EXAM")
    client.ai_order_state = _extract_section(content, "ORDER")
    client.ai_referral_state = _extract_section(content, "REFERRAL")
    client.ai_contact_lens_state = _extract_section(content, "CONTACT_LENS")
    client.ai_appointment_state = _extract_section(content, "APPOINTMENT")
    client.ai_file_state = _extract_section(content, "FILE")
    client.ai_medical_state = _extract_section(content, "MEDICAL")
    client.ai_updated_date = datetime.utcnow()
    db.commit()

    return {"success": True}


@router.post("/generate-part-state/{client_id}/{part}")
def generate_part_state(
    client_id: int,
    part: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = _collect_all_client_data(db, client_id)
    descriptions = {
        "exam": "דף בדיקות עיניים - מציג את כל בדיקות הראייה, המרשמים, התוצאות והמלצות",
        "order": "דף הזמנות - מציג הזמנות משקפיים, עדשות, מסגרות וכל הפרטים הטכניים",
        "referral": "דף הפניות - מציג הפניות לרופאי עיניים, מומחים ובתי חולים",
        "contact_lens": "דף עדשות מגע - מציג התאמות עדשות מגע, בדיקות, הזמנות וטיפול",
        "appointment": "דף תורים - מציג תורים קודמים ועתידיים, סוגי בדיקות ומעקב",
        "file": "דף קבצים - מציג קבצים, תמונות, מסמכים ותוצאות בדיקות שצורפו",
        "medical": "דף רפואי - מציג היסטוריה רפואית, תרופות, אלרגיות ובעיות רפואיות",
    }
    desc = descriptions.get(part, "דף לא מוכר")
    data_json = json.dumps(data, ensure_ascii=False, indent=2)
    user_prompt = f"""
אתה עוזר רפואי מומחה לעיניים. קיבלת מידע מקיף על לקוח במרפאה, וכעת אתה צריך לספק מידע רלוונטי ספציפי ל{desc}.
        
חשוב: השב בעברית בלבד!
        
המידע על הלקוח:
{data_json}
        
בהתבסס על המידע, אנא הכן רשימה קצרה של 3-5 נקודות מידע חשובות ורלוונטיות עבור {desc}.
        
הנקודות צריכות להיות:
- קצרות וברורות (1-2 שורות לכל נקודה)
- ספציפיות לתחום הזה
- מועילות לצוות הרפואי
- מסודרות לפי חשיבות
        
פורמט התשובה:
• נקודה ראשונה
• נקודה שנייה
• נקודה שלישית
וכו'
        
אם אין מידע רלוונטי לתחום הזה, אל תציג נקודות לא רלוונטיות. במקום זאת, ציין בדיוק: "לא נמצאו נתונים רלוונטיים לתחום זה".
"""
    content = _openai_chat([
        {"role": "system", "content": "אתה עוזר רפואי מומחה לעיניים. ענה בעברית בלבד."},
        {"role": "user", "content": user_prompt},
    ])

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    field_name = f"ai_{part}_state"
    if not hasattr(client, field_name):
        raise HTTPException(status_code=400, detail=f"Invalid part: {part}")
    setattr(client, field_name, content)
    client.ai_updated_date = datetime.utcnow()
    db.commit()
    return {"success": True}


@router.post("/create-campaign-from-prompt")
def create_campaign_from_prompt(body: Dict[str, Any], current_user: User = Depends(get_current_user)):
    prompt: str = body.get("prompt", "").strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="prompt is required")

    FILTER_FIELDS = {
        'first_name': { 'label': 'שם פרטי', 'type': 'text', 'category': 'מידע אישי' },
        'last_name': { 'label': 'שם משפחה', 'type': 'text', 'category': 'מידע אישי' },
        'gender': { 'label': 'מין', 'type': 'select', 'options': ['זכר', 'נקבה'], 'category': 'מידע אישי' },
        'age': { 'label': 'גיל', 'type': 'number', 'category': 'מידע אישי' },
        'date_of_birth': { 'label': 'תאריך לידה', 'type': 'date', 'category': 'מידע אישי' },
        'national_id': { 'label': 'תעודת זהות', 'type': 'text', 'category': 'מידע אישי' },
        'health_fund': { 'label': 'קופת חולים', 'type': 'select', 'options': ['כללית', 'מכבי', 'לאומית', 'מאוחדת'], 'category': 'מידע אישי' },
        'phone_mobile': { 'label': 'טלפון נייד', 'type': 'text', 'category': 'פרטי התקשרות' },
        'email': { 'label': 'דואר אלקטרוני', 'type': 'text', 'category': 'פרטי התקשרות' },
        'address_city': { 'label': 'עיר', 'type': 'text', 'category': 'פרטי התקשרות' },
        'has_family': { 'label': 'יש משפחה', 'type': 'boolean', 'category': 'משפחה' },
        'family_role': { 'label': 'תפקיד במשפחה', 'type': 'select', 'options': ['אב', 'אם', 'בן', 'בת', 'אח', 'אחות'], 'category': 'משפחה' },
        'status': { 'label': 'סטטוס', 'type': 'select', 'options': ['פעיל', 'לא פעיל', 'חסום'], 'category': 'סטטוס' },
        'blocked_checks': { 'label': "חסום לצ'קים", 'type': 'boolean', 'category': 'סטטוס' },
        'blocked_credit': { 'label': 'חסום לאשראי', 'type': 'boolean', 'category': 'סטטוס' },
        'discount_percent': { 'label': 'אחוז הנחה', 'type': 'number', 'category': 'סטטוס' },
        'file_creation_date': { 'label': 'תאריך יצירת תיק', 'type': 'date', 'category': 'תאריכים' },
        'membership_end': { 'label': 'תאריך סיום חברות', 'type': 'date', 'category': 'תאריכים' },
        'service_end': { 'label': 'תאריך סיום שירות', 'type': 'date', 'category': 'תאריכים' },
        'last_exam_days': { 'label': 'ימים מאז בדיקה אחרונה', 'type': 'number', 'category': 'פעילות' },
        'last_order_days': { 'label': 'ימים מאז הזמנה אחרונה', 'type': 'number', 'category': 'פעילות' },
        'last_appointment_days': { 'label': 'ימים מאז תור אחרון', 'type': 'number', 'category': 'פעילות' },
        'has_appointments': { 'label': 'יש תורים', 'type': 'boolean', 'category': 'פעילות' },
        'has_exams': { 'label': 'יש בדיקות', 'type': 'boolean', 'category': 'פעילות' },
        'has_orders': { 'label': 'יש הזמנות', 'type': 'boolean', 'category': 'פעילות' },
        'total_orders': { 'label': 'סך הזמנות', 'type': 'number', 'category': 'פעילות' },
        'total_exams': { 'label': 'סך בדיקות', 'type': 'number', 'category': 'פעילות' },
    }
    OPERATORS = {
        'text': [
            { 'value': 'contains', 'label': 'מכיל' },
            { 'value': 'not_contains', 'label': 'לא מכיל' },
            { 'value': 'equals', 'label': 'שווה ל' },
            { 'value': 'not_equals', 'label': 'לא שווה ל' },
            { 'value': 'starts_with', 'label': 'מתחיל ב' },
            { 'value': 'ends_with', 'label': 'מסתיים ב' },
            { 'value': 'is_empty', 'label': 'ריק' },
            { 'value': 'is_not_empty', 'label': 'לא ריק' },
        ],
        'number': [
            { 'value': 'equals', 'label': 'שווה ל' },
            { 'value': 'not_equals', 'label': 'לא שווה ל' },
            { 'value': 'greater_than', 'label': 'גדול מ' },
            { 'value': 'less_than', 'label': 'קטן מ' },
            { 'value': 'greater_equal', 'label': 'גדול או שווה ל' },
            { 'value': 'less_equal', 'label': 'קטן או שווה ל' },
            { 'value': 'is_empty', 'label': 'ריק' },
            { 'value': 'is_not_empty', 'label': 'לא ריק' },
        ],
        'date': [
            { 'value': 'equals', 'label': 'שווה ל' },
            { 'value': 'not_equals', 'label': 'לא שווה ל' },
            { 'value': 'after', 'label': 'אחרי' },
            { 'value': 'before', 'label': 'לפני' },
            { 'value': 'last_days', 'label': 'ב X ימים האחרונים' },
            { 'value': 'next_days', 'label': 'ב X ימים הבאים' },
            { 'value': 'is_empty', 'label': 'ריק' },
            { 'value': 'is_not_empty', 'label': 'לא ריק' },
        ],
        'boolean': [
            { 'value': 'equals', 'label': 'שווה ל' },
            { 'value': 'not_equals', 'label': 'לא שווה ל' },
        ],
        'select': [
            { 'value': 'equals', 'label': 'שווה ל' },
            { 'value': 'not_equals', 'label': 'לא שווה ל' },
        ],
    }

    structured_prompt = (
        "You are an intelligent assistant for an eye clinic. The user will describe a marketing campaign or customer reminder. Create a campaign object based on their request.\n\n"
        f"Available Filters:\n{json.dumps(FILTER_FIELDS, ensure_ascii=False, indent=2)}\n\n"
        f"Available Operators:\n{json.dumps(OPERATORS, ensure_ascii=False, indent=2)}\n\n"
        "The user will describe the campaign in Hebrew. Adapt all fields as required by the description.\n\n"
        f"Campaign Description:\n{prompt}\n"
    )

    content = _openai_chat([
        {"role": "system", "content": "You are a structured output generator. Return a valid JSON object only."},
        {"role": "user", "content": structured_prompt},
    ], temperature=0.7)

    # Best-effort JSON parse
    candidate = content.strip()
    start = candidate.find('{')
    end = candidate.rfind('}')
    if start != -1 and end != -1:
        candidate = candidate[start:end+1]
    try:
        data = json.loads(candidate)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse LLM JSON output")

    # minimal normalization
    if isinstance(data.get("filters"), list):
        for f in data["filters"]:
            if "logic" in f and f["logic"] not in ("AND", "OR", None):
                f["logic"] = "AND"

    return {"success": True, "data": data}


