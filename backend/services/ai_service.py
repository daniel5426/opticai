"""The only AI network boundary: direct OpenAI Responses, no storage or retries."""
import json
import logging
import time
from functools import lru_cache
from openai import AsyncOpenAI
from config import settings
from .ai_privacy import clean_nested

logger = logging.getLogger(__name__)
LANGUAGES = {'he': 'Hebrew', 'en': 'English', 'fr': 'French'}
TEXT = {
    'ai.failed': {'he': 'לא ניתן להשלים את בקשת הבינה המלאכותית.', 'en': 'The AI request could not be completed.', 'fr': 'La demande IA n’a pas pu être terminée.'},
    'ai.limit': {'he': 'הבקשה הגיעה למגבלת הפעולות. בדקו פעולות שכבר בוצעו לפני ניסיון נוסף.', 'en': 'The request reached its action limit. Check completed actions before trying again.', 'fr': 'La demande a atteint sa limite d’actions. Vérifiez les actions effectuées avant de réessayer.'},
    'ai.toolStart': {'he': 'מבצע פעולה במרפאה', 'en': 'Performing clinic operation', 'fr': 'Exécution d’une opération du centre'},
    'ai.toolDone': {'he': 'הפעולה הושלמה', 'en': 'Operation completed', 'fr': 'Opération terminée'},
    'ai.toolFailed': {'he': 'הפעולה לא הושלמה. בדקו את הנתונים לפני ניסיון נוסף.', 'en': 'Operation unsuccessful. Check the records before trying again.', 'fr': 'Opération non terminée. Vérifiez les données avant de réessayer.'},
    'ai.noInsights': {'he': 'לא נמצאו תובנות רלוונטיות.', 'en': 'No relevant insights found.', 'fr': 'Aucune observation pertinente.'},
}


def locale(value):
    return value if value in LANGUAGES else 'he'


def translated(key, language):
    return TEXT[key][locale(language)]


class AIError(Exception):
    def __init__(self, code='ai.failed'):
        self.code = code
        super().__init__(code)


class AIService:
    def __init__(self, client=None):
        self.client = client or AsyncOpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL, timeout=settings.AI_TIMEOUT_SECONDS, max_retries=0)

    def parameters(self, feature, inputs, instructions, **extra):
        model, effort, limit = {
            'assistant': (settings.AI_ASSISTANT_MODEL, settings.AI_ASSISTANT_REASONING, settings.AI_ASSISTANT_OUTPUT_TOKENS),
            'insights': (settings.AI_INSIGHTS_MODEL, settings.AI_INSIGHTS_REASONING, settings.AI_INSIGHTS_OUTPUT_TOKENS),
            'campaign': (settings.AI_CAMPAIGN_MODEL, settings.AI_CAMPAIGN_REASONING, settings.AI_CAMPAIGN_OUTPUT_TOKENS),
            'whatsapp': (settings.AI_WHATSAPP_MODEL, settings.AI_WHATSAPP_REASONING, settings.AI_WHATSAPP_OUTPUT_TOKENS),
        }[feature]
        return dict(model=model, reasoning={'effort': effort}, max_output_tokens=limit, store=False, background=False, input=clean_nested(inputs), instructions=instructions, **extra)

    def record_usage(self, feature, response, started):
        usage = getattr(response, 'usage', None)
        logger.info('ai_request feature=%s model=%s input_tokens=%s output_tokens=%s duration_ms=%s', feature, response.model, getattr(usage, 'input_tokens', 0), getattr(usage, 'output_tokens', 0), round((time.monotonic() - started) * 1000))

    async def response(self, feature, inputs, instructions, **extra):
        started = time.monotonic()
        try:
            response = await self.client.responses.create(**self.parameters(feature, inputs, instructions, **extra))
            self.record_usage(feature, response, started)
            if response.status != 'completed' or any(getattr(c, 'type', '') == 'refusal' for item in response.output for c in getattr(item, 'content', [])):
                raise AIError()
            return response
        except AIError:
            raise
        except Exception:
            logger.warning('ai_request_failed feature=%s code=ai.failed', feature)
            raise AIError() from None

    async def stream(self, feature, inputs, instructions, **extra):
        started = time.monotonic()
        try:
            stream = await self.client.responses.create(**self.parameters(feature, inputs, instructions, stream=True, **extra))
            async with stream:
                async for event in stream:
                    if event.type in {'response.failed', 'response.incomplete', 'error', 'response.refusal.delta', 'response.refusal.done'}:
                        raise AIError()
                    if event.type == 'response.completed':
                        self.record_usage(feature, event.response, started)
                    yield event
        except AIError:
            raise
        except Exception:
            logger.warning('ai_request_failed feature=%s code=ai.failed', feature)
            raise AIError() from None

    async def structured(self, feature, inputs, instructions, schema):
        response = await self.response(feature, inputs, instructions, text={'format': {'type': 'json_schema', 'name': feature, 'strict': True, 'schema': schema}})
        try:
            return json.loads(response.output_text)
        except (ValueError, TypeError):
            raise AIError() from None


@lru_cache(maxsize=1)
def get_ai_service():
    try:
        return AIService()
    except Exception:
        raise AIError() from None
