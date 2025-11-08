"""
AI Assistant API endpoints using OOP tool architecture.
"""
from fastapi import APIRouter, Depends, HTTPException
import logging
import traceback
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
import httpx
import json

from database import get_db
from auth import get_current_user
from models import User, Client
from config import settings

# LangChain / LangGraph
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.tools import Tool, StructuredTool
from langgraph.prebuilt import create_react_agent
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal

# AI Tools
from ai_tools import (
    ClientOperationsTool,
    AppointmentOperationsTool,
    ExamOperationsTool,
    MedicalLogOperationsTool
)
from ai_tools.base import ToolResponse

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger("uvicorn.error")

# Simple in-memory conversation per user
USER_MEMORY: Dict[int, List[Any]] = {}


def _count_items(value: Any) -> int:
    if isinstance(value, list):
        return sum(1 for item in value if isinstance(item, dict))
    if isinstance(value, dict):
        return 1
    return 0


def _format_tool_action_text(name: Optional[str], args: Any) -> str:
    data = args if isinstance(args, dict) else {}
    action = data.get("action")
    if name == "client_operations":
        if action == "search":
            query = data.get("search")
            return f'מחפש מטופלים עבור "{query}"' if query else "מחפש מטופלים"
        if action == "get":
            client_id = data.get("client_id")
            return f'טוען פרטי מטופל #{client_id}' if client_id else "טוען פרטי מטופל"
        if action == "get_summary":
            client_id = data.get("client_id")
            return f'טוען סיכום למטופל #{client_id}' if client_id else "טוען סיכום מטופל"
        if action == "list_recent":
            limit = data.get("limit")
            return f'מציג {limit} מטופלים אחרונים' if limit else "מציג מטופלים אחרונים"
        if action == "create":
            count = _count_items(data.get("payload"))
            if count > 1:
                return f'יוצר {count} מטופלים חדשים'
            return "יוצר מטופל חדש"
        if action == "update":
            count = _count_items(data.get("payload"))
            if count > 1:
                return f'מעדכן {count} מטופלים'
            return "מעדכן מטופל"
    if name == "appointment_operations":
        if action == "list":
            parts = []
            client_id = data.get("client_id")
            user_id = data.get("user_id")
            date_value = data.get("date")
            if client_id:
                parts.append(f'למטופל #{client_id}')
            if user_id:
                parts.append(f'למשתמש #{user_id}')
            if date_value:
                parts.append(f'לתאריך {date_value}')
            suffix = " ".join(parts)
            return f'מציג תורים {suffix}'.strip() if suffix else "מציג תורים"
        if action == "search":
            query = data.get("search")
            return f'מחפש תורים עבור "{query}"' if query else "מחפש תורים"
        if action == "get":
            appointment_id = data.get("appointment_id")
            return f'טוען תור #{appointment_id}' if appointment_id else "טוען תור"
        if action == "create":
            count = _count_items(data.get("payload"))
            if count > 1:
                return f'יוצר {count} תורים חדשים'
            return "יוצר תור חדש"
        if action == "update":
            count = _count_items(data.get("payload"))
            if count > 1:
                return f'מעדכן {count} תורים'
            return "מעדכן תור"
        if action == "check_conflicts":
            return "בודק התנגשויות בתורים"
    if name == "exam_operations":
        if action == "list":
            parts = []
            client_id = data.get("client_id")
            exam_type = data.get("type")
            if client_id:
                parts.append(f'למטופל #{client_id}')
            if exam_type:
                parts.append(f'מסוג {exam_type}')
            suffix = " ".join(parts)
            return f'מציג בדיקות {suffix}'.strip() if suffix else "מציג בדיקות"
        if action == "search":
            query = data.get("search")
            return f'מחפש בדיקות עבור "{query}"' if query else "מחפש בדיקות"
        if action == "get":
            exam_id = data.get("exam_id")
            return f'טוען בדיקה #{exam_id}' if exam_id else "טוען בדיקה"
        if action == "get_latest":
            client_id = data.get("client_id")
            return f'טוען בדיקה אחרונה למטופל #{client_id}' if client_id else "טוען בדיקה אחרונה"
        if action == "create":
            count = _count_items(data.get("payload"))
            if count > 1:
                return f'יוצר {count} בדיקות חדשות'
            return "יוצר בדיקה חדשה"
        if action == "update":
            count = _count_items(data.get("payload"))
            if count > 1:
                return f'מעדכן {count} בדיקות'
            return "מעדכן בדיקה"
    if name == "medical_log_operations":
        if action == "list":
            return "מציג רשומות רפואיות"
        if action == "get":
            log_id = data.get("log_id")
            return f'טוען רשומה רפואית #{log_id}' if log_id else "טוען רשומה רפואית"
        if action == "get_by_client":
            client_id = data.get("client_id")
            return f'מציג רשומות רפואיות למטופל #{client_id}' if client_id else "מציג רשומות רפואיות למטופל"
        if action == "create":
            count = _count_items(data.get("payload"))
            if count > 1:
                return f'יוצר {count} רשומות רפואיות חדשות'
            return "יוצר רשומה רפואית חדשה"
        if action == "update":
            count = _count_items(data.get("payload"))
            if count > 1:
                return f'מעדכן {count} רשומות רפואיות'
            return "מעדכן רשומה רפואית"
    if action:
        readable_action = action.replace("_", " ")
        return f'מבצע {readable_action} בכלי {name}'
    return f'מבצע פעולה בכלי {name}'

def _system_prompt(user: User) -> str:
    """System prompt with tool descriptions."""
    display_name = user.full_name or user.username or "משתמש"
    user_info = (
        f"שם המשתמש: {display_name}\n"
        f"מזהה משתמש: {user.id}\n"
        f"תאריך נוכחי: {date.today().isoformat()}\n\n"
    )

    return (
        "אתה עוזר חכם של מרפאת עיניים \"אופטיק AI\". אתה עוזר בעברית ומסייע בניהול המרפאה.\n\n"
        "חשוב: אתה מדבר עם צוות המרפאה (רופאים/טכנאים), לא עם מטופלים! הם מורשים לגשת לכל המידע במערכת.\n\n"
        "כללים חשובים:\n"
        "- תמיד ענה בעברית\n"
        "- היה קצר ובהיר\n"
        "- כשמבקשים מידע על מטופלים, תורים או בדיקות - השתמש בכלים שלך מיד\n"
        "- המשתמש הוא צוות המרפאה ויש לו גישה לכל המידע\n"
        "- תן תשובות מועילות ומקצועות\n"
        "- כשמבקשים ליצור או להוסיף משהו, הצע לבצע את הפעולה\n\n"
        "הכלים שלך:\n\n"
        "1. client_operations - ניהול מטופלים:\n"
        "   - search: חיפוש מטופל (תומך בחיפוש מטושטש, יציע התאמות אם אין תוצאה מדויקת)\n"
        "   - get: פרטי מטופל לפי ID\n"
        "   - get_summary: סיכום מטופל עם ספירת בדיקות/תורים/הזמנות\n"
        "   - list_recent: רשימת מטופלים אחרונים\n"
        "   - create: יצירת מטופלים חדשים (תומך ביצירה מרובה)\n"
        "   - update: עדכון פרטי מטופל קיים (תומך בעדכון מרובה)\n"
        "   - payload: עבור create/update השתמש ב-payload=dict או payload=[dict] עם כל השדות הרלוונטיים. לדוגמה: {'first_name': 'שלומי', 'phone_mobile': '050...'}\n"
        "   שדות מטופל זמינים (לדוגמה): first_name, last_name, gender, national_id, date_of_birth, health_fund, address_city, address_street, address_number, postal_code, phone_home, phone_work, phone_mobile, fax, email, service_center, occupation, status, notes, family_id, family_role, price_list, discount_percent, blocked_checks, blocked_credit, ai_*_state. ניתן להעביר כל עמודה מטבלת clients.\n\n"
        "2. appointment_operations - ניהול תורים:\n"
        "   - list: רשימת תורים עם סינון (לפי תאריך, מטופל, משתמש)\n"
        "   - search: חיפוש תורים לפי שם מטופל\n"
        "   - get: פרטי תור לפי ID\n"
        "   - create: יצירת תורים (תומך ביצירה מרובה)\n"
        "   - update: עדכון תורים (תומך בעדכון מרובה)\n"
        "   - check_conflicts: בדיקת התנגשויות בתורים\n"
        "   - payload: עבור create/update השתמש ב-payload=dict או payload=[dict] עם שדות התור (client_id, date, time, וכו').\n"
        "   שדות תור: client_id, clinic_id, user_id, date, time, duration, exam_name, note, google_calendar_event_id. ניתן להעביר כל עמודה מטבלת appointments.\n\n"
        "3. exam_operations - ניהול בדיקות:\n"
        "   - list: רשימת בדיקות עם סינון\n"
        "   - search: חיפוש בדיקות לפי שם מטופל\n"
        "   - get: פרטי בדיקה\n"
        "   - get_latest: בדיקה אחרונה של מטופל\n"
        "   - create: יצירת בדיקות חדשות (תומך ביצירה מרובה)\n"
        "   - update: עדכון בדיקות קיימות (תומך בעדכון מרובה)\n"
        "   - payload: עבור create/update השתמש ב-payload=dict או payload=[dict] עם שדות הבדיקה (client_id, exam_date, וכו').\n"
        "   שדות בדיקה: client_id, clinic_id, user_id, exam_date, test_name, dominant_eye, type, clinic, exam_data. ניתן להעביר כל עמודה מטבלת optical_exams.\n\n"
        "4. medical_log_operations - ניהול רשומות רפואיות:\n"
        "   - list: רשימת רשומות רפואיות\n"
        "   - get: רשומה ספציפית\n"
        "   - get_by_client: כל הרשומות של מטופל\n"
        "   - create: יצירת רשומות (תומך ביצירה מרובה)\n"
        "   - update: עדכון רשומות קיימות (תומך בעדכון מרובה)\n"
        "   - payload: עבור create/update השתמש ב-payload=dict או payload=[dict] עם שדות הרשומה (client_id, log_date, log).\n"
        "   שדות רשומה: client_id, clinic_id, user_id, log_date, log. ניתן להעביר כל עמודה מטבלת medical_logs.\n\n"
        "פעולות מרובות (Bulk Operations):\n"
        "- כשמבקשים ליצור מספר פריטים (למשל: \"תקבע תור לכל המטופלים בשם דוד\"), השתמש בפעולות מרובות\n"
        "- חפש קודם את המטופלים, ואז צור תורים לכל אחד\n"
        "- הכלי ידווח על התקדמות: כמה הצליחו, כמה נכשלו\n\n"
        "חיפוש מטושטש:\n"
        "- אם לא נמצאה התאמה מדויקת, הכלי יציע אפשרויות דומות\n"
        "- הצג למשתמש את ההצעות ובקש הבהרה\n\n"
        "כשמבקשים \"בדיקות שלי\" או \"התורים שלי\" - הבן זאת כ\"הבדיקות/התורים במרפאה\".\n\n"
        "אם המשתמש שואל שאלה כללית, ענה בצורה ידידותית ותציע איך אתה יכול לעזור."
        "המשתמש שאתה מדבר איתו הוא: " + user_info + "\n"
    )


def _make_tools_for_user(user: User) -> List[Tool]:
    """Create tool instances for the given user."""
    
    client_tool = ClientOperationsTool(user)
    appointment_tool = AppointmentOperationsTool(user)
    exam_tool = ExamOperationsTool(user)
    medical_log_tool = MedicalLogOperationsTool(user)
    
    class ClientOperationsInput(BaseModel):
        action: Literal["search", "get", "get_summary", "list_recent", "create", "update"] = Field(
            description="Action to perform: 'search' to find clients, 'get' to get client details, 'get_summary' for summary with counts, 'list_recent' for recent clients, 'create' to create new clients, 'update' to update existing clients"
        )
        search: Optional[str] = Field(None, description="Search query for client name, phone, or ID (required for 'search' action)")
        client_id: Optional[int] = Field(None, description="Client ID (required for 'get', 'get_summary', and 'update' actions)")
        limit: Optional[int] = Field(None, description="Number of results to return (for 'list_recent' action; ברירת מחדל 10)")
        payload: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = Field(
            None,
            description="Data for create/update actions. Provide dict or list of dicts with client columns (לדוגמה: {'first_name': 'שלומי'})."
        )
        
        class Config:
            extra = "allow"
    
    class AppointmentOperationsInput(BaseModel):
        action: Literal["list", "search", "get", "create", "update", "check_conflicts"] = Field(
            description="Action: 'list' for appointments list, 'search' by client name, 'get' single appointment, 'create' new appointment(s), 'update' to update appointments, 'check_conflicts' for scheduling conflicts"
        )
        search: Optional[str] = Field(None, description="Client name to search for (required for 'search' action)")
        appointment_id: Optional[int] = Field(None, description="Appointment ID (required for 'get' and 'update' actions)")
        payload: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = Field(
            None,
            description="Data for create/update actions. Provide dict or list of dicts with appointment columns."
        )
        
        class Config:
            extra = "allow"
    
    class ExamOperationsInput(BaseModel):
        action: Literal["list", "search", "get", "get_latest", "create", "update"] = Field(
            description="Action: 'list' for exams list, 'search' by client name, 'get' single exam, 'get_latest' for client's most recent exam, 'create' to create new exams, 'update' to update exams"
        )
        search: Optional[str] = Field(None, description="Client name to search for (required for 'search' action)")
        exam_id: Optional[int] = Field(None, description="Exam ID (required for 'get' and 'update' actions)")
        client_id: Optional[int] = Field(None, description="Client ID (required for 'get_latest' and 'create' actions, optional for 'list')")
        payload: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = Field(
            None,
            description="Data for create/update actions. Provide dict or list of dicts with exam columns."
        )
        
        class Config:
            extra = "allow"
    
    class MedicalLogOperationsInput(BaseModel):
        action: Literal["list", "get", "get_by_client", "create", "update"] = Field(
            description="Action: 'list' all logs, 'get' single log, 'get_by_client' for client's logs, 'create' new log(s), 'update' to update logs"
        )
        log_id: Optional[int] = Field(None, description="Log ID (required for 'get' and 'update' actions)")
        client_id: Optional[int] = Field(None, description="Client ID (required for 'get_by_client' and 'create' actions)")
        payload: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = Field(
            None,
            description="Data for create/update actions. Provide dict or list of dicts with medical log columns."
        )

        class Config:
            extra = "allow"

    def _merge_payload(params: Dict[str, Any], list_key: str) -> None:
        payload = params.pop("payload", None)
        if payload is None:
            return

        items: List[Dict[str, Any]] = []
        if isinstance(payload, list):
            items.extend([i for i in payload if isinstance(i, dict)])
        elif isinstance(payload, dict):
            items.append(payload)
        else:
            logger.warning(f"Unsupported payload type for {list_key}: {type(payload).__name__}")
            return

        existing = params.get(list_key)
        if isinstance(existing, list):
            existing.extend(items)
            params[list_key] = existing
        elif existing is None:
            params[list_key] = items
        else:
            params[list_key] = items

    def _apply_defaults_to_items(params: Dict[str, Any], list_key: str, defaults: Dict[str, Any]) -> None:
        items = params.get(list_key)
        if not isinstance(items, list):
            return
        for item in items:
            if not isinstance(item, dict):
                continue
            for key, value in defaults.items():
                if value is not None and key not in item:
                    item[key] = value

    def client_operations_tool(action: str, **kwargs) -> str:
        params = {k: v for k, v in kwargs.items() if v is not None}
        _merge_payload(params, "clients")
        if action in {"create", "update"}:
            _apply_defaults_to_items(params, "clients", {"client_id": params.get("client_id")})
        logger.info(f"client_operations_tool: action={action}, kwargs={params}")
        try:
            return client_tool.execute(action, **params)
        except Exception as e:
            logger.error(f"client_operations error: {e}\n{traceback.format_exc()}")
            return ToolResponse.error(f"שגיאה: {str(e)}")

    def appointment_operations_tool(action: str, **kwargs) -> str:
        params = {k: v for k, v in kwargs.items() if v is not None}
        _merge_payload(params, "appointments")
        if action in {"create", "update"}:
            defaults = {"appointment_id": params.get("appointment_id"), "client_id": params.get("client_id")}
            _apply_defaults_to_items(params, "appointments", defaults)
        logger.info(f"appointment_operations_tool: action={action}, kwargs={params}")
        try:
            return appointment_tool.execute(action, **params)
        except Exception as e:
            logger.error(f"appointment_operations error: {e}\n{traceback.format_exc()}")
            return ToolResponse.error(f"שגיאה: {str(e)}")

    def exam_operations_tool(action: str, **kwargs) -> str:
        params = {k: v for k, v in kwargs.items() if v is not None}
        _merge_payload(params, "exams")
        if action in {"create", "update"}:
            defaults = {"exam_id": params.get("exam_id"), "client_id": params.get("client_id")}
            _apply_defaults_to_items(params, "exams", defaults)
        logger.info(f"exam_operations_tool: action={action}, kwargs={params}")
        try:
            return exam_tool.execute(action, **params)
        except Exception as e:
            logger.error(f"exam_operations error: {e}\n{traceback.format_exc()}")
            return ToolResponse.error(f"שגיאה: {str(e)}")

    def medical_log_operations_tool(action: str, **kwargs) -> str:
        params = {k: v for k, v in kwargs.items() if v is not None}
        _merge_payload(params, "logs")
        if action in {"create", "update"}:
            defaults = {"log_id": params.get("log_id"), "client_id": params.get("client_id")}
            _apply_defaults_to_items(params, "logs", defaults)
        logger.info(f"medical_log_operations_tool: action={action}, kwargs={params}")
        try:
            return medical_log_tool.execute(action, **params)
        except Exception as e:
            logger.error(f"medical_log_operations error: {e}\n{traceback.format_exc()}")
            return ToolResponse.error(f"שגיאה: {str(e)}")

    return [
        StructuredTool.from_function(
            func=client_operations_tool,
            name="client_operations",
            description="Manage clients: search for clients by name/phone/ID, get client details, get client summary with related counts, list recent clients, create new clients, update existing clients",
            args_schema=ClientOperationsInput
        ),
        StructuredTool.from_function(
            func=appointment_operations_tool,
            name="appointment_operations",
            description="Manage appointments: list appointments with filters, search by client name, get single appointment, create new appointment(s), update appointments, check for scheduling conflicts",
            args_schema=AppointmentOperationsInput
        ),
        StructuredTool.from_function(
            func=exam_operations_tool,
            name="exam_operations",
            description="Manage exams: list exams with filters, search by client name, get single exam, get client's most recent exam, create new exams, update exams",
            args_schema=ExamOperationsInput
        ),
        StructuredTool.from_function(
            func=medical_log_operations_tool,
            name="medical_log_operations",
            description="Manage medical logs: list all logs, get single log by ID, get all logs for a client, create new medical log(s), update logs",
            args_schema=MedicalLogOperationsInput
        ),
    ]


@router.post("/chat")
async def ai_chat(
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    """Non-streaming AI chat endpoint."""
    message: str = body.get("message", "")
    conversation_history: List[Dict[str, str]] = body.get("conversationHistory", [])
    chat_id: Optional[int] = body.get("chat_id")
    if not message:
        raise HTTPException(status_code=422, detail="message is required")

    # Build agent with tools bound to user context
    llm = ChatOpenAI(model="gpt-5", api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)
    tools = _make_tools_for_user(current_user)
    agent = create_react_agent(llm, tools)

    memory_key = f"u:{current_user.id}:c:{chat_id or 0}"
    history = USER_MEMORY.setdefault(memory_key, [])
    
    # Merge provided conversationHistory into memory
    if conversation_history and not history:
        for m in conversation_history:
            role = m.get("role", "user")
            content = m.get("content", "")
            if not content:
                continue
            history.append(HumanMessage(content=content) if role == "user" else AIMessage(content=content))

    messages = [SystemMessage(content=_system_prompt(current_user)), *history, HumanMessage(content=message)]
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
    """Streaming AI chat endpoint."""
    message: str = body.get("message", "")
    conversation_history: List[Dict[str, str]] = body.get("conversationHistory", [])
    chat_id: Optional[int] = body.get("chat_id")
    if not message:
        raise HTTPException(status_code=422, detail="message is required")

    llm = ChatOpenAI(model="gpt-5-chat-latest", api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL, streaming=True, temperature=1.0)
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
        
        try:
            async for event in agent.astream_events(
                {"messages": [SystemMessage(content=_system_prompt(current_user)), *history, HumanMessage(content=message)]},
                version="v2",
            ):
                try:
                    ev = event.get("event")
                    
                    # Stream tool lifecycle for UI
                    if ev == "on_tool_start":
                        try:
                            name = event.get("name")
                            args = event.get("data", {}).get("input")
                            
                            tool_desc = _format_tool_action_text(name, args)
                            
                            append_text_part_if_any()
                            
                            action_name = args.get("action") if isinstance(args, dict) else None
                            parts.append({
                                "type": "tool",
                                "content": tool_desc,
                                "toolName": name,
                                "toolPhase": "start",
                                "result": None,
                                "toolAction": tool_desc,
                                "timestamp": part_order
                            })
                            part_order += 1
                            payload = {'tool': {'phase': 'start', 'name': name, 'args': args}, 'parts': parts}
                            logger.info(f"[TOOL_START] {name}: {tool_desc}")
                            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                        except Exception as e:
                            import traceback
                            error_msg = f"Error in on_tool_start: {e}\n{traceback.format_exc()}"
                            logger.error(error_msg)
                            # Yield error to stream
                            yield f"data: {json.dumps({'error': error_msg, 'parts': parts}, ensure_ascii=False)}\n\n"
                        continue
                    
                    if ev == "on_tool_end":
                        try:
                            name = event.get("name")
                            output = event.get("data", {}).get("output")
                            
                            logger.info(f"AI tool_end: name={name}, output_type={type(output).__name__}, output={str(output)[:200]}")
                            
                            serialized_output = None
                            result_summary = ""
                            tool_phase = "end"
                            if output:
                                try:
                                    raw_output = output
                                    if hasattr(output, 'content'):
                                        raw_output = output.content
                                    
                                    if isinstance(raw_output, (dict, list, str, int, float, bool)) or raw_output is None:
                                        serialized_output = raw_output
                                    else:
                                        serialized_output = str(raw_output)
                                    
                                    parsed_output = raw_output
                                    if isinstance(raw_output, str):
                                        try:
                                            parsed_output = json.loads(raw_output)
                                        except:
                                            parsed_output = raw_output
                                    
                                    if isinstance(parsed_output, dict):
                                        status_value = parsed_output.get("status")
                                        if status_value == "success":
                                            result_summary = parsed_output.get("message", "הפעולה הושלמה")
                                        elif status_value == "error" or parsed_output.get("error"):
                                            error_msg = parsed_output.get("error")
                                            logger.error(f"Tool {name} returned error: {error_msg}")
                                            result_summary = f"שגיאה: {error_msg}" if error_msg else "שגיאה בביצוע הפעולה"
                                            tool_phase = "error"
                                        else:
                                            result_summary = parsed_output.get("message") or "הפעולה הושלמה"
                                    else:
                                        string_output = str(raw_output) if raw_output else ""
                                        if string_output.lower().startswith("error") or string_output.startswith("שגיאה"):
                                            tool_phase = "error"
                                        result_summary = string_output[:200] if string_output else "הפעולה הושלמה"
                                except Exception as e:
                                    import traceback
                                    error_trace = traceback.format_exc()
                                    logger.error(f"Error parsing tool output: {e}\n{error_trace}")
                                    result_summary = f"שגיאה: {str(e)}"
                                    tool_phase = "error"
                            
                            if not result_summary:
                                result_summary = "הפעולה הושלמה"
                            
                            if parts and parts[-1]["type"] == "tool" and parts[-1]["toolName"] == name:
                                parts[-1]["toolPhase"] = tool_phase
                                parts[-1]["result"] = result_summary
                            
                            stream_output = serialized_output
                            if stream_output is None and output is not None:
                                stream_output = str(output)
                            
                            yield f"data: {json.dumps({'tool': {'phase': tool_phase, 'name': name, 'output': stream_output}, 'parts': parts}, ensure_ascii=False)}\n\n"
                        except Exception as e:
                            import traceback
                            error_msg = f"Error in on_tool_end: {e}\n{traceback.format_exc()}"
                            logger.error(error_msg)
                            yield f"data: {json.dumps({'error': error_msg, 'parts': parts}, ensure_ascii=False)}\n\n"
                        continue
                    
                    if ev == "on_chat_model_stream":
                        data = event.get("data", {})
                        chunk = data.get("chunk")
                        if chunk is not None:
                            text = getattr(chunk, "content", None)
                            if text:
                                full += text
                                current_text_part_content += text
                                yield f"data: {json.dumps({'chunk': text, 'fullMessage': full, 'currentTextPart': current_text_part_content}, ensure_ascii=False)}\n\n"
                except Exception as e:
                    import traceback
                    error_msg = f"Error processing event: {e}\n{traceback.format_exc()}"
                    logger.error(error_msg)
                    yield f"data: {json.dumps({'error': error_msg, 'parts': parts}, ensure_ascii=False)}\n\n"
        
        except Exception as e:
            import traceback
            error_msg = f"Fatal error in event stream: {e}\n{traceback.format_exc()}"
            logger.error(error_msg)
            # Yield error and close stream
            yield f"data: {json.dumps({'error': error_msg, 'parts': parts, 'done': True, 'fatal': True}, ensure_ascii=False)}\n\n"
            return
        
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
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
        },
    )

