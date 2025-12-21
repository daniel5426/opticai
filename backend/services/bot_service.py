import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models import Client, Clinic, User
from .messaging.whatsapp import whatsapp_service
from .messaging.base import MessagingService
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from config import settings

logger = logging.getLogger(__name__)

class BotService:
    def __init__(self, db: Session):
        self.db = db
        self.llm = ChatOpenAI(
            model="gpt-4o", # Using gpt-4o as it's standard, even if code said otherwise
            api_key=settings.OPENAI_API_KEY,
            temperature=0.7,
        )

    async def handle_incoming_message(self, phone_number: str, message_body: str, metadata: Dict[str, Any]):
        """
        Processes an incoming WhatsApp message and sends an AI-generated response.
        """
        # 1. Identify Client
        # Remove '+' if present and normalize
        normalized_phone = phone_number.replace("+", "")
        # Very simple lookup, in production we'd handle country codes etc.
        client = self.db.query(Client).filter(
            (Client.phone_mobile == phone_number) | 
            (Client.phone_mobile == normalized_phone) |
            (Client.phone_mobile.endswith(normalized_phone[-9:]))
        ).first()

        if not client:
            logger.info(f"Incoming message from unknown number: {phone_number}")
            # Optional: Send a generic welcome or ask for ID
            return

        # 2. Get Context
        # We can reuse the _collect_all_client_data logic if we make it accessible
        # For now, let's keep it simple
        clinic = self.db.query(Clinic).filter(Clinic.id == client.clinic_id).first()

        # 3. Generate AI Response
        system_prompt = (
            f"אתה עוזר וירטואלי חכם עבור מרפאת העיניים '{clinic.name if clinic else 'Prysm'}'. "
            f"אתה מדבר עם הלקוח {client.first_name} {client.last_name}. "
            "היה אדיב, מקצועי ותמציתי. ענה בעברית בלבד. "
            "אם הלקוח שואל על תורים או הזמנות, נסה לתת מידע רלוונטי אם יש לך גישה אליו. "
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=message_body)
        ]

        try:
            response = await self.llm.ainvoke(messages)
            bot_response = response.content

            # 4. Send Response via WhatsApp
            await whatsapp_service.send_message(
                recipient=phone_number,
                content=bot_response
            )
            
            logger.info(f"Sent AI response to {client.first_name} ({phone_number})")

        except Exception as e:
            logger.error(f"Error generating/sending AI response: {str(e)}")

    def _collect_client_status(self, client: Client) -> str:
        # Simplified context for the LLM
        return f"לקוח: {client.first_name} {client.last_name}, סטטוס: {client.status or 'פעיל'}"
