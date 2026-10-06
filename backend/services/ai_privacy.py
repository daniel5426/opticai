"""Explicit clinic-data projections. Google integration objects never enter AI context."""
from datetime import date, datetime
from decimal import Decimal

CLIENT_FIELDS = frozenset('id clinic_id first_name last_name gender national_id date_of_birth health_fund address_city address_street address_number postal_code phone_home phone_work phone_mobile fax email service_center occupation status notes family_id family_role price_list discount_percent blocked_checks blocked_credit file_creation_date membership_end service_end'.split())
RECORD_FIELDS = {
    'client': CLIENT_FIELDS,
    'family': frozenset('id name notes'.split()),
    'exams': frozenset('id client_id clinic_id exam_date test_name dominant_eye type exam_data'.split()),
    'appointments': frozenset('id client_id clinic_id user_id date time duration exam_name note'.split()),
    'orders': frozenset('id client_id clinic_id date order_date order_type status notes total_amount price discount delivery_date type dominant_eye order_data'.split()),
    'referrals': frozenset('id client_id clinic_id date referral_date referral_type reason notes diagnosis type urgency_level recipient referral_notes prescription_notes referral_data'.split()),
    'files': frozenset('id client_id clinic_id file_name file_type file_size upload_date notes'.split()),
    'medical_logs': frozenset('id client_id clinic_id log_date log'.split()),
}
# Operational result fields are explicit too; arbitrary provider/error metadata is omitted.
TOOL_FIELDS = frozenset().union(*RECORD_FIELDS.values(), frozenset('status data message progress suggestions exact confidence match_text succeeded failed total index client_name appointment_id exam_id log_id count exams_count appointments_count orders_count referrals_count files_count medical_logs_count conflicts has_conflicts available latest_exam_date'.split()))


def is_private_key(key):
    key = str(key).lower()
    return any(part in key for part in ('google', 'oauth', 'token', 'calendar_event', 'credential', 'password', 'secret', 'auth_provider')) or key.startswith('ai_') or key in {'profile', 'profile_picture', 'username', 'full_name', 'user_info', 'userinfo'}


def clean_nested(value):
    """Clinical JSON stays extensible, but integration/identity keys are always removed."""
    if isinstance(value, dict):
        return {str(k): clean_nested(v) for k, v in value.items() if not is_private_key(k)}
    if isinstance(value, (list, tuple)):
        return [clean_nested(v) for v in value]
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def project_record(record, kind):
    if record is None:
        return {}
    return {key: clean_nested(getattr(record, key)) for key in RECORD_FIELDS[kind] if hasattr(record, key)}


def clean_tool_result(value):
    if isinstance(value, list):
        return [clean_tool_result(v) for v in value]
    if isinstance(value, dict):
        # Error text can include SQL values and credentials; never echo exception text.
        result = {k: (clean_nested(v) if k in {'exam_data', 'order_data', 'referral_data'} else clean_tool_result(v)) for k, v in value.items() if k in TOOL_FIELDS and not is_private_key(k)}
        if 'error' in value or value.get('status') == 'error':
            result['error'] = 'ai.toolFailed'
        return result
    return clean_nested(value)
