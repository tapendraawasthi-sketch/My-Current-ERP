"""HTTP routes for storage health checks."""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/storage", tags=["storage"])


def _r2_configured() -> bool:
    """Return whether minimum R2 environment variables are present."""
    required = (
        "R2_ACCOUNT_ID",
        "R2_BUCKET",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
    )
    return all(os.getenv(name, "").strip() for name in required)


@router.get("/health")
def storage_health() -> dict:
    """Verify Cloudflare R2 connectivity and credentials.

    Returns:
        JSON with ``status``, ``checks``, and ``configured`` flags.
        Bucket names and endpoints are omitted from the public response.

    Raises:
        HTTPException: 503 when R2 is configured but unreachable; 501 when not configured.
    """
    if not _r2_configured():
        return {
            "status": "not_configured",
            "configured": False,
            "message": (
                "R2 environment variables are not set. "
                "See backend/.env.example."
            ),
        }

    try:
        from backend.storage.internal.container import get_storage_container

        container = get_storage_container()
        diagnosis = container.service.diagnose_health()
        logger.debug("R2 health diagnosis: %s", diagnosis)

        if diagnosis["status"] != "healthy":
            raise HTTPException(
                status_code=503,
                detail={
                    "status": "unhealthy",
                    "configured": True,
                    "checks": diagnosis["checks"],
                    "message": diagnosis["message"],
                    "circuit_breaker": diagnosis.get("circuit_breaker", {}).get(
                        "state"
                    ),
                },
            )

        return {
            "status": "healthy",
            "configured": True,
            "checks": diagnosis["checks"],
            "message": diagnosis["message"],
            "circuit_breaker": diagnosis.get("circuit_breaker", {}).get("state"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("R2 health check failed")
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "configured": True,
                "message": str(exc),
            },
        ) from exc
