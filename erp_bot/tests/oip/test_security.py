"""OIP Phase 2.8 — Security, identity & multi-tenancy tests."""

from __future__ import annotations

import uuid

import pytest

from src.oip.application.services.audit_service import AuditService
from src.oip.application.services.security_audit_service import SecurityAuditService
from src.oip.application.dto.intelligence_request import IntelligenceRequestDto
from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.infrastructure.persistence.audit_sqlite import SqliteAuditSinkAdapter
from src.oip.infrastructure.security.api_key_service import ApiKeyAuthError, ApiKeyService
from src.oip.infrastructure.security.credential_vault import CredentialVault
from src.oip.infrastructure.security.jwt_service import JwtAuthError, JwtService
from src.oip.infrastructure.security.permission_registry import create_default_permission_registry
from src.oip.infrastructure.security.principal import AuthMethod, SecurityPrincipal
from src.oip.infrastructure.security.rate_limiter import RateLimiter
from src.oip.infrastructure.security.secret_provider import SecretProvider
from src.oip.infrastructure.security.session_context import bind_principal, clear_security_context
from src.oip.infrastructure.security.tenant_guard import assert_tenant_access
from src.oip.integration.acl.rbac_permission_adapter import RbacPermissionAdapter
from src.oip.modules.action_runtime.domain.value_objects import ActionRuntimeType
from src.oip.modules.oec_runtime.infrastructure.persistence.oec_sqlite import TENANT_A
from src.oip.shared.exceptions import OipForbiddenError


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_security.db"
    settings = OipSettings(
        enabled=True,
        auth_required=False,
        database_url=f"sqlite+aiosqlite:///{db_path}",
        jwt_secret="test-secret-key-for-jwt",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


@pytest.fixture
def jwt_service(oip_container):
    return oip_container.jwt_service


@pytest.fixture
def api_key_service(oip_container):
    return oip_container.api_key_service


def test_permission_registry_roles():
    registry = create_default_permission_registry()
    assert registry.is_allowed(role="accountant", permissions=(), required=("erp:command:execute",))
    assert registry.is_allowed(role="read_only", permissions=(), required=("oip:read",))
    assert not registry.is_allowed(role="read_only", permissions=(), required=("erp:command:execute",))
    assert "system_admin" in registry.list_roles()


@pytest.mark.asyncio
async def test_jwt_issue_and_verify(jwt_service: JwtService):
    token = jwt_service.issue_access_token(
        user_id="user-1",
        tenant_id="tenant-a",
        company_id="company-1",
        role="accountant",
        session_id="sess-1",
    )
    principal = await jwt_service.verify_access_token(token)
    assert principal.user_id == "user-1"
    assert principal.tenant_id == "tenant-a"
    assert principal.auth_method == AuthMethod.JWT
    assert principal.has_permission("erp:command:execute")


@pytest.mark.asyncio
async def test_jwt_expired_token(jwt_service: JwtService, monkeypatch):
    monkeypatch.setattr(jwt_service._settings, "jwt_access_ttl_minutes", -1)
    token = jwt_service.issue_access_token(
        user_id="user-1",
        tenant_id="tenant-a",
        company_id="company-1",
        role="accountant",
        session_id="sess-1",
    )
    with pytest.raises(JwtAuthError, match="token_expired"):
        await jwt_service.verify_access_token(token)


@pytest.mark.asyncio
async def test_jwt_revoked_token(jwt_service: JwtService):
    token = jwt_service.issue_access_token(
        user_id="user-1",
        tenant_id="tenant-a",
        company_id="company-1",
        role="accountant",
        session_id="sess-1",
    )
    await jwt_service.revoke_access_token(token, reason="logout")
    with pytest.raises(JwtAuthError, match="token_revoked"):
        await jwt_service.verify_access_token(token)


@pytest.mark.asyncio
async def test_refresh_token_rotation(jwt_service: JwtService):
    refresh = await jwt_service.issue_refresh_token(
        user_id="user-1",
        tenant_id="tenant-a",
        company_id="company-1",
        role="accountant",
        session_id="sess-1",
    )
    access, new_refresh = await jwt_service.refresh_access_token(refresh)
    assert access
    assert new_refresh
    with pytest.raises(JwtAuthError):
        await jwt_service.refresh_access_token(refresh)


@pytest.mark.asyncio
async def test_api_key_create_and_validate(oip_container, api_key_service: ApiKeyService):
    key_id, raw = await api_key_service.create_api_key(
        tenant_id=TENANT_A,
        company_id="company-1",
        name="ci-bot",
        role="company_admin",
        permissions=("erp:query:execute",),
    )
    assert key_id
    principal = await api_key_service.validate_api_key(raw)
    assert principal.tenant_id == TENANT_A
    assert principal.auth_method == AuthMethod.SERVICE_ACCOUNT
    with pytest.raises(ApiKeyAuthError):
        await api_key_service.validate_api_key("invalid-key")


@pytest.mark.asyncio
async def test_rbac_permission_adapter_allows_accountant(oip_container):
    adapter = RbacPermissionAdapter(oip_container.permission_registry)
    bind_principal(
        await oip_container.jwt_service.verify_access_token(
            oip_container.jwt_service.issue_access_token(
                user_id="acct-1",
                tenant_id=TENANT_A,
                company_id="company-1",
                role="accountant",
                session_id="s1",
            )
        )
    )
    result = await adapter.check_permission(
        tenant_id=TENANT_A,
        user_id="acct-1",
        action_type=ActionRuntimeType.JOURNAL_ENTRY,
        company_id="company-1",
        branch_id=None,
        context={"required_permissions": ("erp:command:execute",)},
    )
    assert result.allowed is True
    clear_security_context()


@pytest.mark.asyncio
async def test_rbac_permission_adapter_denies_read_only(oip_container):
    adapter = RbacPermissionAdapter(oip_container.permission_registry)
    bind_principal(
        await oip_container.jwt_service.verify_access_token(
            oip_container.jwt_service.issue_access_token(
                user_id="viewer-1",
                tenant_id=TENANT_A,
                company_id="company-1",
                role="read_only",
                session_id="s1",
            )
        )
    )
    result = await adapter.check_permission(
        tenant_id=TENANT_A,
        user_id="viewer-1",
        action_type=ActionRuntimeType.JOURNAL_ENTRY,
        company_id="company-1",
        branch_id=None,
        context={"required_permissions": ("erp:command:execute",)},
    )
    assert result.allowed is False
    clear_security_context()


def test_tenant_isolation_guard():
    bind_principal(
        SecurityPrincipal(
            user_id="u1",
            tenant_id="tenant-a",
            company_id="company-1",
            branch_id=None,
            role="accountant",
            permissions=("erp:query:execute",),
            session_id="s1",
            auth_method=AuthMethod.JWT,
        )
    )
    assert_tenant_access(tenant_id="tenant-a", company_id="company-1")
    with pytest.raises(OipForbiddenError, match="cross_tenant"):
        assert_tenant_access(tenant_id="tenant-b")
    clear_security_context()


def test_credential_vault_encrypts_secrets():
    vault = CredentialVault(SecretProvider())
    encrypted = vault.encrypt_config({"api_key": "super-secret", "timeout_seconds": 30})
    assert encrypted["api_key"].startswith("enc:")
    decrypted = vault.decrypt_config(encrypted)
    assert decrypted["api_key"] == "super-secret"
    redacted = vault.redact_config(decrypted)
    assert redacted["api_key"] == "***"


@pytest.mark.asyncio
async def test_security_audit_enriches_payload(oip_container):
    sink = SqliteAuditSinkAdapter(oip_container.connection)
    audit = AuditService(sink)
    secured = SecurityAuditService(audit, oip_container.credential_vault)
    bind_principal(
        SecurityPrincipal(
            user_id="audit-user",
            tenant_id=TENANT_A,
            company_id="company-1",
            branch_id=None,
            role="auditor",
            permissions=("oip:audit:read",),
            session_id="s1",
            auth_method=AuthMethod.JWT,
        )
    )
    await secured.record(
        tenant_id=TENANT_A,
        request_id="req-1",
        correlation_id="corr-1",
        event_name="security.test",
        payload_redacted={"api_key": "hidden"},
    )
    chain = await secured.get_chain(tenant_id=TENANT_A, request_id="req-1")
    assert chain
    assert chain[0].payload_redacted["security"]["authenticated_user"] == "audit-user"
    assert chain[0].payload_redacted["api_key"] == "***"
    clear_security_context()


@pytest.mark.asyncio
async def test_rate_limiter_blocks_excess():
    limiter = RateLimiter(max_requests=3, window_seconds=60.0)
    assert limiter.check("client-a").allowed is True
    assert limiter.check("client-a").allowed is True
    assert limiter.check("client-a").allowed is True
    blocked = limiter.check("client-a")
    assert blocked.allowed is False
    assert blocked.retry_after_seconds >= 0


@pytest.mark.asyncio
async def test_security_events_recorded(oip_container):
    await oip_container.security_event_service.auth_failure(reason="bad_token", request_id="r1")
    cursor = await oip_container.connection.execute(
        "SELECT COUNT(*) AS cnt FROM oip_security_events WHERE event_type = 'auth_failure'"
    )
    row = await cursor.fetchone()
    assert row["cnt"] >= 1


@pytest.mark.asyncio
async def test_provider_settings_not_exposed_in_redaction(oip_container):
    vault = oip_container.credential_vault
    redacted = vault.redact_config(
        {
            "openai_api_key": "sk-test-secret",
            "anthropic_api_key": "ant-secret",
        }
    )
    assert redacted["openai_api_key"] == "***"


@pytest.mark.asyncio
async def test_secured_kernel_blocks_cross_tenant(tmp_path):
    db_path = tmp_path / "secured_kernel.db"
    settings = OipSettings(
        enabled=True,
        auth_required=True,
        database_url=f"sqlite+aiosqlite:///{db_path}",
        jwt_secret="secure-kernel-secret",
    )
    container = await build_container(settings)
    token = container.jwt_service.issue_access_token(
        user_id="user-1",
        tenant_id=TENANT_A,
        company_id="company-1",
        role="accountant",
        session_id="sess-1",
    )
    principal = await container.jwt_service.verify_access_token(token)
    bind_principal(principal)
    with pytest.raises(OipForbiddenError):
        await container.kernel.submit(
            IntelligenceRequestDto(
                request_id=str(uuid.uuid4()),
                correlation_id=str(uuid.uuid4()),
                idempotency_key="k1",
                tenant_id="other-tenant",
                company_id="company-1",
                user_id="user-1",
                session_id="sess-1",
                conversation_id="sess-1",
                module="orbix",
                question="hello",
            )
        )
    clear_security_context()
    await container.close()
    await shutdown_container()


@pytest.mark.asyncio
async def test_migration_security_tables_exist(oip_container):
    conn = oip_container.connection
    for table in ("oip_token_revocations", "oip_refresh_tokens", "oip_api_keys", "oip_security_events"):
        cursor = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        )
        assert await cursor.fetchone() is not None
