"""Compatibility module kept for older imports; MongoDB is intentionally not used."""

from types import SimpleNamespace

# The old application imported ``db``/``client`` at startup. Keep harmless stand-ins
# so third-party/legacy imports do not crash, while all registration storage uses
# lib.store instead.
class _NoopClient:
    def close(self) -> None:
        return None


db = SimpleNamespace()
client = _NoopClient()


async def ensure_indexes() -> None:
    return None
