"""Unit tests for storage health HTTP endpoint."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.api.health_routes import router
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)
client = TestClient(app)


class TestStorageHealthEndpoint:
    def test_not_configured(self, monkeypatch) -> None:
        monkeypatch.delenv("R2_ACCOUNT_ID", raising=False)
        monkeypatch.delenv("R2_BUCKET", raising=False)
        resp = client.get("/storage/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "not_configured"
        assert body["configured"] is False

    def test_healthy(self, monkeypatch, r2_env: dict[str, str]) -> None:
        for k, v in r2_env.items():
            monkeypatch.setenv(k, v)
        mock_service = MagicMock()
        mock_service.diagnose_health.return_value = {
            "status": "healthy",
            "checks": {
                "configuration": "ok",
                "credentials": "ok",
                "bucket": "ok",
                "connectivity": "ok",
                "permissions": "ok",
            },
            "message": "R2 connection verified",
            "circuit_breaker": {"state": "closed"},
        }
        mock_container = MagicMock()
        mock_container.service = mock_service
        with patch(
            "backend.storage.internal.container.get_storage_container",
            return_value=mock_container,
        ):
            resp = client.get("/storage/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "healthy"
        assert "bucket" not in body
        assert "endpoint" not in body
        assert body["checks"]["credentials"] == "ok"

    def test_unhealthy_returns_503(self, monkeypatch, r2_env: dict[str, str]) -> None:
        for k, v in r2_env.items():
            monkeypatch.setenv(k, v)
        mock_service = MagicMock()
        mock_service.diagnose_health.return_value = {
            "status": "unhealthy",
            "checks": {"credentials": "invalid"},
            "message": "invalid credentials",
            "circuit_breaker": {"state": "open"},
        }
        mock_container = MagicMock()
        mock_container.service = mock_service
        with patch(
            "backend.storage.internal.container.get_storage_container",
            return_value=mock_container,
        ):
            resp = client.get("/storage/health")
        assert resp.status_code == 503
