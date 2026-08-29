"""Unit tests for the public scheduling optimizer contract."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "optimizer"))

from scheduling_milp import ModelInputError, solve_backend_request, solve_schedule


def course(course_id, required, credits=3):
    return {"id": course_id, "credits": credits, "required": required}


def section(section_id, course_id, meetings, **overrides):
    value = {
        "id": section_id,
        "course_id": course_id,
        "professor_score": 0,
        "available": True,
        "major_eligible": True,
        "otherwise_eligible": True,
        "meetings": meetings,
    }
    value.update(overrides)
    return value


def meeting(day, start, end):
    return {"day": day, "start": start, "end": end}


def request(courses, sections, elective_count=0, min_credits=0, max_credits=30, **overrides):
    value = {
        "courses": courses,
        "sections": sections,
        "elective_count": elective_count,
        "min_credits": min_credits,
        "max_credits": max_credits,
        "weights": {"days": 35, "gaps": 40, "professor": 25},
        "scales": {"days": 5, "gaps": 600, "professor": 10},
    }
    value.update(overrides)
    return value


class ScheduleMilpTests(unittest.TestCase):
    def solve(self, *args, **kwargs):
        result = solve_schedule(request(*args, **kwargs))
        self.assertIn(result["status"], {"optimal", "feasible"})
        return result

    def test_required_course_chooses_one_of_multiple_sections(self):
        result = self.solve(
            [course("R", True)],
            [
                section("R-early", "R", [meeting("M", "09:00", "10:00")], professor_score=10),
                section("R-late", "R", [meeting("M", "11:00", "12:00")], professor_score=0),
            ],
        )
        self.assertEqual(result["selected_section_ids"], ["R-early"])

    def test_selects_exactly_k_electives(self):
        result = self.solve(
            [course("R", True), course("A", False), course("B", False), course("C", False)],
            [
                section("R-1", "R", [meeting("M", "09:00", "10:00")]),
                section("A-1", "A", [meeting("T", "09:00", "10:00")]),
                section("B-1", "B", [meeting("W", "09:00", "10:00")]),
                section("C-1", "C", [meeting("R", "09:00", "10:00")]),
            ],
            elective_count=2,
        )
        self.assertEqual(len(set(result["selected_course_ids"]) - {"R"}), 2)

    def test_electives_can_be_selected_to_fill_credit_target_without_count(self):
        input_request = request(
            [course("R", True, 9), course("A", False, 3), course("B", False, 3), course("C", False, 6)],
            [
                section("R-1", "R", []), section("A-1", "A", []),
                section("B-1", "B", []), section("C-1", "C", []),
            ],
            min_credits=15,
            max_credits=15,
        )
        del input_request["elective_count"]
        result = solve_schedule(input_request)
        self.assertEqual(result["status"], "optimal")
        self.assertEqual(result["total_credits"], 15)
        self.assertIn(
            set(result["selected_course_ids"]) - {"R"},
            [{"A", "B"}, {"C"}],
        )

    def test_credit_limits_can_be_infeasible(self):
        result = solve_schedule(request([course("R", True)], [section("R-1", "R", [])], min_credits=6))
        self.assertEqual(result["status"], "infeasible")

    def test_automatic_normalization_scales_are_optional(self):
        input_request = request(
            [course("R", True)], [section("R-1", "R", [meeting("M", "09:00", "10:00")])]
        )
        del input_request["scales"]
        result = solve_schedule(input_request)
        self.assertEqual(result["status"], "optimal")

    def test_asynchronous_section_counts_for_credits_not_timing(self):
        result = self.solve(
            [course("R", True), course("ONLINE", False)],
            [section("R-1", "R", [meeting("M", "09:00", "10:00")]), section("ONLINE-1", "ONLINE", [])],
            elective_count=1,
            min_credits=6,
            max_credits=6,
        )
        self.assertEqual(result["total_credits"], 6)
        self.assertEqual(result["campus_days"], 1)

    def test_linked_lecture_and_recitation_are_precomputed_as_bundles(self):
        result = self.solve(
            [course("MATH201", True), course("OTHER", True)],
            [
                section(
                    "12175", "MATH201", [meeting("M", "10:00", "10:50")],
                    component_type="lecture", linked_section_ids=["12139", "12150"], professor_score=5,
                ),
                section("12139", "MATH201", [meeting("W", "08:00", "08:50")], component_type="recitation", linked_section_ids=["12175"]),
                section("12150", "MATH201", [meeting("F", "17:00", "17:50")], component_type="recitation", linked_section_ids=["12175"]),
                section("OTHER-1", "OTHER", [meeting("W", "08:00", "08:50")]),
            ],
        )
        math_bundle = next(sid for sid in result["selected_section_ids"] if sid.startswith("bundle::12175"))
        self.assertEqual(result["selected_section_component_ids"][math_bundle], ["12175", "12150"])
        self.assertNotIn("12139", result["selected_section_component_ids"][math_bundle])

    def test_linked_lecture_with_required_recitation_and_lab_forms_combinations(self):
        result = self.solve(
            [course("SCI", True), course("OTHER", True)],
            [
                section(
                    "L1", "SCI", [meeting("M", "09:00", "10:00")],
                    linked_option_groups=[
                        {"section_ids": ["E1", "E2"]}, {"section_ids": ["B1", "B2"]}
                    ],
                ),
                section("E1", "SCI", [meeting("T", "09:00", "10:00")]),
                section("E2", "SCI", [meeting("T", "10:00", "11:00")]),
                section("B1", "SCI", [meeting("W", "09:00", "10:00")]),
                section("B2", "SCI", [meeting("W", "10:00", "11:00")]),
                section("OTHER-1", "OTHER", [meeting("T", "09:00", "10:00")]),
            ],
        )
        bundle = next(sid for sid in result["selected_section_ids"] if sid.startswith("bundle::L1"))
        components = result["selected_section_component_ids"][bundle]
        self.assertEqual(components[:2], ["L1", "E2"])
        self.assertIn(components[2], {"B1", "B2"})

    def test_infeasibility_reports_feasible_elective_count_relaxation(self):
        result = solve_schedule(request(
            [course("R", True), course("A", False), course("B", False)],
            [
                section("R-1", "R", [meeting("M", "09:00", "10:00")]),
                section("A-1", "A", [meeting("M", "09:00", "10:00")]),
                section("B-1", "B", [meeting("T", "09:00", "10:00")]),
            ],
            elective_count=2,
        ))
        self.assertEqual(result["status"], "infeasible")
        self.assertEqual(result["diagnostics"]["elective_count_relaxation"]["feasible_with"], 1)

    def test_infeasibility_reports_required_course_without_eligible_section(self):
        result = solve_schedule(request(
            [course("R", True)], [section("R-1", "R", [], available=False)]
        ))
        self.assertEqual(result["diagnostics"]["required_courses_without_eligible_sections"], ["R"])

    def test_infeasibility_reports_eligible_elective_shortage(self):
        result = solve_schedule(request(
            [course("R", True), course("A", False), course("B", False)],
            [
                section("R-1", "R", []),
                section("A-1", "A", [], available=False),
                section("B-1", "B", []),
            ],
            elective_count=2,
        ))
        self.assertEqual(result["diagnostics"]["eligible_elective_shortage"]["requested"], 2)

    def test_infeasibility_reports_credit_load_conflict(self):
        result = solve_schedule(request(
            [course("R", True), course("A", False)],
            [section("R-1", "R", []), section("A-1", "A", [])],
            elective_count=1,
            min_credits=7,
        ))
        self.assertIn("credit_load_conflict", result["diagnostics"])

    def test_infeasibility_reports_uncomposable_exact_credit_target(self):
        result = solve_schedule(request(
            [course("R", True, 9), course("A", False, 3), course("B", False, 3)],
            [section("R-1", "R", []), section("A-1", "A", []), section("B-1", "B", [])],
            min_credits=14,
            max_credits=14,
        ))
        self.assertEqual(
            result["diagnostics"]["exact_credit_target_relaxation"]["requested_credits"], 14
        )

    def test_major_ineligible_section_is_not_selected(self):
        result = self.solve(
            [course("R", True), course("A", False), course("B", False)],
            [section("R-1", "R", []), section("A-1", "A", [], major_eligible=False), section("B-1", "B", [])],
            elective_count=1,
        )
        self.assertIn("B-1", result["selected_section_ids"])

    def test_closed_section_is_not_selected(self):
        result = self.solve(
            [course("R", True), course("A", False), course("B", False)],
            [section("R-1", "R", []), section("A-1", "A", [], available=False), section("B-1", "B", [])],
            elective_count=1,
        )
        self.assertIn("B-1", result["selected_section_ids"])

    def test_student_excluded_crn_is_forced_to_zero(self):
        result = self.solve(
            [course("R", True)],
            [
                section("CRN-100", "R", [meeting("M", "09:00", "10:00")], professor_score=10),
                section("CRN-200", "R", [meeting("M", "11:00", "12:00")]),
            ],
            excluded_crn_ids=["CRN-100"],
        )
        self.assertEqual(result["selected_section_ids"], ["CRN-200"])

    def test_backend_wrapper_returns_the_full_selected_records(self):
        backend_request = request(
            [
                {"id": "R", "credits": 3, "required": True, "code": "INDE 402", "title": "Operations Research"},
                {"id": "A", "credits": 3, "required": False, "code": "MUSIC 269B", "title": "Music"},
            ],
            [
                section(
                    "12175", "R", [meeting("M", "10:00", "10:50")],
                    crn="12175", section_number="L1", campus="Main Campus",
                    professor={"name": "Ayman Kachmar"},
                ),
                section(
                    "22222", "A", [], crn="22222", section_number="1", campus="Online"),
            ],
            elective_count=1,
            min_credits=6,
            max_credits=6,
            request_id="student-request-17",
        )
        result = solve_backend_request(backend_request)
        self.assertEqual(result["status"], "optimal")
        self.assertEqual(result["request_id"], "student-request-17")
        self.assertEqual(
            [item["code"] for item in result["selected_courses"]],
            ["INDE 402", "MUSIC 269B"],
        )
        self.assertEqual(
            [item["crn"] for item in result["selected_sections"]], ["12175", "22222"],
        )
        self.assertEqual(result["selected_sections"][0]["professor"]["name"], "Ayman Kachmar")

    def test_excluding_a_linked_component_forces_its_bundle_to_zero(self):
        result = self.solve(
            [course("MATH", True)],
            [
                section("L1", "MATH", [meeting("M", "09:00", "10:00")], component_type="lecture", linked_section_ids=["E1", "E2"]),
                section("E1", "MATH", [meeting("W", "09:00", "10:00")], component_type="recitation"),
                section("E2", "MATH", [meeting("W", "10:00", "11:00")], component_type="recitation"),
            ],
            excluded_crn_ids=["E1"],
        )
        bundle = result["selected_section_ids"][0]
        self.assertEqual(result["selected_section_component_ids"][bundle], ["L1", "E2"])

    def test_diagnostic_detects_when_crn_exclusions_eliminate_required_bundles(self):
        result = solve_schedule(request(
            [course("MATH", True)],
            [
                section(
                    "L1", "MATH", [meeting("M", "09:00", "10:00")],
                    component_type="lecture", linked_section_ids=["E1", "E2"],
                ),
                section("E1", "MATH", [meeting("W", "09:00", "10:00")]),
                section("E2", "MATH", [meeting("W", "10:00", "11:00")]),
            ],
            excluded_crn_ids=["E1", "E2"],
        ))
        self.assertEqual(result["status"], "infeasible")
        self.assertEqual(
            result["diagnostics"]["required_courses_without_eligible_sections"], ["MATH"]
        )

    def test_overlapping_sections_are_infeasible(self):
        result = solve_schedule(request(
            [course("R", True), course("A", False)],
            [section("R-1", "R", [meeting("M", "09:00", "10:00")]), section("A-1", "A", [meeting("M", "09:30", "10:30")])],
            elective_count=1,
        ))
        self.assertEqual(result["status"], "infeasible")

    def test_back_to_back_classes_have_zero_gap(self):
        result = self.solve(
            [course("R", True), course("A", False)],
            [section("R-1", "R", [meeting("M", "09:00", "10:00")]), section("A-1", "A", [meeting("M", "10:00", "11:00")])],
            elective_count=1,
        )
        self.assertEqual(result["days"]["M"]["largest_gap_minutes"], 0)
        self.assertEqual(result["days"]["M"]["first_to_last_span_minutes"], 120)

    def test_multi_day_section_activates_each_occurrence(self):
        result = self.solve(
            [course("R", True)],
            [section("R-1", "R", [meeting("M", "09:00", "10:00"), meeting("W", "09:00", "10:00")])],
        )
        self.assertEqual(result["campus_days"], 2)
        self.assertEqual({day: len(data["meetings"]) for day, data in result["days"].items()}, {"M": 1, "W": 1})

    def test_one_class_day_has_duration_span_and_no_gap(self):
        result = self.solve([course("R", True)], [section("R-1", "R", [meeting("M", "09:00", "10:30")])])
        self.assertEqual(result["days"]["M"]["largest_gap_minutes"], 0)
        self.assertEqual(result["days"]["M"]["first_to_last_span_minutes"], 90)

    def test_largest_consecutive_gap_is_measured_correctly(self):
        result = self.solve(
            [course("A", True), course("B", True), course("C", True)],
            [
                section("A-1", "A", [meeting("M", "09:00", "10:00")]),
                section("B-1", "B", [meeting("M", "11:00", "12:00")]),
                section("C-1", "C", [meeting("M", "15:00", "16:00")]),
            ],
        )
        self.assertEqual(result["days"]["M"]["largest_gap_minutes"], 180)
        self.assertEqual(result["days"]["M"]["first_to_last_span_minutes"], 420)

    def test_zero_professor_weight_does_not_rank_schedules(self):
        result = self.solve(
            [course("R", True), course("S", True)],
            [
                section("R-low-preference", "R", [meeting("M", "09:00", "10:00")], professor_score=0),
                section("R-high-preference", "R", [meeting("M", "14:00", "15:00")], professor_score=10),
                section("S-1", "S", [meeting("M", "10:00", "11:00")]),
            ],
            weights={"days": 0, "gaps": 100, "professor": 0},
        )
        self.assertIn("R-low-preference", result["selected_section_ids"])

    def test_campus_day_weight_prefers_fewer_active_days(self):
        result = self.solve(
            [course("R", True), course("S", True)],
            [
                section("R-1", "R", [meeting("M", "09:00", "10:00")]),
                section("S-one-day", "S", [meeting("M", "10:00", "11:00")], professor_score=0),
                section("S-two-days", "S", [meeting("T", "09:00", "10:00")], professor_score=10),
            ],
            weights={"days": 100, "gaps": 0, "professor": 0},
        )
        self.assertIn("S-one-day", result["selected_section_ids"])
        self.assertEqual(result["campus_days"], 1)

    def test_invalid_weights_are_rejected(self):
        with self.assertRaisesRegex(ModelInputError, "total 100"):
            solve_schedule(request([course("R", True)], [section("R-1", "R", [])], weights={"days": 50, "gaps": 40, "professor": 0}))

    def test_daily_occurrence_limit_is_enforced(self):
        result = self.solve(
            [course("R", True), course("A", False), course("B", False)],
            [
                section("R-1", "R", [meeting("M", "09:00", "10:00")]),
                section("A-1", "A", [meeting("M", "10:00", "11:00")]),
                section("B-1", "B", [meeting("T", "09:00", "10:00")]),
            ],
            elective_count=1,
            max_occurrences_per_day={"M": 1},
        )
        self.assertIn("B-1", result["selected_section_ids"])

    def test_requirement_group_is_enforced(self):
        result = self.solve(
            [course("R", True), course("A", False), course("B", False)],
            [section("R-1", "R", []), section("A-1", "A", []), section("B-1", "B", [])],
            elective_count=1,
            requirement_groups=[{"course_ids": ["A"], "min": 1, "max": 1}],
        )
        self.assertIn("A-1", result["selected_section_ids"])

    def test_corequisite_is_enforced(self):
        result = solve_schedule(request(
            [course("R", True), course("C", False)],
            [section("R-1", "R", []), section("C-1", "C", [])],
            corequisites=[{"course_id": "R", "corequisite_id": "C", "already_completed": False}],
        ))
        self.assertEqual(result["status"], "infeasible")

    def test_boolean_fields_are_not_silently_coerced(self):
        with self.assertRaisesRegex(ModelInputError, "available must be a boolean"):
            solve_schedule(request([course("R", True)], [section("R-1", "R", [], available="false")]))


if __name__ == "__main__":
    unittest.main()
