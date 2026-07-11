"""Security package exports."""

from .api_key_service import ApiKeyAuthError, ApiKeyService
from .credential_vault import CredentialVault
from .jwt_service import JwtAuthError, JwtService
from .permission_registry import PermissionRegistry, create_default_permission_registry
from .principal import AuthMethod, SecurityPrincipal
from .rate_limiter import RateLimiter
from .secret_provider import SecretProvider, get_secret_provider
from .security_event_service import SecurityEventService
from .session_context import bind_client_ip, bind_principal, clear_security_context, current_principal, require_principal
from .tenant_guard import assert_tenant_access, resolve_company_id, resolve_tenant_id, resolve_user_id

__all__ = (
    "ApiKeyAuthError",
    "ApiKeyService",
    "AuthMethod",
    "CredentialVault",
    "JwtAuthError",
    "JwtService",
    "PermissionRegistry",
    "RateLimiter",
    "SecretProvider",
    "SecurityEventService",
    "SecurityPrincipal",
    "assert_tenant_access",
    "bind_client_ip",
    "bind_principal",
    "clear_security_context",
    "create_default_permission_registry",
    "current_principal",
    "get_secret_provider",
    "require_principal",
    "resolve_company_id",
    "resolve_tenant_id",
    "resolve_user_id",
)
