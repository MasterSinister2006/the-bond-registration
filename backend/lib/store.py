"""Small process-local registration store.

Google Sheets is the persistent source of truth for registrations in the no-Mongo
configuration. This in-memory store keeps the current app flow working while the
process is alive; registrations are synced to the Sheet immediately on creation.
"""
from __future__ import annotations

import asyncio
from copy import deepcopy
from typing import Any

_REGISTRATIONS: dict[str, dict[str, Any]] = {}
_LOCK = asyncio.Lock()


async def insert_registration(doc: dict[str, Any]) -> None:
    async with _LOCK:
        _REGISTRATIONS[doc["id"]] = deepcopy(doc)


async def get_registration(registration_id: str) -> dict[str, Any] | None:
    async with _LOCK:
        doc = _REGISTRATIONS.get(registration_id)
        return deepcopy(doc) if doc else None


async def list_registrations() -> list[dict[str, Any]]:
    async with _LOCK:
        docs = [deepcopy(doc) for doc in _REGISTRATIONS.values()]
    return sorted(docs, key=lambda item: item.get("created_at"), reverse=True)


async def update_registration(registration_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    async with _LOCK:
        doc = _REGISTRATIONS.get(registration_id)
        if not doc:
            return None
        doc.update(deepcopy(updates))
        return deepcopy(doc)


async def find_and_update(registration_id: str, predicate, updates: dict[str, Any]) -> dict[str, Any] | None:
    async with _LOCK:
        doc = _REGISTRATIONS.get(registration_id)
        if not doc or not predicate(doc):
            return None
        doc.update(deepcopy(updates))
        return deepcopy(doc)
