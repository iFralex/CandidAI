"""
conftest.py for Python unit/integration tests.

Pre-populates sys.modules with MagicMock stubs for packages that are not
installed in this environment (firebase_admin, requests, pytz, etc.) so that
the candidai_script package can be imported without errors.
"""

import sys
from unittest.mock import MagicMock

# Must run before any fixture or test imports candidai_script.
_MOCK_MODULES = [
    "firebase_admin",
    "firebase_admin.credentials",
    "firebase_admin.firestore",
    "requests",
    "pytz",
    "openai",
    "anthropic",
    "dateutil",
    "dateutil.parser",
]

for _mod in _MOCK_MODULES:
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()
