from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

class MessagingService(ABC):
    """
    Abstract base class for messaging services.
    Ensures a consistent interface for different communication channels.
    """

    @abstractmethod
    async def send_message(self, recipient: str, content: str, **kwargs) -> bool:
        """
        Send a generic text message to a recipient.
        """
        pass

    @abstractmethod
    async def send_template_message(
        self, 
        recipient: str, 
        template_name: str, 
        language_code: str = "he", 
        components: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> bool:
        """
        Send a template-based message (required for marketing/external initiation).
        """
        pass

    @abstractmethod
    async def get_message_status(self, message_id: str) -> Dict[str, Any]:
        """
        Retrieve the status of a sent message.
        """
        pass
