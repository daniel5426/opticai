import logging

import httpx

from config import settings


logger = logging.getLogger(__name__)


def send_email(*, to: str, subject: str, html: str) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning("Transactional email skipped because RESEND_API_KEY is not configured")
        return False
    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        json={"from": settings.EMAIL_FROM, "to": [to], "subject": subject, "html": html},
        timeout=10,
    )
    response.raise_for_status()
    return True
