"""Declarative report visuals reference validated snapshot columns, never executable UI."""
import json
from math import isfinite
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from fastapi import HTTPException


class ChartSpec(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['bar', 'line', 'area', 'pie', 'donut']
    title: str | None = Field(default=None, max_length=120)
    x: str = Field(min_length=1, max_length=180)
    series: list[str] = Field(min_length=1, max_length=5)

    @model_validator(mode='after')
    def circular_series(self):
        if self.kind in {'pie', 'donut'} and len(self.series) != 1:
            raise ValueError('A distribution chart requires exactly one numeric series.')
        return self


class ReportPresentation(BaseModel):
    model_config = ConfigDict(extra='forbid')
    show_table: bool = True
    show_stats: bool = True
    charts: list[ChartSpec] = Field(default_factory=list, max_length=6)
    labels: dict[str, Annotated[str, Field(min_length=1, max_length=80)]] = Field(default_factory=dict, max_length=32)


def validate_presentation(definition, columns, numeric_columns=None):
    presentation = definition.presentation
    if presentation:
        if any(key not in columns for key in presentation.labels):
            raise HTTPException(422, 'agent.unsupportedReportField')
        for chart in presentation.charts:
            if chart.x not in columns or any(field not in columns or field == chart.x for field in chart.series):
                raise HTTPException(422, 'agent.unsupportedReportField')
            if numeric_columns is not None and any(field not in numeric_columns for field in chart.series):
                raise HTTPException(422, 'agent.unsupportedReportField')


def apply_presentation(handle, definition, columns, metadata):
    presentation = definition.presentation
    groups, truncated = {}, set()
    for payload, in handle.execute('SELECT payload FROM rows ORDER BY position'):
        row = json.loads(payload)
        currency = row.get('currency')
        items = groups.setdefault(currency, [])
        if len(items) < 52:
            items.append(row)
        else:
            truncated.add(currency)
    if presentation:
        metadata.update(show_table=presentation.show_table, show_stats=presentation.show_stats, presentation_version=1)
        metadata.setdefault('column_labels', {}).update(presentation.labels)
    specs = presentation.charts if presentation else []
    if not specs and definition.preset == 'custom' and definition.group_by and definition.aggregates:
        specs = [ChartSpec(kind='bar', x=definition.group_by[0], series=([f'{a.operation}_{a.field}' for a in definition.aggregates]
            + [metric.key for metric in definition.derived_metrics])[:5])]
    if specs:
        charts = []
        for spec in specs:
            for currency, rows in groups.items():
                # Keep invalid/non-numeric selections explicit without losing the report itself.
                numeric = all(row.get(key) is None or isinstance(row.get(key), (int, float)) and not isinstance(row.get(key), bool)
                    and isfinite(row[key]) for row in rows for key in spec.series)
                charts.append({**spec.model_dump(), 'currency': currency, 'rows': rows if numeric else [],
                    'truncated': currency in truncated, 'unavailable': not numeric})
        metadata['charts'] = charts
    if definition.preset == 'custom' and definition.aggregates and not (set(definition.group_by) - {'currency'}):
        # A KPI is a single aggregate row per currency. Do not sum grouped averages
        # or distinct counts to invent clinic-wide totals.
        previous = {row.get('currency'): row for row in metadata.get('comparison', {}).get('rows', [])}
        metrics = []
        keys = [f'{a.operation}_{a.field}' for a in definition.aggregates] + [m.key for m in definition.derived_metrics]
        for currency, rows in groups.items():
            if len(rows) != 1 or currency in truncated:
                continue
            for key in keys:
                current = rows[0].get(key)
                before = previous.get(currency, {}).get(key)
                if current is not None and (isinstance(current, bool) or not isinstance(current, (int, float))):
                    continue
                metrics.append({'key': key, 'currency': currency, 'current': current, 'previous': before,
                    'change_percent': (current - before) / abs(before) * 100 if before and current is not None else None})
        metadata['metrics'] = metrics
