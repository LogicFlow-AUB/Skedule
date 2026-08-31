"""Student scheduling MILP from Tony Kassis's mathematical formulation.

The module is intentionally independent of any database or web framework.
The backend only needs to build the request dictionary documented in
``solve_schedule`` and consume the returned dictionary.

Install the solver with::

    pip install -r requirements.txt
"""

from __future__ import annotations

from collections import defaultdict
from itertools import product
from typing import Any, Iterable

import pulp


class ModelInputError(ValueError):
    """Raised when the request cannot define the scheduling MILP."""


def _as_minutes(value: Any) -> int:
    """Convert an integer minute value or an HH:MM string to minutes."""
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value
    if isinstance(value, str):
        parts = value.strip().split(":")
        if len(parts) == 2 and all(part.isdigit() for part in parts):
            hour, minute = map(int, parts)
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return 60 * hour + minute
    raise ModelInputError(f"Invalid time {value!r}; use integer minutes or HH:MM.")


def _require_bool(value: Any, label: str) -> bool:
    """Require a JSON boolean instead of coercing arbitrary truthy values."""
    if not isinstance(value, bool):
        raise ModelInputError(f"{label} must be a boolean.")
    return value


def _require_nonnegative_integer(value: Any, label: str) -> int:
    """Require a nonnegative integer and reject booleans and truncation."""
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ModelInputError(f"{label} must be a nonnegative integer.")
    return value


def _value(variable: pulp.LpVariable) -> float:
    value = pulp.value(variable)
    if value is None:
        raise RuntimeError("The solver did not assign a value to a decision variable.")
    return float(value)


def _selected(variable: pulp.LpVariable) -> bool:
    return _value(variable) > 0.5


def _selected_timetable_metrics(
    days: list[str],
    occurrences_by_day: dict[str, list[str]],
    occurrences: dict[str, dict[str, Any]],
    y: dict[str, pulp.LpVariable],
) -> tuple[dict[str, dict[str, Any]], float, float]:
    """Calculate display metrics from selected meetings, not solver auxiliaries.

    This remains reliable when a metric has a zero objective weight and CBC
    presolve therefore does not assign a value to its auxiliary variable.
    """
    day_metrics: dict[str, dict[str, Any]] = {}
    weekly_gap = 0.0
    weekly_span = 0.0
    for day in days:
        chosen = sorted(
            (occurrences[aid] for aid in occurrences_by_day[day] if _selected(y[aid])),
            key=lambda item: (item["start"], item["end"], item["section_id"]),
        )
        if not chosen:
            continue
        consecutive_gaps = [
            right["start"] - left["end"] for left, right in zip(chosen, chosen[1:])
        ]
        largest_gap = max(consecutive_gaps, default=0)
        span = chosen[-1]["end"] - chosen[0]["start"]
        weekly_gap += largest_gap
        weekly_span += span
        day_metrics[day] = {
            "largest_gap_minutes": largest_gap,
            "first_to_last_span_minutes": span,
            "meetings": [
                {
                    "section_id": item["section_id"],
                    "start": item["start"],
                    "end": item["end"],
                }
                for item in chosen
            ],
        }
    return day_metrics, weekly_gap, weekly_span


def _require_keys(item: dict[str, Any], keys: Iterable[str], label: str) -> None:
    missing = [key for key in keys if key not in item]
    if missing:
        raise ModelInputError(f"{label} is missing: {', '.join(missing)}")


def expand_linked_section_bundles(raw_sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Turn raw lecture/component records into selectable, all-meeting bundles.

    A primary section (normally a lecture) can provide ``linked_option_groups``:
    ``[{"section_ids": ["E1", "E2"]}, {"section_ids": ["B1", "B2"]}]``.
    Exactly one item is selected from every group, so the example produces four
    bundles: lecture + one recitation + one lab. ``linked_section_ids`` is a
    shorthand for one such group and is accepted only on a ``lecture`` record.
    """
    by_id: dict[str, dict[str, Any]] = {}
    for raw_section in raw_sections:
        if not isinstance(raw_section, dict) or "id" not in raw_section:
            raise ModelInputError("Every raw section must be a dictionary with an id.")
        section_id = str(raw_section["id"])
        if section_id in by_id:
            raise ModelInputError(f"Duplicate section id {section_id!r}.")
        by_id[section_id] = dict(raw_section)

    normalized_groups: dict[str, list[list[str]]] = {}
    component_ids: set[str] = set()
    for section_id, raw_section in by_id.items():
        groups = raw_section.get("linked_option_groups")
        if groups is None and "linked_section_ids" in raw_section:
            if raw_section.get("component_type") != "lecture":
                # Reciprocal child links, such as E1 -> L1, are metadata rather
                # than an instruction to create another bundle.
                continue
            groups = [{"section_ids": raw_section["linked_section_ids"]}]
        if groups is None:
            continue
        if not isinstance(groups, list) or not groups:
            raise ModelInputError(f"Section {section_id!r} linked_option_groups must be a nonempty list.")
        normalized_groups[section_id] = []
        for group_number, group in enumerate(groups):
            if not isinstance(group, dict) or not isinstance(group.get("section_ids"), list):
                raise ModelInputError(
                    f"Section {section_id!r} linked option group {group_number} needs a section_ids list."
                )
            options = [str(option_id) for option_id in group["section_ids"]]
            if not options:
                raise ModelInputError(f"Section {section_id!r} has an empty linked option group.")
            unknown = set(options) - set(by_id)
            if unknown:
                raise ModelInputError(f"Section {section_id!r} links unknown sections: {sorted(unknown)}")
            if any(str(by_id[option_id].get("course_id")) != str(raw_section.get("course_id")) for option_id in options):
                raise ModelInputError(f"All linked components for {section_id!r} must belong to the same course.")
            normalized_groups[section_id].append(options)
            component_ids.update(options)

    expanded: list[dict[str, Any]] = []
    for section_id, raw_section in by_id.items():
        if section_id in component_ids and section_id not in normalized_groups:
            # A recitation/lab is only selectable through its primary bundle.
            continue
        if section_id not in normalized_groups:
            direct_section = dict(raw_section)
            direct_section.setdefault("component_section_ids", [section_id])
            expanded.append(direct_section)
            continue
        for selected_options in product(*normalized_groups[section_id]):
            components = [raw_section] + [by_id[option_id] for option_id in selected_options]
            component_section_ids = [str(component["id"]) for component in components]
            bundle = dict(raw_section)
            bundle["id"] = "bundle::" + "::".join(component_section_ids)
            bundle["component_section_ids"] = component_section_ids
            bundle["meetings"] = [
                meeting
                for component in components
                for meeting in component.get("meetings", [])
            ]
            # A bundle can be selected only if every required component is.
            for eligibility_field in ("available", "major_eligible", "otherwise_eligible"):
                bundle[eligibility_field] = all(
                    component.get(eligibility_field) is True for component in components
                )
            bundle["student_infeasible"] = any(
                component.get("student_infeasible", False) is True for component in components
            )
            expanded.append(bundle)
    return expanded


def _automatic_scales(
    occurrences_by_day: dict[str, list[str]],
    occurrences: dict[str, dict[str, Any]],
    professor_penalty: dict[str, float],
    sections_by_course: dict[str, list[str]],
    required_courses: set[str],
    elective_courses: set[str],
) -> dict[str, float]:
    """Return positive, valid upper bounds for the three objective penalties."""
    time_bound = sum(
        max(occurrences[aid]["end"] for aid in day_ids)
        - min(occurrences[aid]["start"] for aid in day_ids)
        for day_ids in occurrences_by_day.values()
    )
    course_penalties = {
        cid: max(professor_penalty[sid] for sid in section_ids)
        for cid, section_ids in sections_by_course.items()
    }
    professor_bound = sum(course_penalties[cid] for cid in required_courses)
    # With credit-based elective selection, every elective could theoretically
    # be selected, so summing all elective maxima remains a valid upper bound.
    professor_bound += sum(course_penalties[cid] for cid in elective_courses)
    return {
        "gaps": max(1.0, float(time_bound)),
        "days": max(1.0, float(len(occurrences_by_day))),
        "professor": max(1.0, float(professor_bound)),
    }


def _infeasibility_diagnostics(request: dict[str, Any], status: str) -> dict[str, Any]:
    """Return only diagnoses that are directly supported by a re-solve/check."""
    diagnostics: dict[str, Any] = {"solver_status": status}
    course_eligibility = request.get("course_eligibility", {})
    required_without_eligible_sections = []
    courses = {str(course["id"]): course for course in request["courses"]}
    # Use the same bundle expansion and CRN-exclusion logic as the MILP.  A
    # required lecture can otherwise look available in raw data even though
    # every valid lecture/recitation bundle is ruled out by a component CRN.
    excluded_crn_ids = {str(crn) for crn in request.get("excluded_crn_ids", [])}
    sections_by_course: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for section in expand_linked_section_bundles(request["sections"]):
        sections_by_course[str(section["course_id"])].append(section)

    def candidate_is_eligible(section: dict[str, Any]) -> bool:
        component_ids = {
            str(component_id)
            for component_id in section.get("component_section_ids", [section["id"]])
        }
        return (
            section["available"] is True
            and section["major_eligible"] is True
            and section["otherwise_eligible"] is True
            and section.get("student_infeasible", False) is not True
            and not (component_ids & excluded_crn_ids)
        )

    for course_id, course in courses.items():
        if not course["required"]:
            continue
        course_allowed = course_eligibility.get(course_id, True)
        eligible = any(candidate_is_eligible(section) for section in sections_by_course[course_id])
        if not course_allowed or not eligible:
            required_without_eligible_sections.append(course_id)
    if required_without_eligible_sections:
        diagnostics["required_courses_without_eligible_sections"] = sorted(
            required_without_eligible_sections
        )
        return diagnostics

    requested_count = request.get("elective_count")
    eligible_electives = []
    for course_id, course in courses.items():
        if course["required"]:
            continue
        course_allowed = course_eligibility.get(course_id, True)
        has_eligible_section = any(
            candidate_is_eligible(section) for section in sections_by_course[course_id]
        )
        if course_allowed and has_eligible_section:
            eligible_electives.append(course_id)
    if requested_count is not None and len(eligible_electives) < requested_count:
        diagnostics["eligible_elective_shortage"] = {
            "requested": requested_count,
            "eligible_elective_course_ids": sorted(eligible_electives),
        }
        return diagnostics

    required_credits = sum(
        float(course["credits"]) for course in courses.values() if course["required"]
    )
    elective_credits = [float(courses[course_id]["credits"]) for course_id in eligible_electives]
    if requested_count is None:
        minimum_possible_credits = required_credits
        maximum_possible_credits = required_credits + sum(elective_credits)
    else:
        elective_credits.sort()
        minimum_possible_credits = required_credits + sum(elective_credits[:requested_count])
        maximum_possible_credits = required_credits + sum(elective_credits[-requested_count:])
    if minimum_possible_credits > float(request["max_credits"]):
        diagnostics["credit_load_conflict"] = {
            "minimum_possible_credits": minimum_possible_credits,
            "max_credits": float(request["max_credits"]),
        }
        return diagnostics
    if maximum_possible_credits < float(request["min_credits"]):
        diagnostics["credit_load_conflict"] = {
            "maximum_possible_credits": maximum_possible_credits,
            "min_credits": float(request["min_credits"]),
        }
        return diagnostics

    # An exact target can still be impossible because available credit values
    # cannot compose it (e.g., 9 required credits plus only 3-credit electives
    # cannot make exactly 14). Re-solve a broad credit interval to prove that
    # the exact target itself is the restrictive condition.
    if float(request["min_credits"]) == float(request["max_credits"]):
        relaxed_request = dict(request)
        relaxed_request["min_credits"] = required_credits
        relaxed_request["max_credits"] = maximum_possible_credits
        relaxed_request["_skip_infeasibility_diagnosis"] = True
        relaxed_result = solve_schedule(relaxed_request)
        if relaxed_result["status"] == "optimal":
            diagnostics["exact_credit_target_relaxation"] = {
                "requested_credits": float(request["min_credits"]),
                "feasible_credits": relaxed_result["total_credits"],
                "suggested_selected_course_ids": relaxed_result["selected_course_ids"],
            }
            return diagnostics

    if requested_count is None or requested_count == 0:
        return diagnostics
    # Relax exactly one elective at a time. A successful re-solve proves that
    # the requested elective load, not a named course, is the obstacle.
    for relaxed_count in range(requested_count - 1, -1, -1):
        relaxed_request = dict(request)
        relaxed_request["elective_count"] = relaxed_count
        relaxed_request["_skip_infeasibility_diagnosis"] = True
        relaxed_result = solve_schedule(relaxed_request)
        if relaxed_result["status"] == "optimal":
            diagnostics["elective_count_relaxation"] = {
                "requested": requested_count,
                "feasible_with": relaxed_count,
                "electives_to_remove": requested_count - relaxed_count,
                "suggested_selected_course_ids": relaxed_result["selected_course_ids"],
            }
            return diagnostics
    return diagnostics


def solve_schedule(request: dict[str, Any]) -> dict[str, Any]:
    """Build and solve the student-scheduling MILP.

    Required request fields
    -----------------------
    courses:
        List of {id, credits, required}. Electives have required=false.
    sections:
        List of section dictionaries. Each requires id, course_id, meetings,
        available, major_eligible, and otherwise_eligible. ``meetings`` is a
        list of {day, start, end}. A section can optionally contain
        ``professor_id`` and ``professor_score`` (larger score is preferred).
    elective_count:
        Optional exact K selected from the non-required course pool. Omit this
        for credit-based elective selection.
    min_credits, max_credits:
        Permitted total credit interval [L, U].
    weights:
        {days, gaps, professor}; values must be nonnegative and total 100.
    scales:
        Optional positive normalization constants {days, gaps, professor}.
        When omitted, mathematically valid bounds are calculated from the
        request's meetings and professor scores.

    Optional request fields
    -----------------------
    course_eligibility:
        Mapping course_id -> bool (defaults to true).
    max_occurrences_per_day:
        Either one integer or a mapping day -> integer.
    requirement_groups:
        List of {course_ids, min, max} for additional curriculum rules.
    corequisites:
        List of {course_id, corequisite_id, already_completed}; enforces
        u_i <= completed + u_j.
    time_limit_seconds:
        Solver time limit (default 30 seconds).
    excluded_crn_ids:
        Original CRN/section IDs explicitly rejected by the student. Matching
        candidates, including linked bundles containing those CRNs, are forced
        to zero in the MILP.
    """
    for key in (
        "courses",
        "sections",
        "min_credits",
        "max_credits",
        "weights",
    ):
        if key not in request:
            raise ModelInputError(f"Request is missing {key!r}.")

    weights = request["weights"]
    scales = request.get("scales")
    if not isinstance(weights, dict):
        raise ModelInputError("weights must be a dictionary.")
    if scales is not None and not isinstance(scales, dict):
        raise ModelInputError("scales must be a dictionary when supplied.")
    for key in ("days", "gaps", "professor"):
        if key not in weights:
            raise ModelInputError(f"weights must contain {key!r}.")
        if float(weights[key]) < 0:
            raise ModelInputError("Objective weights must be nonnegative.")
        if scales is not None and (key not in scales or float(scales[key]) <= 0):
            raise ModelInputError("Objective normalization scales must be positive.")
    if abs(sum(float(weights[key]) for key in weights if key in {"days", "gaps", "professor"}) - 100.0) > 1e-6:
        raise ModelInputError("The days, gaps, and professor weights must total 100%.")

    if not isinstance(request["courses"], list) or not isinstance(request["sections"], list):
        raise ModelInputError("courses and sections must be lists.")
    raw_sections = expand_linked_section_bundles(request["sections"])
    excluded_crn_ids = request.get("excluded_crn_ids", [])
    if not isinstance(excluded_crn_ids, list):
        raise ModelInputError("excluded_crn_ids must be a list when supplied.")
    raw_crn_ids = {str(section["id"]) for section in request["sections"]}
    excluded_crn_ids = {str(crn) for crn in excluded_crn_ids}
    unknown_excluded_crns = excluded_crn_ids - raw_crn_ids
    if unknown_excluded_crns:
        raise ModelInputError(
            f"excluded_crn_ids contains unknown CRNs: {sorted(unknown_excluded_crns)}"
        )
    min_credits = float(request["min_credits"])
    max_credits = float(request["max_credits"])
    if min_credits > max_credits:
        raise ModelInputError("min_credits cannot exceed max_credits.")

    courses: dict[str, dict[str, Any]] = {}
    for raw_course in request["courses"]:
        _require_keys(raw_course, ("id", "credits", "required"), "A course")
        course_id = str(raw_course["id"])
        if course_id in courses:
            raise ModelInputError(f"Duplicate course id {course_id!r}.")
        course = dict(raw_course)
        course["id"] = course_id
        course["credits"] = float(course["credits"])
        if course["credits"] < 0:
            raise ModelInputError(f"Course {course_id!r} has negative credits.")
        course["required"] = _require_bool(course["required"], f"Course {course_id!r} required")
        courses[course_id] = course

    required_courses = {cid for cid, c in courses.items() if bool(c["required"])}
    elective_courses = set(courses) - required_courses
    elective_count = request.get("elective_count")
    if elective_count is not None:
        elective_count = _require_nonnegative_integer(elective_count, "elective_count")
        if elective_count > len(elective_courses):
            raise ModelInputError("elective_count must lie between 0 and the elective-pool size.")

    sections: dict[str, dict[str, Any]] = {}
    sections_by_course: dict[str, list[str]] = defaultdict(list)
    occurrences: dict[str, dict[str, Any]] = {}
    occurrences_by_day: dict[str, list[str]] = defaultdict(list)

    for raw_section in raw_sections:
        _require_keys(
            raw_section,
            ("id", "course_id", "meetings", "available", "major_eligible", "otherwise_eligible"),
            "A section",
        )
        section_id = str(raw_section["id"])
        course_id = str(raw_section["course_id"])
        if section_id in sections:
            raise ModelInputError(f"Duplicate section id {section_id!r}.")
        if course_id not in courses:
            raise ModelInputError(f"Section {section_id!r} refers to unknown course {course_id!r}.")
        section = dict(raw_section)
        section["id"] = section_id
        section["course_id"] = course_id
        section["component_section_ids"] = [
            str(component_id) for component_id in section.get("component_section_ids", [section_id])
        ]
        section["student_infeasible"] = (
            _require_bool(
                section.get("student_infeasible", False),
                f"Section {section_id!r} student_infeasible",
            )
            or bool(set(section["component_section_ids"]) & excluded_crn_ids)
        )
        section["eligible"] = int(
            _require_bool(section["available"], f"Section {section_id!r} available")
            and _require_bool(section["major_eligible"], f"Section {section_id!r} major_eligible")
            and _require_bool(section["otherwise_eligible"], f"Section {section_id!r} otherwise_eligible")
            and not section["student_infeasible"]
        )
        sections[section_id] = section
        sections_by_course[course_id].append(section_id)

        if not isinstance(section["meetings"], list):
            raise ModelInputError(f"Section {section_id!r} meetings must be a list.")
        for number, raw_meeting in enumerate(section["meetings"]):
            _require_keys(raw_meeting, ("day", "start", "end"), f"Meeting in section {section_id}")
            day = str(raw_meeting["day"])
            start = _as_minutes(raw_meeting["start"])
            end = _as_minutes(raw_meeting["end"])
            if end <= start:
                raise ModelInputError(f"Meeting {section_id}/{number} must end after it starts.")
            occurrence_id = f"{section_id}::{day}::{number}"
            occurrences[occurrence_id] = {
                "id": occurrence_id,
                "section_id": section_id,
                "day": day,
                "start": start,
                "end": end,
            }
            occurrences_by_day[day].append(occurrence_id)

    for course_id in courses:
        if not sections_by_course[course_id]:
            raise ModelInputError(f"Candidate course {course_id!r} has no sections.")

    # Student-specific within-course professor penalty p_s = max(r) - r_s.
    professor_penalty: dict[str, float] = {}
    for course_id, section_ids in sections_by_course.items():
        eligible_ids = [sid for sid in section_ids if sections[sid]["eligible"]]
        score_pool = eligible_ids or section_ids
        best_score = max(float(sections[sid].get("professor_score", 0.0)) for sid in score_pool)
        for section_id in section_ids:
            score = float(sections[section_id].get("professor_score", 0.0))
            professor_penalty[section_id] = max(0.0, best_score - score)

    if scales is None:
        scales = _automatic_scales(
            occurrences_by_day,
            occurrences,
            professor_penalty,
            sections_by_course,
            required_courses,
            elective_courses,
        )

    # C: unordered section pairs with at least one overlapping occurrence.
    conflict_pairs: set[tuple[str, str]] = set()
    for day_occurrences in occurrences_by_day.values():
        for index, aid in enumerate(day_occurrences):
            a = occurrences[aid]
            for bid in day_occurrences[index + 1 :]:
                b = occurrences[bid]
                if a["section_id"] == b["section_id"]:
                    continue
                if a["start"] < b["end"] and b["start"] < a["end"]:
                    conflict_pairs.add(tuple(sorted((a["section_id"], b["section_id"]))))

    # F_d: every chronologically feasible directed occurrence pair.
    arcs_by_day: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for day, day_occurrences in occurrences_by_day.items():
        for aid in day_occurrences:
            for bid in day_occurrences:
                if aid != bid and occurrences[aid]["end"] <= occurrences[bid]["start"]:
                    arcs_by_day[day].append((aid, bid))

    solver = pulp.LpProblem("student_schedule", pulp.LpMinimize)
    time_limit_seconds = float(request.get("time_limit_seconds", 30))
    if time_limit_seconds < 0:
        raise ModelInputError("time_limit_seconds must be nonnegative.")
    solver_messages = request.get("solver_messages", False)
    solver_messages = _require_bool(solver_messages, "solver_messages")

    u = {cid: pulp.LpVariable(f"u[{cid}]", cat=pulp.LpBinary) for cid in courses}
    x = {sid: pulp.LpVariable(f"x[{sid}]", cat=pulp.LpBinary) for sid in sections}
    y = {aid: pulp.LpVariable(f"y[{aid}]", cat=pulp.LpBinary) for aid in occurrences}
    days = sorted(occurrences_by_day)
    v = {day: pulp.LpVariable(f"v[{day}]", cat=pulp.LpBinary) for day in days}
    first = {aid: pulp.LpVariable(f"first[{aid}]", cat=pulp.LpBinary) for aid in occurrences}
    last = {aid: pulp.LpVariable(f"last[{aid}]", cat=pulp.LpBinary) for aid in occurrences}
    z = {
        (aid, bid): pulp.LpVariable(f"z[{aid}->{bid}]", cat=pulp.LpBinary)
        for day in days
        for aid, bid in arcs_by_day[day]
    }
    gap_day = {day: pulp.LpVariable(f"G[{day}]", lowBound=0) for day in days}

    # M1--M7: academic selection, load, eligibility, and conflicts.
    for cid, section_ids in sections_by_course.items():
        solver += pulp.lpSum(x[sid] for sid in section_ids) == u[cid]
    for cid in required_courses:
        solver += u[cid] == 1
    if elective_count is not None:
        solver += pulp.lpSum(u[cid] for cid in elective_courses) == elective_count
    total_credits = pulp.lpSum(courses[cid]["credits"] * u[cid] for cid in courses)
    solver += total_credits >= min_credits
    solver += total_credits <= max_credits
    course_eligibility = request.get("course_eligibility", {})
    if not isinstance(course_eligibility, dict):
        raise ModelInputError("course_eligibility must be a mapping when supplied.")
    for cid in courses:
        eligible = _require_bool(
            course_eligibility.get(cid, True),
            f"course_eligibility[{cid!r}]",
        )
        solver += u[cid] <= int(eligible)
    for sid, section in sections.items():
        solver += x[sid] <= section["eligible"]
    for sid, tid in conflict_pairs:
        solver += x[sid] + x[tid] <= 1

    # Optional curriculum groups and co-requisites.
    for index, group in enumerate(request.get("requirement_groups", [])):
        group_ids = [str(cid) for cid in group["course_ids"]]
        unknown = set(group_ids) - set(courses)
        if unknown:
            raise ModelInputError(f"Requirement group {index} has unknown courses: {sorted(unknown)}")
        solver += pulp.lpSum(u[cid] for cid in group_ids) >= int(group["min"])
        solver += pulp.lpSum(u[cid] for cid in group_ids) <= int(group["max"])
    for rule in request.get("corequisites", []):
        cid = str(rule["course_id"])
        coreq = str(rule["corequisite_id"])
        if cid not in courses or coreq not in courses:
            raise ModelInputError(f"Unknown course in co-requisite rule {rule!r}.")
        completed = _require_bool(
            rule.get("already_completed", False),
            f"Corequisite rule for {cid!r} already_completed",
        )
        solver += u[cid] <= int(completed) + u[coreq]

    # M8--M16: occurrence activation and a forward path on every active day.
    for aid, occurrence in occurrences.items():
        solver += y[aid] == x[occurrence["section_id"]]
        solver += first[aid] <= y[aid]
        solver += last[aid] <= y[aid]

    max_per_day = request.get("max_occurrences_per_day")
    for day in days:
        day_ids = occurrences_by_day[day]
        for aid in day_ids:
            solver += y[aid] <= v[day]
        solver += v[day] <= pulp.lpSum(y[aid] for aid in day_ids)
        solver += pulp.lpSum(first[aid] for aid in day_ids) == v[day]
        solver += pulp.lpSum(last[aid] for aid in day_ids) == v[day]
        if max_per_day is not None:
            limit = max_per_day.get(day) if isinstance(max_per_day, dict) else max_per_day
            if limit is not None:
                solver += pulp.lpSum(y[aid] for aid in day_ids) <= int(limit)

        outgoing: dict[str, list[pulp.LpVariable]] = defaultdict(list)
        incoming: dict[str, list[pulp.LpVariable]] = defaultdict(list)
        for aid, bid in arcs_by_day[day]:
            outgoing[aid].append(z[(aid, bid)])
            incoming[bid].append(z[(aid, bid)])
            solver += z[(aid, bid)] <= y[aid]
            solver += z[(aid, bid)] <= y[bid]
            idle = occurrences[bid]["start"] - occurrences[aid]["end"]
            solver += gap_day[day] >= idle * z[(aid, bid)]
        for aid in day_ids:
            solver += pulp.lpSum(outgoing[aid]) + last[aid] == y[aid]
            solver += pulp.lpSum(incoming[aid]) + first[aid] == y[aid]

    weekly_gap = pulp.lpSum(gap_day.values())
    campus_days = pulp.lpSum(v.values())
    preference_penalty = pulp.lpSum(professor_penalty[sid] * x[sid] for sid in sections)
    objective = (
        (float(weights["days"]) / 100.0 / float(scales["days"])) * campus_days
        + (float(weights["gaps"]) / 100.0 / float(scales["gaps"])) * weekly_gap
        + (float(weights["professor"]) / 100.0 / float(scales["professor"]))
        * preference_penalty
    )
    solver += objective

    status_code = solver.solve(
        pulp.PULP_CBC_CMD(msg=solver_messages, timeLimit=time_limit_seconds)
    )
    status_names = {
        pulp.LpStatusOptimal: "optimal",
        pulp.LpStatusInfeasible: "infeasible",
        pulp.LpStatusUnbounded: "unbounded",
        pulp.LpStatusNotSolved: "not_solved",
        pulp.LpStatusUndefined: "undefined",
    }
    status = status_names.get(status_code, f"unknown_{status_code}")
    if status_code != pulp.LpStatusOptimal:
        result: dict[str, Any] = {"status": status, "message": "No feasible schedule was produced."}
        if status == "infeasible" and not request.get("_skip_infeasibility_diagnosis", False):
            result["diagnostics"] = _infeasibility_diagnostics(request, status)
        return result

    selected_section_ids = sorted(sid for sid in sections if _selected(x[sid]))
    selected_course_ids = sorted(cid for cid in courses if _selected(u[cid]))
    day_metrics, weekly_gap_value, weekly_span_value = _selected_timetable_metrics(
        days, occurrences_by_day, occurrences, y
    )

    return {
        "status": status,
        "selected_course_ids": selected_course_ids,
        "selected_section_ids": selected_section_ids,
        "selected_section_component_ids": {
            sid: sections[sid]["component_section_ids"] for sid in selected_section_ids
        },
        "total_credits": sum(courses[cid]["credits"] for cid in selected_course_ids),
        "weekly_largest_gaps_sum_minutes": round(weekly_gap_value, 6),
        "weekly_first_to_last_spans_sum_minutes": round(weekly_span_value, 6),
        "professor_preference_penalty": round(
            sum(professor_penalty[sid] for sid in selected_section_ids), 6
        ),
        "campus_days": len(day_metrics),
        "days": day_metrics,
    }


def solve_backend_request(request: dict[str, Any]) -> dict[str, Any]:
    """Solve one backend request and return the full chosen course/section records.

    This is the function the web backend should call.  It uses exactly the
    same MILP as :func:`solve_schedule`, but also echoes the original records
    that were chosen.  Therefore the backend can include display information
    such as CRN, section number, professor, campus, room, and meeting dates in
    each input section; the optimizer returns those fields unchanged only for
    the selected records.

    The MILP itself only reads the documented scheduling fields.  Extra fields
    are deliberately preserved for the response and never affect feasibility
    or the objective unless the backend translates them into a documented
    scheduling field (for example, ``available`` or ``professor_score``).
    """
    result = dict(solve_schedule(request))

    # solve_schedule has already validated duplicate IDs before this point.
    # Preserve the request's order so the backend receives deterministic data.
    if result["status"] != "optimal":
        result["selected_courses"] = []
        result["selected_sections"] = []
        if "request_id" in request:
            result["request_id"] = request["request_id"]
        return result

    selected_course_ids = {str(course_id) for course_id in result["selected_course_ids"]}
    selected_component_ids = {
        str(component_id)
        for component_ids in result["selected_section_component_ids"].values()
        for component_id in component_ids
    }
    result["selected_courses"] = [
        dict(course)
        for course in request["courses"]
        if str(course["id"]) in selected_course_ids
    ]
    result["selected_sections"] = [
        dict(section)
        for section in request["sections"]
        if str(section["id"]) in selected_component_ids
    ]
    if "request_id" in request:
        result["request_id"] = request["request_id"]
    return result


if __name__ == "__main__":
    # Minimal self-contained smoke test: one required course and one of two electives.
    example = {
        "courses": [
            {"id": "INDE301", "credits": 3, "required": True},
            {"id": "INDE302", "credits": 3, "required": False},
            {"id": "INDE303", "credits": 3, "required": False},
        ],
        "sections": [
            {
                "id": "INDE301-1", "course_id": "INDE301", "professor_id": "P1",
                "professor_score": 2, "available": True, "major_eligible": True,
                "otherwise_eligible": True,
                "meetings": [{"day": "M", "start": "09:00", "end": "10:00"}],
            },
            {
                "id": "INDE302-1", "course_id": "INDE302", "professor_id": "P2",
                "professor_score": 2, "available": True, "major_eligible": True,
                "otherwise_eligible": True,
                "meetings": [{"day": "M", "start": "11:00", "end": "12:00"}],
            },
            {
                "id": "INDE303-1", "course_id": "INDE303", "professor_id": "P3",
                "professor_score": 1, "available": True, "major_eligible": True,
                "otherwise_eligible": True,
                "meetings": [{"day": "T", "start": "09:00", "end": "10:00"}],
            },
        ],
        "elective_count": 1,
        "min_credits": 6,
        "max_credits": 6,
        "weights": {"days": 35, "gaps": 40, "professor": 25},
        "scales": {"days": 5, "gaps": 600, "professor": 10},
    }
    import json

    print(json.dumps(solve_backend_request(example), indent=2))
