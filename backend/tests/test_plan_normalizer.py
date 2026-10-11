import pytest

from app.services.ai_errors import AIResponseError
from app.services.json_utils import extract_json_object
from app.services.plan_normalizer import normalize_ai_plan
from tests.helpers import make_input, valid_ai_payload


def test_valid_payload_is_normalised():
    plan = normalize_ai_plan(valid_ai_payload(), make_input())
    assert plan["total_minutes"] == 45
    assert [s["order"] for s in plan["steps"]] == [1, 2, 3]
    assert plan["estimated_cost"]["currency"] == "USD"
    assert plan["difficulty"] == "easy" and plan["energy_required"] == "low"


def test_steps_are_scaled_to_fit_available_time():
    payload = valid_ai_payload()
    for step in payload["steps"]:
        step["duration_minutes"] = 60
    plan = normalize_ai_plan(payload, make_input(available_minutes=30))
    assert plan["total_minutes"] <= 30
    assert all(s["duration_minutes"] >= 1 for s in plan["steps"])


def test_missing_durations_are_filled_in():
    payload = valid_ai_payload()
    for step in payload["steps"]:
        step.pop("duration_minutes")
    plan = normalize_ai_plan(payload, make_input(available_minutes=30))
    assert 0 < plan["total_minutes"] <= 30


def test_free_budget_clamps_cost_and_discloses_it():
    plan = normalize_ai_plan(valid_ai_payload(), make_input(budget="free"))
    assert plan["estimated_cost"]["max"] == 0
    assert "Adjusted to fit your free budget" in plan["estimated_cost"]["assumptions"]


def test_cost_swaps_reversed_and_ignores_negative():
    payload = valid_ai_payload(estimated_cost={"min": 8, "max": -2, "assumptions": "Small snacks."})
    plan = normalize_ai_plan(payload, make_input(budget="low"))
    assert plan["estimated_cost"]["min"] <= plan["estimated_cost"]["max"]
    assert plan["estimated_cost"]["min"] >= 0


def test_plain_number_cost_is_accepted_only_with_assumptions():
    payload = valid_ai_payload(estimated_cost=5)
    with pytest.raises(AIResponseError):
        normalize_ai_plan(payload, make_input())


def test_difficulty_and_energy_aliases():
    plan = normalize_ai_plan(valid_ai_payload(difficulty="Beginner", energy_required="Moderate"), make_input())
    assert plan["difficulty"] == "easy" and plan["energy_required"] == "medium"


def test_plan_needing_more_energy_than_user_has_is_rejected():
    with pytest.raises(AIResponseError):
        normalize_ai_plan(valid_ai_payload(energy_required="high"), make_input(energy="low"))


@pytest.mark.parametrize(
    "field",
    ["title", "summary", "why_it_matches", "steps", "estimated_cost", "checklist", "backup_plan",
     "safety_reminders", "phone_away_suggestion", "difficulty", "energy_required"],
)
def test_missing_required_fields_are_rejected(field):
    payload = valid_ai_payload()
    payload.pop(field)
    with pytest.raises(AIResponseError):
        normalize_ai_plan(payload, make_input())


def test_single_step_plan_is_rejected():
    payload = valid_ai_payload()
    payload["steps"] = payload["steps"][:1]
    with pytest.raises(AIResponseError):
        normalize_ai_plan(payload, make_input())


def test_accessibility_adaptations_required_when_needs_given():
    with pytest.raises(AIResponseError):
        normalize_ai_plan(valid_ai_payload(accessibility_adaptations=[]), make_input(accessibility_needs=("seating",)))
    ok = normalize_ai_plan(
        valid_ai_payload(accessibility_adaptations=["Rest on benches every 10 minutes."]),
        make_input(accessibility_needs=("seating",)),
    )
    assert ok["accessibility_adaptations"]


def test_text_is_cleaned_and_truncated():
    payload = valid_ai_payload(title="  Big\x00  walk\n\n now  " + "x" * 400)
    plan = normalize_ai_plan(payload, make_input())
    assert len(plan["title"]) <= 120 and "\x00" not in plan["title"]


def test_empty_challenge_becomes_none():
    assert normalize_ai_plan(valid_ai_payload(challenge=""), make_input())["challenge"] is None


def test_extract_json_handles_fences_think_tags_and_prefix():
    assert extract_json_object('{"a": 1}') == {"a": 1}
    assert extract_json_object('```json\n{"a": 1}\n```') == {"a": 1}
    assert extract_json_object('<think>hmm</think>{"a": 1}') == {"a": 1}
    assert extract_json_object('Here you go: {"a": {"b": 2}} thanks') == {"a": {"b": 2}}


@pytest.mark.parametrize("bad", ["", "   ", "not json at all", '{"a": ', "[1, 2, 3]", None])
def test_extract_json_rejects_garbage(bad):
    with pytest.raises(AIResponseError):
        extract_json_object(bad)
