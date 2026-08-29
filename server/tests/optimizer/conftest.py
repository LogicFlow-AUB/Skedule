"""Shared pytest configuration for the optimizer test suites.

Ensures ``server/optimizer`` (which holds ``scheduling_milp.py`` and the
``app`` FastAPI package) is importable regardless of the current working
directory. The individual test modules also self-bootstrap this path so they
run under ``python -m unittest`` as well as ``pytest``.
"""

import os
import sys

OPTIMIZER_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "optimizer")
if OPTIMIZER_DIR not in sys.path:
    sys.path.insert(0, OPTIMIZER_DIR)
