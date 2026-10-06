"""WhatsApp drafts use the shared AI boundary and clinic-entered names only."""
import logging
from sqlalchemy.orm import Session
from models import Client
from .messaging.whatsapp import whatsapp_service
from .ai_service import AIError, LANGUAGES, get_ai_service, locale
from .ai_privacy import project_record

logger = logging.getLogger(__name__)


class BotService:
    def __init__(self, db: Session):
        self.db = db

    async def handle_incoming_message(self, phone_number: str, message_body: str, metadata: dict):
        normalized = phone_number.replace('+', '')
        if len(normalized) < 9:
            return
        clients = self.db.query(Client).filter(
            Client.deleted_at.is_(None),
            (Client.phone_mobile == phone_number) | (Client.phone_mobile == normalized) | (Client.phone_mobile.endswith(normalized[-9:]))
        ).limit(2).all()
        # Never choose a patient's clinic arbitrarily when a phone is shared.
        if len(clients) != 1:
            return
        client = project_record(clients[0], 'client')
        language = locale(metadata.get('locale'))
        instructions = f'''You are Prysm's optical-clinic reception assistant. Reply in {LANGUAGES[language]}.
Be polite and concise. The patient's clinic-entered name is {client.get('first_name', '')} {client.get('last_name', '')}.
You cannot access appointments, orders, Google data, or medical records. Do not invent their contents or claim a booking was made.
For scheduling, order status, or medical questions, direct the patient to clinic staff.'''
        try:
            response = await get_ai_service().response('whatsapp', [{'role': 'user', 'content': message_body}], instructions)
            if response.output_text:
                await whatsapp_service.send_message(recipient=phone_number, content=response.output_text)
        except AIError:
            logger.warning('whatsapp_ai_failed code=ai.failed')
        except Exception:
            logger.warning('whatsapp_delivery_failed code=delivery.failed')
