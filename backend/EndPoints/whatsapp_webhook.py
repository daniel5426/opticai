from fastapi import APIRouter, Depends, Request, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from config import settings
from services.bot_service import BotService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

@router.get("/webhook")
def verify_webhook(request: Request):
    """
    Handles Meta's webhook verification (hub.verify_token).
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode and token:
        if mode == "subscribe" and token == settings.WHATSAPP_VERIFY_TOKEN:
            logger.info("WhatsApp Webhook verified successfully.")
            return int(challenge)
        else:
            logger.warning("WhatsApp Webhook verification failed: Invalid verify token.")
            raise HTTPException(status_code=403, detail="Forbidden")
    
    return {"message": "Invalid params"}

@router.post("/webhook")
async def handle_webhook(
    request: Request, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Receives incoming WhatsApp messages and status updates.
    """
    try:
        payload = await request.json()
        logger.info(f"Received WhatsApp webhook: {payload}")

        # Extract message information
        # WhatsApp payload structure is nested: entry -> changes -> value -> messages
        entries = payload.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                messages = value.get("messages", [])
                for msg in messages:
                    from_phone = msg.get("from")
                    msg_type = msg.get("type")
                    
                    if msg_type == "text":
                        body = msg.get("text", {}).get("body")
                        logger.info(f"Incoming message from {from_phone}: {body}")
                        
                        # Process in background to respond 200 OK to Meta quickly
                        bot_service = BotService(db)
                        background_tasks.add_task(
                            bot_service.handle_incoming_message, 
                            from_phone, 
                            body, 
                            {"msg_id": msg.get("id")}
                        )

        # Meta expects a 200 OK within 2-3 seconds
        return {"status": "success"}

    except Exception as e:
        logger.error(f"Error processing WhatsApp webhook: {str(e)}")
        # Still return 200 to Meta to avoid retries if the error is on our end
        return {"status": "error", "detail": str(e)}
