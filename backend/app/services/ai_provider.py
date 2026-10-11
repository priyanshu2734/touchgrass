"""Provider interface. Tests substitute a fake; production uses OllamaProvider."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class ProviderStatus:
    reachable: bool
    model_available: bool
    installed_models: tuple[str, ...] = ()


class AIProvider(Protocol):
    name: str
    model: str

    async def check(self) -> ProviderStatus:
        """Report reachability and whether the configured model is installed. Must not raise."""
        ...

    async def generate_json(self, *, system: str, user: str, schema: dict[str, Any]) -> str:
        """Return the model's raw text (expected to be a JSON object). Raises AIError subclasses."""
        ...
