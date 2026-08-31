"""Pydantic request/response models for the schedule-optimizer FastAPI service.

These models mirror the input contract already consumed by
``scheduling_milp.solve_backend_request`` so the Node backend can send the
same, already-expanded optimizer payload it would pass to the Python optimizer
directly.  The MILP only reads the documented scheduling fields; every other
field is echoed back unchanged for the chosen records (display data such as
CRN, section number, professor, campus, room, and meeting details).
"""

from __future__ import annotations

from typing import Any, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

Day = Literal["M", "T", "W", "R", "F", "S", "U"]

MINUTES_OR_TIME = Union[int, str]


class Meeting(BaseModel):
    """One timetable occurrence of a section."""

    model_config = ConfigDict(extra="allow")

    day: Union[Day, str]
    start: MINUTES_OR_TIME
    end: MINUTES_OR_TIME


class LinkedOptionGroup(BaseModel):
    """Exactly one section must be chosen from ``section_ids`` in a bundle."""

    section_ids: List[Union[int, str]]


class Section(BaseModel):
    """A raw lecture/recitation/lab record, matching the MILP contract."""

    model_config = ConfigDict(extra="allow")

    id: Union[int, str]
    course_id: Union[int, str]
    meetings: List[Meeting] = Field(default_factory=list)
    available: bool = True
    major_eligible: bool = True
    otherwise_eligible: bool = True
    student_infeasible: Optional[bool] = None
    professor_id: Optional[Union[int, str]] = None
    professor_score: Optional[float] = None
    component_type: Optional[str] = None
    linked_section_ids: Optional[List[Union[int, str]]] = None
    linked_option_groups: Optional[List[LinkedOptionGroup]] = None


class Course(BaseModel):
    """A candidate course with credits and required/elective status."""

    model_config = ConfigDict(extra="allow")

    id: Union[int, str]
    credits: float = Field(ge=0, description="Course credit weight, must be >= 0.")
    required: bool


class Weights(BaseModel):
    """Objective weights.  Must be nonnegative and total exactly 100."""

    days: float = Field(ge=0)
    gaps: float = Field(ge=0)
    professor: float = Field(ge=0)

    @model_validator(mode="after")
    def _weights_total_100(self) -> "Weights":
        total = self.days + self.gaps + self.professor
        if abs(total - 100.0) > 1e-6:
            raise ValueError("The days, gaps, and professor weights must total 100.")
        return self


class Scales(BaseModel):
    """Optional positive normalization constants for the objective terms."""

    days: float = Field(gt=0)
    gaps: float = Field(gt=0)
    professor: float = Field(gt=0)


class RequirementGroup(BaseModel):
    """Additional curriculum rule: between min and max of the course_ids."""

    model_config = ConfigDict(extra="allow")

    course_ids: List[Union[int, str]]
    min: int = Field(ge=0)
    max: int = Field(ge=0)


class CorequisiteRule(BaseModel):
    """A corequisite rule enforced by the MILP."""

    model_config = ConfigDict(extra="allow")

    course_id: Union[int, str]
    corequisite_id: Union[int, str]
    already_completed: bool = False


class OptimizeRequest(BaseModel):
    """The expanded optimizer payload sent by the Node backend.

    This is exactly what the existing MILP requires; FastAPI never queries a
    database, it only validates and forwards this payload.
    """

    model_config = ConfigDict(extra="allow")

    courses: List[Course] = Field(min_length=1)
    sections: List[Section] = Field(min_length=1)
    min_credits: float = Field(ge=0, description="Inclusive lower credit bound.")
    max_credits: float = Field(
        ge=0, description="Inclusive upper credit bound; must be >= min_credits."
    )
    weights: Weights
    scales: Optional[Scales] = None
    elective_count: Optional[int] = Field(default=None, ge=0)
    course_eligibility: Optional[dict[str, bool]] = None
    max_occurrences_per_day: Optional[Union[int, dict[str, int]]] = None
    requirement_groups: Optional[List[RequirementGroup]] = None
    corequisites: Optional[List[CorequisiteRule]] = None
    excluded_crn_ids: Optional[List[Union[int, str]]] = None
    request_id: Optional[str] = None
    time_limit_seconds: Optional[float] = Field(default=None, ge=0)
    solver_messages: Optional[bool] = None

    @model_validator(mode="after")
    def _credits_range(self) -> "OptimizeRequest":
        if self.min_credits > self.max_credits:
            raise ValueError("min_credits cannot exceed max_credits.")
        return self


class DayResult(BaseModel):
    """Per-day timetable metrics returned for display by the frontend calendar."""

    model_config = ConfigDict(extra="allow")

    largest_gap_minutes: float
    first_to_last_span_minutes: float
    meetings: List[dict[str, Any]] = Field(default_factory=list)


class OptimizeResponse(BaseModel):
    """Structured optimization result returned to the Node backend.

    ``status`` is ``optimal``, ``infeasible``, or another solver status such as
    ``not_solved``.  A mathematically infeasible request is still HTTP 200 with
    ``status == "infeasible"`` and empty selection lists (never a fake or
    partial schedule).  Internal failures are surfaced as HTTP errors, not as
    ``infeasible``.
    """

    model_config = ConfigDict(extra="allow")

    status: str
    request_id: Optional[str] = None
    selected_course_ids: List[str] = Field(default_factory=list)
    selected_section_ids: List[str] = Field(default_factory=list)
    selected_section_component_ids: dict[str, List[str]] = Field(default_factory=dict)
    selected_courses: List[dict[str, Any]] = Field(default_factory=list)
    selected_sections: List[dict[str, Any]] = Field(default_factory=list)
    total_credits: float = 0
    campus_days: int = 0
    weekly_largest_gaps_sum_minutes: float = 0
    weekly_first_to_last_spans_sum_minutes: float = 0
    professor_preference_penalty: float = 0
    days: dict[str, DayResult] = Field(default_factory=dict)
    message: Optional[str] = None
    diagnostics: dict[str, Any] = Field(default_factory=dict)


class ErrorDetail(BaseModel):
    """Structured error body used for invalid input / internal failures."""

    status: str
    message: str
