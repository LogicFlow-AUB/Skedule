# AUB schedule optimizer contract

`solve_backend_request(request: dict) -> dict` is the function the backend
should call. It is deliberately independent of the database, Express, and the
frontend. The backend sends clean, student-specific data and consumes the
stable response below. `solve_schedule` remains available as the lower-level
MILP function when only IDs and metrics are required.

## Request

Required fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `courses` | list | `{id, credits, required}`. `required` must be a JSON boolean. All non-required courses form the elective pool. |
| `sections` | list | `{id, course_id, meetings, available, major_eligible, otherwise_eligible}`. Eligibility fields must be JSON booleans. Optional `professor_id` and numeric `professor_score` are supported. |
| `elective_count` | optional nonnegative integer | Exact number of elective courses to include. Omit it when electives should be selected by credits instead. |
| `min_credits`, `max_credits` | numbers | Inclusive permitted credit range, with `min_credits <= max_credits`. |
| `weights` | object | Contains the `days`, `gaps`, and `professor` nonnegative percentages, totaling 100. |
| `scales` | optional object | Optional positive normalization constants for `days`, `gaps`, and `professor`. Omit it to use automatic, request-specific upper bounds. |

Each meeting is `{day, start, end}`. Times are either nonnegative integer
minutes from midnight or `HH:MM` strings. `end` must be later than `start`.
An empty `meetings` list represents an asynchronous/online section. It remains
eligible, contributes its course credits, and has no timetable, gap, or
campus-day contribution.

For the usual student workflow, send all confirmed required courses with
`required: true`, place all acceptable electives in the remaining course list,
omit `elective_count`, and set `min_credits`/`max_credits` to the desired total
load. Example: 9 required credits and a desired 15-credit schedule means send
`min_credits: 15, max_credits: 15`; the optimizer selects an eligible,
non-overlapping combination of electives totaling the remaining 6 credits.

Automatic scales are calculated as follows: `days` is the number of distinct
teaching days in the candidate data, `gaps` is the sum, over teaching days, of
that day's earliest candidate start to latest candidate end, and `professor` is
the sum of every candidate course's largest section penalty. The latter is a
safe bound whether elective selection is credit-based or uses an exact count.
Zero bounds use `1` to keep every divisor positive.

Optional fields are `course_eligibility`, `max_occurrences_per_day`,
`requirement_groups`, `corequisites`, `time_limit_seconds`, and
`solver_messages`. `max_occurrences_per_day` is either one integer or a
day-to-integer map. A group is `{course_ids, min, max}`. A corequisite rule is
`{course_id, corequisite_id, already_completed}`.

`excluded_crn_ids` is an optional list of original section/CRN IDs that the
student explicitly rejects. The optimizer forces its decision variable to zero.
If the CRN is a linked recitation or lab, every bundle containing it is also
forced to zero. A backend may instead set `student_infeasible: true` on a
section record; it has the same hard-constraint effect.

### Returning complete section information

The backend can put any display data it needs inside the corresponding course
or section record: for example `crn`, `section_number`, `course_code`,
`course_title`, `professor`, `campus`, `room`, `seats_remaining`, dates, and
the full list of meetings. These additional fields are not used by the MILP,
but `solve_backend_request` returns them unchanged for the chosen records.

Optionally include a `request_id`; it is copied into the response so the
backend can match a response to its request.

### Linked lectures, recitations, and labs

The optimizer precomputes selectable bundles before it creates timing conflicts.
A lecture can use `component_type: "lecture"` and either
`linked_section_ids: ["E1", "E2"]` for one required component choice, or
`linked_option_groups: [{"section_ids": ["E1", "E2"]}, {"section_ids":
["B1", "B2"]}]` for a required recitation *and* lab. Every valid combination
becomes one candidate with the combined meetings and combined eligibility.
Recitation/lab records may retain their reciprocal links for display but are
not individually selectable. The response's `selected_section_component_ids`
maps each selected candidate/bundle to the original raw section IDs.

## Response

For an optimal solution, the response is:

```json
{
  "status": "optimal",
  "selected_course_ids": ["..."],
  "selected_section_ids": ["..."],
  "total_credits": 0,
  "weekly_largest_gaps_sum_minutes": 0,
  "weekly_first_to_last_spans_sum_minutes": 0,
  "professor_preference_penalty": 0,
  "campus_days": 0,
  "days": {}
}
```

Only a proven optimal solution is currently returned as successful. If no such
solution is produced, the result has a status such as `infeasible` or
`not_solved` and a stable `message` field. For an infeasible request, the
optional `diagnostics` field reports only proven findings: required courses with
no eligible section, too few eligible electives, a credit range that cannot be
met even before timetable constraints, an exact credit target that becomes
feasible when widened, or the first lower elective count that yields an optimal
schedule. Invalid input raises
`ModelInputError`; the future HTTP layer should convert that exception to a
structured 4xx response.

When using `solve_backend_request`, an optimal response also contains
`selected_courses` and `selected_sections`. Each is a list of the **original
input records**, including all extra display fields. `selected_sections`
contains every selected linked component: therefore a chosen lecture with a
required recitation returns both records. A non-optimal response returns both
lists empty.

For a Node/Express backend, launch `run_optimizer.py`, write one request JSON
object to its standard input, and parse its one-line JSON output. It returns
the same response described here. Invalid JSON/model data returns
`{"status":"invalid_input", "message":"..."}`.

## Solver

The implementation uses PuLP with the bundled CBC solver. Callers remain
solver-independent.
