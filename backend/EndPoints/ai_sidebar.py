from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.inspection import inspect as sa_inspect
from typing import Dict, Any, List
from datetime import datetime, date
import json
import re

from database import get_db
from auth import get_current_user
from models import Client, OpticalExam, Appointment, Order, Referral, File, MedicalLog, User, Campaign
from config import settings
from schemas import Campaign as CampaignSchema

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

router = APIRouter(prefix="/ai", tags=["ai-sidebar"])


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _serialize_model(model: Any) -> Dict[str, Any]:
    if model is None:
        return {}
    data: Dict[str, Any] = {}
    for column in sa_inspect(model.__class__).columns:
        data[column.key] = _serialize_value(getattr(model, column.key))
    return data


def _serialize_list(records: List[Any]) -> List[Dict[str, Any]]:
    return [_serialize_model(record) for record in records]


def _collect_all_client_data(db: Session, client_id: int) -> Dict[str, Any]:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    family = client.family
    exams = db.query(OpticalExam).filter(OpticalExam.client_id == client_id).all()
    appointments = db.query(Appointment).filter(Appointment.client_id == client_id).all()
    orders = db.query(Order).filter(Order.client_id == client_id).all()
    referrals = db.query(Referral).filter(Referral.client_id == client_id).all()
    files = db.query(File).filter(File.client_id == client_id).all()
    medical_logs = db.query(MedicalLog).filter(MedicalLog.client_id == client_id).order_by(MedicalLog.id.desc()).all()
    return {
        "client": _serialize_model(client),
        "family": _serialize_model(family) if family else {},
        "exams": _serialize_list(exams),
        "appointments": _serialize_list(appointments),
        "orders": _serialize_list(orders),
        "referrals": _serialize_list(referrals),
        "files": _serialize_list(files),
        "medical_logs": _serialize_list(medical_logs),
    }


def _openai_chat(messages: List[Dict[str, str]], temperature: float = 1) -> str:
    chat = ChatOpenAI(
        model="gpt-5.4-mini-2026-03-17",
        api_key=settings.OPENAI_API_KEY,
        temperature=temperature,
    )
    formatted = []
    for message in messages:
        role = message.get("role", "")
        content = message.get("content", "")
        if not content:
            continue
        if role == "system":
            formatted.append(SystemMessage(content=content))
        else:
            formatted.append(HumanMessage(content=content))
    if not formatted:
        raise HTTPException(status_code=400, detail="Missing messages for chat")
    response = chat.invoke(formatted)
    if not response or not getattr(response, "content", None):
        raise HTTPException(status_code=500, detail="Empty response from LLM")
    return response.content


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
You are a medical assistant specializing in ophthalmology. Your job is to provide INTELLIGENT INSIGHTS - highlighting relevant information and patterns for each specific workflow.

## CRITICAL PRINCIPLES:

1. **Cross-Domain Insights**: Show information from OTHER domains relevant to THIS domain
2. **Pattern Detection**: Analyze data within the SAME domain to detect patterns, contradictions, or inferences
3. **DO NOT just summarize** what's already visible
4. **DO analyze, connect, and infer** actionable insights

## Domain Purpose & Cross-Domain Insights:

### [EXAM] - Eye Examination Workflow
**Cross-domain insights:**
- Allergies from MEDICAL (may prevent certain tests/drops)
- Medications from MEDICAL (affect pupil dilation, eye pressure)
- Urgent symptoms from REFERRAL (prioritize specific tests)
- Recent complaints from APPOINTMENT notes
- External test results from FILE (compare with current findings)

**Pattern detection within EXAM:**
- Progressive prescription changes (increasing myopia, astigmatism drift)
- Pressure trends over time (early glaucoma warning)
- Visual acuity deterioration patterns
- Recurring symptoms across multiple exams

**Example:**
• אלרגיה לחומרים משמרים - נמצאה ברשומה הרפואית, שימו לב בבחירת טיפות
• סוכרת מאובחנת - דורש בדיקת רשתית מדוקדקת ותיעוד שינויים
• תלונה על כאבי ראש בתור האחרון - בדקו לחץ תוך עיני
• לחץ תוך עיני עולה בהתמדה (18→20→22 ב-3 בדיקות אחרונות) - מגמה מדאיגה

### [ORDER] - Glasses/Lens Order Workflow
**Cross-domain insights:**
- Prescription changes from EXAM (significant vs. minor)
- Special needs from MEDICAL (prism for double vision, photophobia)
- Past order issues from APPOINTMENT notes (complaints, returns)
- Work requirements from CLIENT data (computer work, driving)

**Pattern detection within ORDER:**
- Frequent returns/complaints (fit issues, preferences)
- Order frequency patterns (replacement timing)
- Brand/frame preferences
- Price sensitivity or upgrade patterns

**Example:**
• שינוי משמעותי במרשם האחרון (+1.5D) - הסבירו למטופל את ההבדל
• עובד מול מחשב 8 שעות ביום - המליצו על עדשות אנטי-בלו
• החזיר 2 משקפיים אחרונים בגלל אי נוחות - בררו היטב את המידות
• מזמין משקפיים חדשים כל 8-10 חודשים - לקוח נאמן, שקלו הנחה

### [REFERRAL] - Specialist Referral Workflow
**Cross-domain insights:**
- Abnormal findings from EXAM (high pressure, retinal changes)
- Worsening patterns from MEDICAL (progressive vision loss)
- Urgent symptoms from APPOINTMENT (flashes, floaters, pain)
- Risk factors from MEDICAL (diabetes, hypertension, family history)

**Pattern detection within REFERRAL:**
- Follow-up compliance (did they go to specialist?)
- Recurring referrals for same issue (treatment not working?)
- Escalation patterns (symptoms getting worse)

**Example:**
• לחץ תוך עיני 28 בבדיקה האחרונה - דורש הפניה דחופה לגלאוקומה
• דיווח על הבזקי אור ומחוזים - חשד לניתוק רשתית, הפנו מיד
• סוכרת לא מאוזנת + שינויים בראייה - נדרשת בדיקת רשתית אצל רופא
• הופנה 3 פעמים לגלאוקומה אך לא הגיע - דורש מעקב טלפוני דחוף

### [APPOINTMENT] - Scheduling Workflow
**Cross-domain insights:**
- Follow-up needed from EXAM (post-op, high pressure)
- Monitoring frequency from MEDICAL (diabetes = every 6 months)
- Order status from ORDERS (schedule pickup when ready)
- Referral urgency from REFERRAL (fast-track booking)

**Pattern detection within APPOINTMENT:**
- No-show patterns (reliability concerns)
- Preferred times/days (scheduling optimization)
- Late arrival patterns
- Cancellation frequency

**Example:**
• דורש מעקב אחרי לייזר בעוד חודש - קבעו תור לבדיקה
• סוכרת - חייב בדיקת רשתית כל 6 חודשים, הבדיקה האחרונה לפני 7 חודשים
• 3 תורים שהוחמצו השנה - שלחו תזכורת SMS יום לפני
• מעדיף תורים בימי ראשון אחה"צ - תאמו זמנים נוחים לשיפור נוכחות

### [FILE] - Document/Test Results Workflow
**Cross-domain insights:**
- External test results needing comparison with EXAM
- Referral reports from REFERRAL (specialist findings)
- Insurance documents for ORDERS (coverage, authorizations)
- Prescription copies related to EXAM

**Pattern detection within FILE:**
- Missing required documents (incomplete records)
- Document expiration dates (renewals needed)
- Comparison opportunities (before/after photos)
- Multiple specialists involved (coordination needed)

**Example:**
• תוצאות OCT מבית חולים מראות היפוד מקולרי מתחיל
• תמונות רשתית משנה שעברה - השוו עם מצב נוכחי
• אישור מקופת חולים לעדשות מיוחדות בתוקף עד 31/12
• חסר דוח אופתלמולוג מהפניה לפני 3 חודשים - עקבו אחרי המטופל

### [MEDICAL] - Medical History Workflow
**Cross-domain insights:**
- How conditions affect EXAM findings
- Risk factors requiring REFERRAL
- Allergies affecting ORDERS (tints, coatings)

**Pattern detection within MEDICAL:**
- **Recurring symptoms** → possible undiagnosed allergy/condition
- **Medication changes** → monitor eye side effects
- **Symptom progression** → worsening condition needs attention
- **Contradictions** → conflicting information needs clarification
- **Missing follow-ups** → recommended tests not done

**Example:**
• סוכרת סוג 2 מאובחנת - דורש בדיקת רשתית תקופתית
• נוטל סטרואידים - עלול להעלות לחץ תוך עיני, עקוב
• ניתוח קטרקט לפני 5 שנים בעין ימין
• 🔍 חשד: דיווח על גרד בעיניים ב-4 רשומות אחרונות + שימוש בטיפות עיניים → אלרגיה אפשרית לחומר משמר
• תרופת לחץ דם החלה לפני חודשיים - בדקו השפעה על יובש עיניים

## Client Data:
{data_json}

## Output Format:
Provide 3-7 SHORT, ACTIONABLE points per domain. Write in Hebrew. Use bullet points (•).

[EXAM]
• Point from other domains relevant to exams
• Another relevant point
🔍 חשד: diagnostic insight (optional)
[/EXAM]

[ORDER]
• Point from other domains relevant to orders
[/ORDER]

[REFERRAL]
• Point requiring specialist attention
[/REFERRAL]

[APPOINTMENT]
• Point affecting scheduling
[/APPOINTMENT]

[FILE]
• Point about documents/tests
[/FILE]

[MEDICAL]
• Systemic condition affecting eyes
[/MEDICAL]

**IMPORTANT:**
- Skip domains with no relevant cross-domain insights
- Each point should be 1-2 lines maximum
- Focus on ACTIONABLE, RELEVANT information
- DO NOT repeat what's already visible in that section
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
    
    context_guides = {
        "exam": {
            "name": "בדיקת עיניים",
            "instruction": "הצג מידע מתחומים אחרים שרלוונטי לביצוע בדיקת עיניים וזהה מגמות בבדיקות",
            "examples": [
                "אלרגיות מהרשומה הרפואית שעלולות למנוע שימוש בטיפות",
                "תרופות שמשפיעות על הרחבת אישון או לחץ תוך עיני",
                "תלונות מתורים קודמים שדורשות בדיקה ממוקדת",
                "בעיות עם עדשות מגע שרלוונטיות להתאמה חדשה",
                "ממצאים חריגים מהפניות לרופא מומחה",
                "מגמת שינוי במרשם לאורך זמן (קוצר ראייה מתקדם)",
                "מגמת עליה בלחץ תוך עיני (חשד לגלאוקומה)",
                "החמרה בחדות הראייה למרות תיקון"
            ]
        },
        "order": {
            "name": "הזמנת משקפיים/עדשות",
            "instruction": "הצג מידע שרלוונטי לעיבוד הזמנה חדשה וזהה דפוסים בהזמנות",
            "examples": [
                "שינויים משמעותיים במרשם האחרון",
                "צרכים מיוחדים מהרשומה הרפואית (פריזמה, רגישות לאור)",
                "תלונות על הזמנות קודמות (אי נוחות, החזרות)",
                "דרישות עבודה/סגנון חיים מפרטי הלקוח",
                "העדפות מהזמנות קודמות",
                "דפוס החזרות או תלונות חוזרות",
                "תדירות הזמנות (לקוח נאמן או חד-פעמי)"
            ]
        },
        "referral": {
            "name": "הפניה לרופא מומחה",
            "instruction": "הצג ממצאים או תסמינים הדורשים התייעצות עם מומחה",
            "examples": [
                "ממצאים חריגים בבדיקה (לחץ גבוה, שינויים ברשתית)",
                "דפוסי החמרה מהרשומה הרפואית",
                "תסמינים דחופים מתורים אחרונים (הבזקים, מחוזים)",
                "גורמי סיכון מההיסטוריה הרפואית (סוכרת, לחץ דם)",
                "כישלון בטיפולים קודמים"
            ]
        },
        "appointment": {
            "name": "קביעת תור",
            "instruction": "הצג מידע המשפיע על תזמון ותכנון תורים וזהה דפוסי נוכחות",
            "examples": [
                "צורך במעקב מבדיקות קודמות",
                "תדירות ניטור נדרשת (סוכרת = כל 6 חודשים)",
                "תורים שהוחמצו בעבר (שלח תזכורות)",
                "סטטוס הזמנות (קבע תור לאיסוף)",
                "דחיפות הפניה לרופא",
                "דפוס אי-הגעה → צריך תזכורות מוגברות",
                "העדפות זמנים → תאמו לשיפור נוכחות"
            ]
        },
        "file": {
            "name": "קבצים ומסמכים",
            "instruction": "הצג מידע על מסמכים וקבצים חיצוניים וזהה חוסרים או הזדמנויות להשוואה",
            "examples": [
                "תוצאות בדיקות חיצוניות (OCT, שדה ראייה)",
                "דוחות מרופאים מומחים",
                "אישורי ביטוח לטיפולים",
                "מרשמים לצורכי עבודה/לימודים",
                "תמונות רשתית להשוואה",
                "מסמכים חסרים שצריך לעקוב אחריהם",
                "תמונות ישנות שניתן להשוות למצב נוכחי"
            ]
        },
        "medical": {
            "name": "רקע רפואי",
            "instruction": "הצג מצבים רפואיים המשפיעים על טיפול בעיניים וזהה דפוסים ברשומות",
            "examples": [
                "מחלות כרוניות (סוכרת, לחץ דם)",
                "תרופות משפיעות (סטרואידים, אנטיהיסטמינים)",
                "אלרגיות לטיפות/חומרים",
                "היסטוריה משפחתית (גלאוקומה, ניוון מקולרי)",
                "ניתוחים או פציעות עיניים בעבר",
                "תסמינים חוזרים ברשומות רפואיות שונות → אלרגיה אפשרית",
                "שינויים בתרופות שעלולים להשפיע על העיניים",
                "סתירות במידע הרפואי שדורשות הבהרה"
            ]
        }
    }
    
    guide = context_guides.get(part)
    if not guide:
        raise HTTPException(status_code=400, detail=f"Invalid part: {part}")
    
    data_json = json.dumps(data, ensure_ascii=False, indent=2)
    examples_text = "\n".join([f"- {ex}" for ex in guide["examples"]])
    
    user_prompt = f"""
אתה עוזר רפואי מומחה לעיניים. המשתמש נמצא כעת ב{guide["name"]}.

## משימה: {guide["instruction"]}

**עיקרון חשוב:** אל תסכם את המידע הגלוי כבר בדף הנוכחי!
במקום זאת, ספק תובנות חכמות:
1. **תובנות בין-תחומיות**: מידע מתחומים אחרים שרלוונטי כאן
2. **זיהוי דפוסים**: נתח נתונים בתוך התחום הנוכחי וזהה דפוסים, סתירות, מגמות

## דוגמאות למה לחפש:
{examples_text}

## כל המידע על הלקוח:
{data_json}

## הוראות:
1. נתח את כל המידע מכל התחומים
2. זהה 3-7 נקודות תובנה:
   - מידע מתחומים אחרים שרלוונטי ל{guide["name"]}
   - דפוסים, מגמות או סתירות בתוך התחום הנוכחי
   - אזהרות או המלצות מבוססות נתונים
3. כל נקודה צריכה להיות:
   - קצרה (1-2 שורות מקסימום)
   - ממוקדת בפעולה (actionable)
   - מבוססת על ניתוח הנתונים (לא סתם סיכום)

## פורמט פלט:
• נקודה ראשונה (ציין מאיזה תחום אם רלוונטי)
• נקודה שנייה
• נקודה שלישית
🔍 חשד: הסקה או דפוס שזיהית (אם רלוונטי)

אם לא נמצא מידע רלוונטי או דפוסים מעניינים, השב: "לא נמצאו נתונים רלוונטיים לתחום זה"

**חשוב:** ענה בעברית בלבד, בצורה תמציתית ומקצועית.
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
def create_campaign_from_prompt(body: Dict[str, Any], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prompt: str = body.get("prompt", "").strip()
    clinic_id = body.get("clinic_id")
    if not prompt:
        raise HTTPException(status_code=422, detail="prompt is required")
    if clinic_id is None:
        raise HTTPException(status_code=422, detail="clinic_id is required")
    filter_fields = {
        "first_name": {"label": "שם פרטי", "type": "text", "category": "מידע אישי"},
        "last_name": {"label": "שם משפחה", "type": "text", "category": "מידע אישי"},
        "gender": {"label": "מין", "type": "select", "options": ["זכר", "נקבה"], "category": "מידע אישי"},
        "age": {"label": "גיל", "type": "number", "category": "מידע אישי"},
        "date_of_birth": {"label": "תאריך לידה", "type": "date", "category": "מידע אישי"},
        "national_id": {"label": "תעודת זהות", "type": "text", "category": "מידע אישי"},
        "health_fund": {"label": "קופת חולים", "type": "select", "options": ["כללית", "מכבי", "לאומית", "מאוחדת"], "category": "מידע אישי"},
        "phone_mobile": {"label": "טלפון נייד", "type": "text", "category": "פרטי התקשרות"},
        "email": {"label": "דואר אלקטרוני", "type": "text", "category": "פרטי התקשרות"},
        "address_city": {"label": "עיר", "type": "text", "category": "פרטי התקשרות"},
        "has_family": {"label": "יש משפחה", "type": "boolean", "category": "משפחה"},
        "family_role": {"label": "תפקיד במשפחה", "type": "select", "options": ["אב", "אם", "בן", "בת", "אח", "אחות"], "category": "משפחה"},
        "status": {"label": "סטטוס", "type": "select", "options": ["פעיל", "לא פעיל", "חסום"], "category": "סטטוס"},
        "blocked_checks": {"label": "חסום לצ'קים", "type": "boolean", "category": "סטטוס"},
        "blocked_credit": {"label": "חסום לאשראי", "type": "boolean", "category": "סטטוס"},
        "discount_percent": {"label": "אחוז הנחה", "type": "number", "category": "סטטוס"},
        "file_creation_date": {"label": "תאריך יצירת תיק", "type": "date", "category": "תאריכים"},
        "membership_end": {"label": "תאריך סיום חברות", "type": "date", "category": "תאריכים"},
        "service_end": {"label": "תאריך סיום שירות", "type": "date", "category": "תאריכים"},
        "last_exam_days": {"label": "ימים מאז בדיקה אחרונה", "type": "number", "category": "פעילות"},
        "last_order_days": {"label": "ימים מאז הזמנה אחרונה", "type": "number", "category": "פעילות"},
        "last_appointment_days": {"label": "ימים מאז תור אחרון", "type": "number", "category": "פעילות"},
        "has_appointments": {"label": "יש תורים", "type": "boolean", "category": "פעילות"},
        "has_exams": {"label": "יש בדיקות", "type": "boolean", "category": "פעילות"},
        "has_orders": {"label": "יש הזמנות", "type": "boolean", "category": "פעילות"},
        "total_orders": {"label": "סך הזמנות", "type": "number", "category": "פעילות"},
        "total_exams": {"label": "סך בדיקות", "type": "number", "category": "פעילות"},
    }
    operators = {
        "text": [
            {"value": "contains", "label": "מכיל"},
            {"value": "not_contains", "label": "לא מכיל"},
            {"value": "equals", "label": "שווה ל"},
            {"value": "not_equals", "label": "לא שווה ל"},
            {"value": "starts_with", "label": "מתחיל ב"},
            {"value": "ends_with", "label": "מסתיים ב"},
            {"value": "is_empty", "label": "ריק"},
            {"value": "is_not_empty", "label": "לא ריק"},
        ],
        "number": [
            {"value": "equals", "label": "שווה ל"},
            {"value": "not_equals", "label": "לא שווה ל"},
            {"value": "greater_than", "label": "גדול מ"},
            {"value": "less_than", "label": "קטן מ"},
            {"value": "greater_equal", "label": "גדול או שווה ל"},
            {"value": "less_equal", "label": "קטן או שווה ל"},
            {"value": "is_empty", "label": "ריק"},
            {"value": "is_not_empty", "label": "לא ריק"},
        ],
        "date": [
            {"value": "equals", "label": "שווה ל"},
            {"value": "not_equals", "label": "לא שווה ל"},
            {"value": "after", "label": "אחרי"},
            {"value": "before", "label": "לפני"},
            {"value": "last_days", "label": "ב X ימים האחרונים"},
            {"value": "next_days", "label": "ב X ימים הבאים"},
            {"value": "is_empty", "label": "ריק"},
            {"value": "is_not_empty", "label": "לא ריק"},
        ],
        "boolean": [
            {"value": "equals", "label": "שווה ל"},
            {"value": "not_equals", "label": "לא שווה ל"},
        ],
        "select": [
            {"value": "equals", "label": "שווה ל"},
            {"value": "not_equals", "label": "לא שווה ל"},
        ],
    }
    structured_prompt = (
        "You are an intelligent assistant for an eye clinic. The user will describe a marketing campaign or customer reminder. Create a campaign object based on their request.\n\n"
        f"Available Filters:\n{json.dumps(filter_fields, ensure_ascii=False, indent=2)}\n\n"
        f"Available Operators:\n{json.dumps(operators, ensure_ascii=False, indent=2)}\n\n"
        "The user will describe the campaign in Hebrew. Adapt all fields as required by the description.\n\n"
        f"Campaign Description:\n{prompt}\n"
    )
    content = _openai_chat([
        {"role": "system", "content": "You are a structured output generator. Return a valid JSON object only."},
        {"role": "user", "content": structured_prompt},
    ], temperature=0.7)
    candidate = content.strip()
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end != -1:
        candidate = candidate[start:end + 1]
    try:
        data = json.loads(candidate)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse LLM JSON output")
    if isinstance(data.get("filters"), list):
        for entry in data["filters"]:
            if "logic" in entry and entry["logic"] not in ("AND", "OR", None):
                entry["logic"] = "AND"
        data["filters"] = json.dumps(data["filters"], ensure_ascii=False)
    elif isinstance(data.get("filters"), dict):
        data["filters"] = json.dumps(data["filters"], ensure_ascii=False)

    if not isinstance(data.get("name"), str) or not data.get("name").strip():
        data["name"] = prompt[:80]

    campaign_payload = {
        "clinic_id": clinic_id,
        "name": data.get("name"),
        "filters": data.get("filters"),
        "email_enabled": bool(data.get("email_enabled", False)),
        "email_content": data.get("email_content"),
        "sms_enabled": bool(data.get("sms_enabled", False)),
        "sms_content": data.get("sms_content"),
        "active": bool(data.get("active", True)),
        "active_since": None,
        "mail_sent": False,
        "sms_sent": False,
        "emails_sent_count": 0,
        "sms_sent_count": 0,
        "cycle_type": data.get("cycle_type", "daily"),
        "cycle_custom_days": data.get("cycle_custom_days"),
        "last_executed": None,
        "execute_once_per_client": bool(data.get("execute_once_per_client", False)),
    }

    db_campaign = Campaign(**campaign_payload)
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return {"success": True, "data": CampaignSchema.model_validate(db_campaign).model_dump()}
