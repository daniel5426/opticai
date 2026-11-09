"""Micropay JSON transport and explicit purchased-unit tariff (not GSM segments)."""
import hashlib
import json
import re
import httpx
from config import settings
from services.campaign_providers import Outcome


def wire_text(text):
    # One CR is the documented single-character line break in Micropay JSON.
    return text.replace('\r\n', '\n').replace('\r', '\n').replace('\n', '\r')


class MicropaySms:
    name = 'micropay'

    def policy(self):
        tiers = json.loads(settings.MICROPAY_UNIT_TIERS)
        previous_length = previous_units = 0
        if not isinstance(tiers, list) or not tiers: raise ValueError('sms_tariff_not_configured')
        for length, units in tiers:
            if type(length) is not int or type(units) is not int or not previous_length < length <= 1000 or not previous_units < units <= 1000:
                raise ValueError('sms_tariff_not_configured')
            previous_length, previous_units = length, units
        return {'provider': self.name, 'tiers': tiers, 'sender': settings.MICROPAY_SENDER,
                'account': hashlib.sha256(settings.MICROPAY_TOKEN.encode()).hexdigest()}

    def billing(self, text):
        policy = self.policy()
        # Count UTF-16 code units, including emoji surrogate pairs. No guessed English discount.
        length = len(wire_text(text).encode('utf-16-be')) // 2
        for limit, units in policy['tiers']:
            if length <= limit: return units, policy
        raise ValueError('sms_tariff_not_configured')

    def ready(self):
        try:
            self.policy()
            return bool(settings.MICROPAY_TOKEN and re.fullmatch(r'[A-Za-z0-9 +*]{2,11}', settings.MICROPAY_SENDER)
                        and len(settings.MICROPAY_WEBHOOK_SECRET) >= 32)
        except (ValueError, TypeError): return False

    def credit(self):
        response = httpx.post('https://www.micropay.co.il/extApi/scheduleSms.php',
            json={'token': settings.MICROPAY_TOKEN, 'act': 'credit'}, timeout=15)
        response.raise_for_status()
        data = response.json()
        credit = (data.get('data') or {}).get('credit')
        if data.get('status') != 1 or data.get('action') != 'credit' or type(credit) is not int or credit < 0:
            raise ValueError('invalid_credit')
        return credit

    def send(self, *, destination, content, key):
        if not self.ready(): return Outcome('failed', code='sms_not_configured')
        try: self.billing(content)
        except (ValueError, TypeError): return Outcome('failed', code='sms_tariff_not_configured')
        try:
            response = httpx.post('https://www.micropay.co.il/extApi/scheduleSms.php',
                json={'token': settings.MICROPAY_TOKEN, 'from': settings.MICROPAY_SENDER,
                      'msg': wire_text(content), 'list': destination.lstrip('+'), 'desc': key, 'validate': 1}, timeout=20)
            # No documented idempotency support: ambiguous HTTP errors must never auto-retry.
            if response.status_code != 200: return Outcome('uncertain', code='micropay_http_error')
            data = response.json()
            if data.get('status') == 0 and data.get('message') == 'ERROR':
                return Outcome('failed', code='micropay_rejected')
            task = data.get('data') or {}
            if data.get('status') == 1 and data.get('message') == 'OK' and task.get('taskId'):
                return Outcome('submitted', str(task['taskId']))
            return Outcome('uncertain', code='micropay_invalid_response')
        except (httpx.HTTPError, ValueError, TypeError, AttributeError):
            return Outcome('uncertain', code='micropay_submission_unknown')

    def reconcile(self, provider_id):
        try:
            response = httpx.post('https://www.micropay.co.il/extApi/taskStatus.php',
                json={'token': settings.MICROPAY_TOKEN, 'tid': provider_id}, timeout=20)
            response.raise_for_status()
            data = response.json()
            status = (data.get('data') or {}).get('taskStatus')
            if data.get('status') == 1 and status in ('pending', 'running', 'done'):
                # Campaign completion is not handset delivery; only DLR establishes delivery.
                return Outcome('submitted', provider_id)
        except (httpx.HTTPError, ValueError, TypeError, AttributeError): pass
        return Outcome('uncertain', provider_id, 'micropay_reconciliation_pending')

    def event(self, data):
        from services.campaign_filters import normalize
        if data.get('type') != 'pushreg' or data.get('status') not in ('ok', 'nd'): raise ValueError('event')
        task = str(data.get('msgid', ''))
        destination = normalize('sms', data.get('phone'))
        if not task or len(task) > 160 or not destination: raise ValueError('event')
        digest = hashlib.sha256(json.dumps([task, destination, data['status']]).encode()).hexdigest()
        return {'key': 'micropay:' + digest, 'provider_id': task, 'destination': destination,
                'type': 'sms.delivered' if data['status'] == 'ok' else 'sms.undeliverable'}

    def verify_event(self, body, headers):
        # Micropay documents no signed headers. Only the secret-bearing callback route is admitted.
        raise ValueError('callback_secret_required')
