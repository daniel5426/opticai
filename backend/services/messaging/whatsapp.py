import httpx
import logging
import asyncio
from typing import Any, Dict, List, Optional
from .base import MessagingService
from config import settings

logger = logging.getLogger(__name__)

class WhatsAppService(MessagingService):
    """
    Implementation of MessagingService for WhatsApp Cloud API.
    Uses Meta's Cloud API to send messages and templates.
    """

    def __init__(self):
        self.api_version = "v18.0"
        self.base_url = f"https://graph.facebook.com/{self.api_version}/{settings.WHATSAPP_PHONE_NUMBER_ID}"
        self.headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        }
        self.semaphore = asyncio.Semaphore(50)  # Limit concurrent requests

    async def send_message(self, recipient: str, content: str, **kwargs) -> bool:
        """
        Send a simple text message. Useful for interactive bot responses within 24h window.
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient,
            "type": "text",
            "text": {"preview_url": True, "body": content},
        }
        return await self._post_request("messages", payload)

    async def send_template_message(
        self, 
        recipient: str, 
        template_name: str, 
        language_code: str = "he", 
        components: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> bool:
        """
        Send a pre-approved template message. Required for business-initiated messages.
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components or []
            },
        }
        return await self._post_request("messages", payload)

    async def get_message_status(self, message_id: str) -> Dict[str, Any]:
        """
        Retrieve message status from WhatsApp.
        Note: In practice, status updates are usually handled via Webhooks.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"https://graph.facebook.com/{self.api_version}/{message_id}",
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Error fetching WhatsApp message status: {str(e)}")
                return {"error": str(e)}

    async def mark_message_as_read(self, message_id: str) -> bool:
        """
        Mark an incoming message as read.
        """
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id
        }
        return await self._post_request("messages", payload)

    async def _post_request(self, endpoint: str, payload: Dict[str, Any]) -> bool:
        """
        Internal helper for POST requests with semaphore and error handling.
        """
        async with self.semaphore:
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.post(
                        f"{self.base_url}/{endpoint}",
                        headers=self.headers,
                        json=payload,
                        timeout=10.0
                    )
                    
                    if response.status_code == 429:
                        logger.warning("WhatsApp API Rate Limit reached (429).")
                        # You might implement a retry logic here
                        return False

                    response_data = response.json()
                    if response.status_code >= 400:
                        logger.error(f"WhatsApp API Error: {response_data}")
                        return False
                    
                    logger.info(f"WhatsApp message sent successfully: {response_data.get('messages', [{}])[0].get('id')}")
                    return True

                except httpx.HTTPError as e:
                    logger.error(f"HTTP error occurred while calling WhatsApp API: {str(e)}")
                    return False
                except Exception as e:
                    logger.error(f"Unexpected error calling WhatsApp API: {str(e)}")
                    return False

# Singleton instance
whatsapp_service = WhatsAppService()
