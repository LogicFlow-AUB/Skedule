"""Service layer that bridges the FastAPI models to the existing MILP optimizer.

The optimizer module (``scheduling_milp``) is kept database-independent and is
reused as-is.  This module only translates the validated Pydantic payload into
the plain dictionary the MILP expects and shapes the result back into the
agreed response.

Exception contract:
  * ``ModelInputError`` means the request cannot define the MILP.  The HTTP
    layer converts it to a structured 4xx (not "infeasible").
  * Any other exception is an internal failure and is surfaced as a 500.
  * A solver status of "infeasible" (or "not_solved") is a legitimate result
    returned with HTTP 200, never turned into an internal error.
"""

from __future__ import annotations

from typing import Any

from scheduling_milp import ModelInputError, solve_backend_request

from .models import OptimizeRequest, OptimizeResponse


def _to_plain_meetings(meetings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return meeting rows as plain dicts (MILP accepts int or HH:MM times)."""
    return [dict(meeting) for meeting in meetings]


def run_optimizer(request: OptimizeRequest) -> OptimizeResponse:
    """Run the existing MILP on a validated request and shape the response.

    Raises ``ModelInputError`` for data that cannot define the model.
    """
    payload: dict[str, Any] = {
        "courses": [course.model_dump(exclude_none=True) for course in request.courses],
        "sections": [
            {**section.model_dump(exclude_none=True), "meetings": section.meetings}
            for section in request.sections
        ],
        "min_credits": request.min_credits,
        "max_credits": request.max_credits,
        "weights": request.weights.model_dump(),
    }

    # The MILP reads meetings as {day, start, end} (it ignores extra fields,
    # which are preserved for display).  Pydantic already validated them.
    for section in payload["sections"]:
        section["meetings"] = [
            dict(meeting) for meeting in section["meetings"]
        ]

    if request.scales is not None:
        payload["scales"] = request.scales.model_dump()
    if request.elective_count is not None:
        payload["elective_count"] = request.elective_count
    if request.course_eligibility is not None:
        payload["course_eligibility"] = request.course_eligibility
    if request.max_occurrences_per_day is not None:
        payload["max_occurrences_per_day"] = request.max_occurrences_per_day
    if request.requirement_groups is not None:
        payload["requirement_groups"] = [
            group.model_dump(exclude_none=True) for group in request.requirement_groups
        ]
    if request.corequisites is not None:
        payload["corequisites"] = [
            rule.model_dump(exclude_none=True) for rule in request.corequisites
        ]
    if request.excluded_crn_ids is not None:
        payload["excluded_crn_ids"] = request.excluded_crn_ids
    if request.request_id is not None:
        payload["request_id"] = request.request_id
    if request.time_limit_seconds is not None:
        payload["time_limit_seconds"] = request.time_limit_seconds
    if request.solver_messages is not None:
        payload["solver_messages"] = request.solver_messages

    result = solve_backend_request(payload)
    return OptimizeResponse(**result)
