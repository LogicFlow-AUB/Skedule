"""JSON stdin/stdout entry point for the student-scheduling optimizer.

The backend starts this script, sends one JSON request on standard input, and
reads exactly one JSON response from standard output. No database, frontend,
or AI code belongs here.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from scheduling_milp import ModelInputError, solve_backend_request


def emit(payload: dict[str, Any]) -> None:
    json.dump(payload, sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")


def main() -> int:
    try:
        request = json.load(sys.stdin)
        if not isinstance(request, dict):
            raise ModelInputError("The optimizer request must be a JSON object.")
        emit(solve_backend_request(request))
        return 0
    except ModelInputError as error:
        emit({"status": "invalid_input", "message": str(error)})
        return 2
    except json.JSONDecodeError as error:
        emit({"status": "invalid_input", "message": f"Invalid JSON: {error.msg}"})
        return 2
    except Exception as error:  # pragma: no cover - process-boundary fallback
        emit({"status": "internal_error", "message": str(error)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
