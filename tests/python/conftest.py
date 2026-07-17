"""
conftest.py for Python unit/integration tests.

Pre-populates sys.modules with MagicMock stubs for packages that are not
installed in this environment (firebase_admin, requests, pytz, etc.) so that
the server package can be imported without errors.
"""

import sys
from unittest.mock import MagicMock

# Must run before any fixture or test imports server.
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
    "dateutil.relativedelta",
    # Required by server.emails_generation.blog_posts and its dependencies
    "bs4",
    "undetected_chromedriver",
    "selenium",
    "selenium.webdriver",
    "selenium.webdriver.common",
    "selenium.webdriver.common.by",
    "selenium.webdriver.common.action_chains",
    "selenium.webdriver.remote",
    "selenium.webdriver.remote.webdriver",
    "selenium.webdriver.remote.webelement",
    "selenium.common",
    "selenium.common.exceptions",
    "urllib3",
    "pdfplumber",
    "dotenv",
    "spacy",
    "sentence_transformers",
    "sklearn",
    "sklearn.metrics",
    "sklearn.metrics.pairwise",
]

for _mod in _MOCK_MODULES:
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()
