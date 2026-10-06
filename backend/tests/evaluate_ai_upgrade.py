"""Explicit live, synthetic-only release gate. No database or messaging mutations.
Run from repo root: python backend/tests/evaluate_ai_upgrade.py --run
Only usage, timings, checks and sanitized error classes are recorded, never model bodies.
"""
import argparse
import asyncio
import json
from pathlib import Path
import sys
import time
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.ai_service import AIService, LANGUAGES
from services.ai_tools import definitions
from services.ai_schemas import InsightSections, GeneratedCampaign
from services.ai_campaign_catalog import FILTER_FIELDS, OPERATORS

PRICES = {'gpt-6.1-sol': (2, 10), 'gpt-6-luna': (.1, .5), 'gpt-5': (1.25, 10), 'gpt-5-chat-latest': (1.25, 10), 'gpt-5.4-mini-2026-03-17': (.75, 4.5), 'gpt-4o': (2.5, 10)}
FEATURES = {'assistant_stream': ('gpt-6.1-sol', 'low', 'gpt-5-chat-latest'), 'assistant': ('gpt-6.1-sol', 'low', 'gpt-5'), 'insights': ('gpt-6.1-sol', 'medium', 'gpt-5.4-mini-2026-03-17'), 'campaign': ('gpt-6-luna', 'none', 'gpt-5.4-mini-2026-03-17'), 'whatsapp': ('gpt-6-luna', 'none', 'gpt-4o')}

async def evaluate():
    service = AIService()
    records = []
    for language in LANGUAGES:
        for feature, (target, effort, baseline) in FEATURES.items():
            for version, model in [('baseline', baseline), ('target', target)]:
                inputs = [{'role': 'user', 'content': 'Synthetic test.'}]
                instructions = f'Reply in {LANGUAGES[language]}. Never invent clinical facts, bookings or completed writes.'
                extra = {}
                if feature in {'assistant', 'assistant_stream'}:
                    inputs[0]['content'] = 'Create one appointment for client ID 42 on 2026-10-07 at 10:00. Use the appointment_operations tool with payload. Do not create other records.'
                    extra = {'tools': definitions(), 'parallel_tool_calls': False}
                elif feature == 'campaign':
                    inputs[0]['content'] = 'Draft an inactive daily campaign for age greater than 40. Email disabled, SMS disabled. Only one age filter, AND logic, once per client.'
                    instructions += f' Catalog: {json.dumps(FILTER_FIELDS, ensure_ascii=False)} Operators: {json.dumps(OPERATORS)}'
                    extra = {'text': {'format': {'type': 'json_schema', 'name': feature, 'strict': True, 'schema': GeneratedCampaign.model_json_schema()}}}
                elif feature == 'insights':
                    inputs[0]['content'] = json.dumps({'client': {'first_name': 'Synthetic'}, 'exams': [], 'orders': [], 'referrals': [], 'appointments': [], 'files': [], 'medical_logs': []})
                    instructions += ' Return all insight sections as empty strings because no clinical records exist.'
                    extra = {'text': {'format': {'type': 'json_schema', 'name': feature, 'strict': True, 'schema': InsightSections.model_json_schema()}}}
                else:
                    inputs[0]['content'] = 'What time is my appointment?'
                    instructions += ' You have no access to appointments. Explain that you cannot check the booking and direct the patient to clinic staff.'
                params = service.parameters('assistant' if feature == 'assistant_stream' else feature, inputs, instructions, **extra)
                params['model'] = model
                if version == 'target': params['reasoning'] = {'effort': effort}
                elif model in {'gpt-4o', 'gpt-5-chat-latest'}: params.pop('reasoning', None)
                else: params['reasoning'] = {'effort': 'low'}
                started = time.monotonic()
                record = {'feature': feature, 'locale': language, 'version': version, 'model': model}
                try:
                    if feature == 'assistant_stream':
                        r = None
                        stream = await service.client.responses.create(**params, stream=True)
                        async with stream:
                            async for event in stream:
                                if event.type == 'response.completed': r = event.response
                        if r is None: raise RuntimeError('Incomplete synthetic stream')
                    else:
                        r = await service.client.responses.create(**params)
                    passed = r.status == 'completed'
                    if feature in {'assistant', 'assistant_stream'}:
                        calls = [c for c in r.output if c.type == 'function_call']
                        args = json.loads(calls[0].arguments) if len(calls) == 1 else {}
                        payload = args.get('payload', {})
                        if isinstance(payload, list): payload = payload[0] if len(payload) == 1 else {}
                        passed &= len(calls) == 1 and calls[0].name == 'appointment_operations' and args.get('action') == 'create' and payload.get('client_id') == 42 and payload.get('date') == '2026-10-07' and payload.get('time') == '10:00'
                    elif feature == 'campaign':
                        result = GeneratedCampaign.model_validate_json(r.output_text)
                        passed &= not result.active and not result.email_enabled and not result.sms_enabled and len(result.filters) == 1 and result.filters[0].field == 'age' and result.filters[0].operator == 'greater_than' and result.filters[0].value == 40
                    elif feature == 'insights':
                        result = InsightSections.model_validate_json(r.output_text)
                        passed &= all(not v.strip() for v in result.model_dump().values())
                    else:
                        passed &= bool(r.output_text.strip()) and not any(n in r.output_text for n in ['10:00','11:00','12:00'])
                        # Text quality/locale still requires human review beyond this smoke gate.
                    rate = PRICES[model]
                    record.update(passed=bool(passed), input_tokens=r.usage.input_tokens, output_tokens=r.usage.output_tokens, estimated_uncached_usd=round((r.usage.input_tokens*rate[0]+r.usage.output_tokens*rate[1])/1e6, 6))
                except Exception as error:
                    record.update(passed=False, error=type(error).__name__)
                record['duration_ms'] = round((time.monotonic()-started)*1000)
                records.append(record)
                print(json.dumps(record), flush=True)
    report = {'synthetic_only': True, 'price_source': 'https://developers.openai.com/api/docs/pricing', 'cost_method': 'Standard uncached estimate; actual billing/cache discounts may differ.', 'manual_review_required': 'Clinical correctness and locale quality require broader representative evaluation before production.', 'results': records}
    Path('docs/ai/synthetic-evaluation.json').write_text(json.dumps(report, indent=2)+'\n')
    await service.client.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--run', action='store_true'); args = parser.parse_args()
    if not args.run: parser.error('Explicit --run required: calls paid OpenAI API with synthetic input only.')
    asyncio.run(evaluate())
