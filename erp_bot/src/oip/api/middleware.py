"""OIP API security middleware."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..config.settings import get_oip_settings
from ..infrastructure.observability.correlation import clear_trace
from ..infrastructure.security.session_context import clear_security_context


class SecurityContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        try:
            response = await call_next(request)
            settings = get_oip_settings()
            if settings.cors_allow_credentials:
                origin = request.headers.get("origin", "")
                if origin and origin in settings.cors_allowed_origins:
                    response.headers["Access-Control-Allow-Origin"] = origin
                    response.headers["Vary"] = "Origin"
            if settings.csrf_protection and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
                if not request.url.path.endswith("/health"):
                    csrf_header = request.headers.get("x-csrf-token", "")
                    csrf_cookie = request.cookies.get("oip_csrf", "")
                    if csrf_cookie and csrf_header and csrf_cookie != csrf_header:
                        return Response(status_code=403, content="csrf_validation_failed")
            return response
        finally:
            clear_security_context()
            clear_trace()
