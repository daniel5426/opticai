"""Explicit tool wire schema; service validation remains authoritative for inventory writes."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class SupplySource(Strict):
    sheet: str | None = None
    row: int | None = Field(default=None, ge=1)
    text: str | None = None

    @model_validator(mode='after')
    def evidence(self):
        if self.row is None and not self.text:
            raise ValueError('Supply rows require original sheet/row coordinates or source text.')
        return self


class SupplyValues(Strict):
    category: Literal['frame', 'contact_lens']
    brand: str | None = None
    model: str | None = None
    product_type: str | None = None
    material: str | None = None
    preferred_supplier: str | None = None
    replacement_schedule: str | None = None
    color: str | None = None
    eye_size: int | float | str | None = None
    bridge: int | float | str | None = None
    temple_length: int | float | str | None = None
    height: int | float | str | None = None
    sph: int | float | str | None = None
    bc: int | float | str | None = None
    dia: int | float | str | None = None
    pack_size: int | float | str | None = None
    cyl: int | float | str | None = None
    axis: int | float | str | None = None
    add: int | float | str | None = None
    design: str | None = None
    sku: str | None = None
    barcode: str | None = None
    default_cost: int | float | str | None = None
    default_retail: int | float | str | None = None
    currency: str | None = None
    is_stockable: bool | None = None
    quantity: int | float | str | None = None


class SupplyRow(Strict):
    source: SupplySource
    values: SupplyValues
    variant_id: int | None = Field(default=None, gt=0)

    @model_validator(mode='after')
    def new_frame(self):
        if self.variant_id is None and self.values.category == 'frame':
            if not self.values.color or self.values.eye_size in (None, ''):
                raise ValueError('New frame rows require values.color and values.eye_size from the source.')
        return self


class SupplyProposal(Strict):
    operation: Literal['catalog', 'prices', 'receipt', 'count']
    rows: list[SupplyRow] = Field(min_length=1, max_length=10000)
