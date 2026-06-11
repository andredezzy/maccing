"""
Launcher shim for workspace-mcp that monkeypatches the upstream OAuth callback
HTML pages with the Maccing Midday-style design before the server boots.

OVERRIDE APPROACH: Monkeypatch (no built-in template/env mechanism exists).

WHY THIS ORDER MATTERS
----------------------
Both caller modules (core.server and auth.oauth_callback_server) import the
three response functions via `from auth.oauth_responses import X`, which binds
local names in those modules at import time.  Because workspace-mcp's main()
defers all server imports to _load_startup_dependencies() (called inside main),
patching auth.oauth_responses *before* calling main() is sufficient — the
`from auth.oauth_responses import X` statements in the caller modules execute
after our patch and therefore bind our replacement functions directly.

WHAT IS PATCHED
---------------
auth.oauth_responses.create_success_response    -> wraps auth_pages.success_page
auth.oauth_responses.create_error_response      -> wraps auth_pages.error_page
auth.oauth_responses.create_server_error_response -> wraps auth_pages.error_page

No caller-module re-patching is needed because those modules have not been
imported yet when this shim patches the source module.
"""

import os
import sys

# Make this shim's directory importable so auth_pages.py is found at
#   `import auth_pages`  regardless of cwd.
_SHIM_DIR = os.path.dirname(os.path.abspath(__file__))
if _SHIM_DIR not in sys.path:
    sys.path.insert(0, _SHIM_DIR)

# ── 1. Patch auth.oauth_responses BEFORE any server module is imported ────────

import auth.oauth_responses as _upstream_responses
import auth_pages as _pages
from fastapi.responses import HTMLResponse
from typing import Optional


def _patched_success(verified_user_id: Optional[str] = None) -> HTMLResponse:
    return HTMLResponse(content=_pages.success_page(verified_user_id), status_code=200)


def _patched_error(error_message: str, status_code: int = 400) -> HTMLResponse:
    return HTMLResponse(content=_pages.error_page(error_message), status_code=status_code)


def _patched_server_error(error_detail: str) -> HTMLResponse:
    return HTMLResponse(content=_pages.error_page(error_detail), status_code=500)


_upstream_responses.create_success_response = _patched_success
_upstream_responses.create_error_response = _patched_error
_upstream_responses.create_server_error_response = _patched_server_error

# ── 2. Hand off to workspace-mcp's real entrypoint ────────────────────────────
# sys.argv (e.g. --transport stdio) passes through unchanged.

from main import main  # noqa: E402 — intentionally imported after the patch

if __name__ == "__main__":
    main()
