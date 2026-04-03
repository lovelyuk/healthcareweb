from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, RootModel


class BodySummaryRequest(RootModel[dict[str, Any]]):
    pass


class BodySummaryResponse(BaseModel):
    success: bool
    dummy: bool | None = Field(default=None)
    summary: str
    error: str | None = Field(default=None)
