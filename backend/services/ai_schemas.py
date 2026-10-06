from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StrictStr, model_validator
from .ai_campaign_catalog import FILTER_FIELDS, OPERATORS


class InsightSections(BaseModel):
    model_config = ConfigDict(extra='forbid')
    exam: str
    order: str
    referral: str
    appointment: str
    file: str
    medical: str
    contact_lens: str


class CampaignFilter(BaseModel):
    model_config = ConfigDict(extra='forbid')
    field: str
    operator: str
    value: StrictStr | StrictInt | StrictFloat | StrictBool | None
    logic: Literal['AND', 'OR']

    @model_validator(mode='after')
    def validate_filter(self):
        field = FILTER_FIELDS.get(self.field)
        if not field or self.operator not in OPERATORS[field['type']]:
            raise ValueError('invalid filter field/operator')
        if self.operator in {'is_empty', 'is_not_empty'}:
            return self
        if self.value is None:
            raise ValueError('missing filter value')
        kind = field['type']
        if kind == 'boolean' and not isinstance(self.value, bool):
            raise ValueError('invalid boolean')
        if kind == 'number' or self.operator in {'last_days', 'next_days'}:
            if isinstance(self.value, bool) or not isinstance(self.value, (float, int)):
                raise ValueError('invalid number')
            if self.operator in {'last_days', 'next_days'} and (self.value < 0 or int(self.value) != self.value):
                raise ValueError('invalid day count')
        elif kind in {'text', 'select', 'date'} and not isinstance(self.value, str):
            raise ValueError('invalid text')
        if kind == 'select' and self.value not in field.get('options', []):
            raise ValueError('invalid option')
        if kind == 'date' and self.operator not in {'last_days', 'next_days'}:
            date.fromisoformat(self.value)
        return self


class GeneratedCampaign(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=200)
    filters: list[CampaignFilter] = Field(max_length=50)
    email_enabled: bool
    email_content: str | None
    sms_enabled: bool
    sms_content: str | None
    active: bool
    cycle_type: Literal['daily', 'monthly', 'yearly', 'custom']
    cycle_custom_days: int | None
    execute_once_per_client: bool

    @model_validator(mode='after')
    def validate_channels(self):
        if self.email_enabled and not self.email_content:
            raise ValueError('missing email')
        if self.sms_enabled and not self.sms_content:
            raise ValueError('missing sms')
        if self.cycle_type == 'custom' and (self.cycle_custom_days is None or self.cycle_custom_days <= 0):
            raise ValueError('invalid cycle')
        return self
