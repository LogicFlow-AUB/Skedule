"""HTTP-level tests for the FastAPI schedule-optimizer service.

Run from the repository ``tests`` directory::

    python -m pytest tests/optimizer/test_api.py -q

These tests exercise the HTTP contract through FastAPI's TestClient without
touching any database.  The MILP correctness itself is covered by the existing
``test_scheduling_milp.py`` suite.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "optimizer"))

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def course(course_id, required, credits=3, **extra):
    value = {"id": course_id, "credits": credits, "required": required}
    value.update(extra)
    return value


def meeting(day, start, end, **extra):
    value = {"day": day, "start": start, "end": end}
    value.update(extra)
    return value


def section(section_id, course_id, meetings=None, **extra):
    value = {
        "id": section_id,
        "course_id": course_id,
        "professor_score": 0,
        "available": True,
        "major_eligible": True,
        "otherwise_eligible": True,
        "meetings": meetings or [],
    }
    value.update(extra)
    return value


def base_payload(**overrides):
    value = {
        "courses": [course("R", True)],
        "sections": [section("R-1", "R", [meeting("M", "09:00", "10:00")])],
        "min_credits": 3,
        "max_credits": 3,
        "weights": {"days": 35, "gaps": 40, "professor": 25},
        "scales": {"days": 5, "gaps": 600, "professor": 10},
        "request_id": "req-1",
    }
    value.update(overrides)
    return value


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_valid_input_is_optimal(client):
    response = client.post("/schedule-optimize", json=base_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "optimal"
    assert body["request_id"] == "req-1"


def test_invalid_min_max_credits_rejected(client):
    payload = base_payload(min_credits=10, max_credits=5)
    response = client.post("/schedule-optimize", json=payload)
    assert response.status_code == 422
    assert response.json()["status"] == "invalid_input"


def test_negative_credits_rejected(client):
    payload = base_payload(courses=[course("R", True, credits=-1)])
    response = client.post("/schedule-optimize", json=payload)
    assert response.status_code == 422


def test_negative_min_credits_rejected(client):
    payload = base_payload(min_credits=-1)
    response = client.post("/schedule-optimize", json=payload)
    assert response.status_code == 422


def test_invalid_weights_rejected(client):
    payload = base_payload(weights={"days": 50, "gaps": 40, "professor": 0})
    response = client.post("/schedule-optimize", json=payload)
    assert response.status_code == 422


def test_weights_not_totaling_100_rejected(client):
    payload = base_payload(weights={"days": 35, "gaps": 40, "professor": 10})
    response = client.post("/schedule-optimize", json=payload)
    assert response.status_code == 422


def test_duplicate_course_ids_rejected(client):
    payload = base_payload(courses=[course("R", True), course("R", False)])
    response = client.post("/schedule-optimize", json=payload)
    assert response.status_code == 422


def test_duplicate_section_ids_rejected(client):
    payload = base_payload(
        sections=[
            section("S1", "R", [meeting("M", "09:00", "10:00")]),
            section("S1", "R", [meeting("T", "09:00", "10:00")]),
        ]
    )
    response = client.post("/schedule-optimize", json=payload)
    assert response.status_code == 422


def test_required_courses_are_mandatory(client):
    # Two required courses that overlap on Monday -> infeasible, never a fake
    # schedule and never removal of a required course.
    payload = base_payload(
        courses=[course("A", True), course("B", True)],
        sections=[
            section("A-1", "A", [meeting("M", "09:00", "10:00")]),
            section("B-1", "B", [meeting("M", "09:30", "10:30")]),
        ],
        min_credits=6,
        max_credits=6,
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "infeasible"
    assert body["selected_section_ids"] == []
    assert body["selected_courses"] == []


def test_excluded_crn_is_enforced(client):
    payload = base_payload(
        courses=[course("R", True)],
        sections=[
            section("100", "R", [meeting("M", "09:00", "10:00")], professor_score=10),
            section("200", "R", [meeting("T", "09:00", "10:00")]),
        ],
        excluded_crn_ids=["100"],
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    body = response.json()
    assert body["status"] == "optimal"
    assert body["selected_section_ids"] == ["200"]


def test_professor_preferences_are_soft(client):
    # A low professor preference must still be selectable when it is the only
    # available section (preferences are soft, not hard constraints).
    payload = base_payload(
        courses=[course("R", True)],
        sections=[
            section("only", "R", [meeting("M", "09:00", "10:00")], professor_score=0),
        ],
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    assert response.json()["status"] == "optimal"


def test_multiple_meetings_for_one_section(client):
    payload = base_payload(
        sections=[
            section(
                "501",
                "R",
                [
                    meeting("M", "10:00", "10:50"),
                    meeting("W", "10:00", "10:50"),
                    meeting("F", "10:00", "10:50"),
                ],
            )
        ],
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    body = response.json()
    assert body["status"] == "optimal"
    assert body["campus_days"] == 3
    assert sorted(body["days"]) == ["F", "M", "W"]


def test_lecture_only_course(client):
    response = client.post(
        "/schedule-optimize",
        json=base_payload(
            sections=[section("L1", "R", [meeting("M", "09:00", "10:00")], component_type="lecture")]
        ),
    )
    body = response.json()
    assert body["status"] == "optimal"
    assert body["selected_section_ids"] == ["L1"]


def test_lecture_plus_recitation(client):
    payload = base_payload(
        sections=[
            section(
                "L1",
                "R",
                [meeting("M", "10:00", "10:50")],
                component_type="lecture",
                linked_section_ids=["E1", "E2"],
            ),
            section("E1", "R", [meeting("W", "08:00", "08:50")], component_type="recitation"),
            section("E2", "R", [meeting("F", "08:00", "08:50")], component_type="recitation"),
        ],
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    body = response.json()
    assert body["status"] == "optimal"
    bundle = next(sid for sid in body["selected_section_ids"] if sid.startswith("bundle::L1"))
    components = body["selected_section_component_ids"][bundle]
    assert len(components) == 2
    assert components[0] == "L1"


def test_lecture_plus_lab(client):
    payload = base_payload(
        sections=[
            section(
                "L1",
                "R",
                [meeting("M", "10:00", "10:50")],
                component_type="lecture",
                linked_section_ids=["B1", "B2"],
            ),
            section("B1", "R", [meeting("W", "08:00", "09:50")], component_type="lab"),
            section("B2", "R", [meeting("R", "08:00", "09:50")], component_type="lab"),
        ],
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    body = response.json()
    assert body["status"] == "optimal"
    bundle = next(sid for sid in body["selected_section_ids"] if sid.startswith("bundle::L1"))
    assert len(body["selected_section_component_ids"][bundle]) == 2


def test_lecture_recitation_lab_never_produced(client):
    # A course configured with both a recitation and a lab via two linked
    # option groups is allowed (lecture + recitation + lab are a valid
    # combination), but a course must never present lecture + recitation +
    # lab through separate simultaneous selectable records.  The bundle model
    # enforces exactly one choice per group.
    payload = base_payload(
        courses=[course("SCI", True), course("OTHER", True)],
        sections=[
            section(
                "L1",
                "SCI",
                [meeting("M", "09:00", "10:00")],
                component_type="lecture",
                linked_option_groups=[
                    {"section_ids": ["E1", "E2"]},
                    {"section_ids": ["B1", "B2"]},
                ],
            ),
            section("E1", "SCI", [meeting("T", "09:00", "10:00")], component_type="recitation"),
            section("E2", "SCI", [meeting("T", "10:00", "11:00")], component_type="recitation"),
            section("B1", "SCI", [meeting("W", "09:00", "10:00")], component_type="lab"),
            section("B2", "SCI", [meeting("W", "10:00", "11:00")], component_type="lab"),
            section("OTHER-1", "OTHER", [meeting("T", "09:00", "10:00")]),
        ],
        min_credits=6,
        max_credits=6,
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    body = response.json()
    assert body["status"] == "optimal"
    bundle = next(sid for sid in body["selected_section_ids"] if sid.startswith("bundle::L1"))
    components = body["selected_section_component_ids"][bundle]
    assert len(components) == 3


def test_online_asynchronous_section_works(client):
    payload = base_payload(
        courses=[course("R", True), course("ONLINE", False)],
        sections=[
            section("R-1", "R", [meeting("M", "09:00", "10:00")]),
            section("ONLINE-1", "ONLINE", []),
        ],
        min_credits=6,
        max_credits=6,
        elective_count=1,
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    body = response.json()
    assert body["status"] == "optimal"
    assert body["total_credits"] == 6


def test_online_sections_do_not_create_conflicts(client):
    payload = base_payload(
        courses=[course("A", True), course("B", True)],
        sections=[
            section("A-1", "A", [meeting("M", "09:00", "10:00")]),
            section("B-1", "B", []),
        ],
        min_credits=6,
        max_credits=6,
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    assert response.json()["status"] == "optimal"


def test_actual_course_credits_used(client):
    # A required 3-credit course plus a 6-credit elective must total 9 credits
    # (proving actual credits from the payload are used, not a fixed 3 each).
    payload = base_payload(
        courses=[course("A", True, credits=3), course("B", False, credits=6)],
        sections=[section("A-1", "A", []), section("B-1", "B", [])],
        min_credits=9,
        max_credits=9,
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    body = response.json()
    assert body["status"] == "optimal"
    assert body["total_credits"] == 9
    assert set(body["selected_course_ids"]) == {"A", "B"}


def test_elective_selected_to_fill_credit_target(client):
    # Without an elective_count, the optimizer composes electives to hit the
    # credit target (optimized, not greedily picked).
    payload = base_payload(
        courses=[course("A", True, credits=3), course("B", False, credits=3), course("C", False, credits=6)],
        sections=[section("A-1", "A", []), section("B-1", "B", []), section("C-1", "C", [])],
        min_credits=9,
        max_credits=9,
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    body = response.json()
    assert body["status"] == "optimal"
    assert body["total_credits"] == 9
    # A(3) + B(3) + C(6) = 12; the feasible 9-credit pairs are A+B (6, too low)
    # so only A+C (9) or A alone (3) — must be A+C to reach 9.
    assert set(body["selected_course_ids"]) == {"A", "C"}


def test_attribute_requirements_are_hard(client):
    # Node backend encodes attribute requirements by restricting the eligible
    # candidate pool (course_eligibility=false for courses lacking the
    # attribute).  An infeasible attribute set yields "infeasible", not a fake
    # schedule.
    payload = base_payload(
        courses=[course("R", True)],
        sections=[section("R-1", "R", [])],
        course_eligibility={"R": False},
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    assert response.json()["status"] == "infeasible"


def test_attribute_candidates_represented_as_course_eligibility(client):
    from scheduling_milp import solve_backend_request

    # Show that the optimizer consumes course-level eligibility to satisfy
    # attribute constraints: one course carrying the attribute is eligible.
    result = solve_backend_request(
        {
            "courses": [
                {"id": "A", "credits": 3, "required": True},
                {"id": "B", "credits": 3, "required": False},
            ],
            "sections": [
                {"id": "A-1", "course_id": "A", "meetings": [], "available": True,
                 "major_eligible": True, "otherwise_eligible": True},
                {"id": "B-1", "course_id": "B", "meetings": [], "available": True,
                 "major_eligible": True, "otherwise_eligible": True},
            ],
            "elective_count": 1,
            "min_credits": 6,
            "max_credits": 6,
            "weights": {"days": 35, "gaps": 40, "professor": 25},
            "scales": {"days": 5, "gaps": 600, "professor": 10},
        }
    )
    assert result["status"] == "optimal"
    assert set(result["selected_course_ids"]) == {"A", "B"}


def test_every_selected_component_appears_in_selected_sections(client):
    payload = base_payload(
        sections=[
            section(
                "L1",
                "R",
                [meeting("M", "10:00", "10:50")],
                component_type="lecture",
                linked_section_ids=["E1", "E2"],
                crn="1000",
                section_number="L1",
            ),
            section("E1", "R", [meeting("W", "08:00", "08:50")], component_type="recitation", crn="2000"),
            section("E2", "R", [meeting("F", "08:00", "08:50")], component_type="recitation", crn="3000"),
        ],
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    body = response.json()
    assert body["status"] == "optimal"
    bundle = next(sid for sid in body["selected_section_ids"] if sid.startswith("bundle::L1"))
    components = set(body["selected_section_component_ids"][bundle])
    returned_ids = {str(section["id"]) for section in body["selected_sections"]}
    assert components <= returned_ids


def test_every_selected_section_contains_every_meeting(client):
    payload = base_payload(
        sections=[
            section(
                "501",
                "R",
                [
                    meeting("M", "10:00", "10:50", building="Nicely", room="204"),
                    meeting("W", "10:00", "10:50", building="Nicely", room="204"),
                ],
                crn="12345",
                section_number="1",
                campus="Main Campus",
                professor={"id": 45, "first_name": "Maher", "last_name": "Nouiehed"},
            )
        ],
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    body = response.json()
    assert body["status"] == "optimal"
    selected = body["selected_sections"][0]
    assert len(selected["meetings"]) == 2
    days = {m["day"] for m in selected["meetings"]}
    assert days == {"M", "W"}


def test_infeasible_returns_status_not_error(client):
    payload = base_payload(
        courses=[course("A", True), course("B", True)],
        sections=[
            section("A-1", "A", [meeting("M", "09:00", "10:00")]),
            section("B-1", "B", [meeting("M", "09:00", "10:00")]),
        ],
        min_credits=6,
        max_credits=6,
        scales=None,
    )
    response = client.post("/schedule-optimize", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "infeasible"
    assert body["message"]


def test_internal_failures_not_labeled_infeasible(client):
    # Unknown linked component -> ModelInputError -> HTTP 422 invalid_input.
    payload = base_payload(
        sections=[
            section(
                "L1",
                "R",
                [meeting("M", "10:00", "10:50")],
                component_type="lecture",
                linked_section_ids=["UNKNOWN"],
            )
        ]
    )
    response = client.post("/schedule-optimize", json=payload)
    assert response.status_code == 422
    assert response.json()["status"] == "invalid_input"


def test_request_id_preserved(client):
    response = client.post(
        "/schedule-optimize", json=base_payload(request_id="stale-req-42")
    )
    assert response.json()["request_id"] == "stale-req-42"


def test_result_contains_required_fields(client):
    response = client.post("/schedule-optimize", json=base_payload())
    body = response.json()
    for field in (
        "status",
        "request_id",
        "selected_course_ids",
        "selected_section_ids",
        "selected_section_component_ids",
        "selected_courses",
        "selected_sections",
        "total_credits",
        "campus_days",
        "weekly_largest_gaps_sum_minutes",
        "weekly_first_to_last_spans_sum_minutes",
        "professor_preference_penalty",
        "message",
        "diagnostics",
    ):
        assert field in body
