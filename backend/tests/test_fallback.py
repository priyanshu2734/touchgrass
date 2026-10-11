from app.data.activities import ACTIVITIES
from app.models.vocab import ACCESSIBILITY_NEEDS, BUDGET_RANK, BUDGETS, COMPANIES, ENERGIES, ENERGY_RANK, INTERESTS
from app.services.fallback_planner import build_fallback_plan
from app.services.matching import rank_activities
from tests.helpers import make_input


def _plan(**kw):
    inp = make_input(**kw)
    return inp, build_fallback_plan(inp, rank_activities(inp, ACTIVITIES))


def test_fallback_plan_has_every_required_section():
    _, plan = _plan()
    for key in (
        "title", "summary", "why_it_matches", "total_minutes", "steps", "estimated_cost", "difficulty",
        "energy_required", "checklist", "challenge", "accessibility_adaptations", "backup_plan",
        "safety_reminders", "phone_away_suggestion",
    ):
        assert key in plan
    assert plan["estimated_cost"]["assumptions"]
    assert [s["order"] for s in plan["steps"]] == list(range(1, len(plan["steps"]) + 1))
    assert plan["safety_reminders"] and plan["phone_away_suggestion"]


def test_fallback_always_respects_hard_limits():
    for minutes in (5, 10, 20, 30, 60, 120, 480):
        for budget in BUDGETS:
            for energy in ENERGIES:
                for needs in ((), ("step-free",), tuple(ACCESSIBILITY_NEEDS)):
                    for company in COMPANIES:
                        inp, plan = _plan(
                            available_minutes=minutes, budget=budget, energy=energy,
                            accessibility_needs=needs, company=company, interests=("fitness",),
                        )
                        assert plan["total_minutes"] <= minutes
                        assert sum(s["duration_minutes"] for s in plan["steps"]) == plan["total_minutes"]
                        assert ENERGY_RANK[plan["energy_required"]] <= ENERGY_RANK[energy]
                        cap = {"free": 0, "low": 10, "flexible": 100}[budget]
                        assert plan["estimated_cost"]["max"] <= cap
                        assert len(plan["accessibility_adaptations"]) == len(needs)
                        assert plan["backup_plan"]["duration_minutes"] <= minutes


def test_five_minute_request_still_gets_a_plan():
    _, plan = _plan(available_minutes=5, energy="low", budget="free")
    assert plan["total_minutes"] <= 5


def test_interest_overlap_is_reflected_honestly():
    _, matched = _plan(interests=("birdwatching",), energy="low", budget="free", available_minutes=30)
    assert "birdwatching" in matched["why_it_matches"]
    _, unmatched = _plan(interests=("gardening",), energy="low", budget="free", available_minutes=5)
    assert "does not directly cover" in unmatched["why_it_matches"]


def test_accessibility_adaptations_are_included():
    _, plan = _plan(accessibility_needs=("seating", "shade"), energy="low")
    assert len(plan["accessibility_adaptations"]) == 2


def test_group_plans_mention_meeting_point():
    _, plan = _plan(company="group")
    assert any("meeting point" in item.lower() for item in plan["checklist"])


def test_all_interests_and_vocab_are_covered_by_catalogue():
    covered = {i for a in ACTIVITIES for i in a.interests}
    assert covered == set(INTERESTS)
    assert all(BUDGET_RANK[a.budget] >= 0 for a in ACTIVITIES)
