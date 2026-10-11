"""Shared vocabulary (allowed values). Pure typing, no third-party imports."""

from typing import Literal, get_args

Budget = Literal["free", "low", "flexible"]
Energy = Literal["low", "medium", "high"]
Difficulty = Literal["easy", "moderate", "challenging"]
Company = Literal["solo", "friends", "family", "group"]
Interest = Literal[
    "walking", "nature", "photography", "gardening", "fitness", "birdwatching", "creativity", "social"
]
AccessibilityNeed = Literal["step-free", "seating", "shade", "low-sensory", "short-distance"]

BUDGETS: tuple[str, ...] = get_args(Budget)
ENERGIES: tuple[str, ...] = get_args(Energy)
DIFFICULTIES: tuple[str, ...] = get_args(Difficulty)
COMPANIES: tuple[str, ...] = get_args(Company)
INTERESTS: tuple[str, ...] = get_args(Interest)
ACCESSIBILITY_NEEDS: tuple[str, ...] = get_args(AccessibilityNeed)

BUDGET_RANK: dict[str, int] = {"free": 0, "low": 1, "flexible": 2}
ENERGY_RANK: dict[str, int] = {"low": 0, "medium": 1, "high": 2}

# Upper bound of a plan's estimated total cost for each budget level (USD).
BUDGET_CAP_USD: dict[str, float] = {"free": 0.0, "low": 10.0, "flexible": 100.0}
DEFAULT_CURRENCY = "USD"
