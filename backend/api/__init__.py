"""Backend HTTP API routers."""

from backend.api.health_routes import router as storage_health_router

__all__ = ["storage_health_router"]
