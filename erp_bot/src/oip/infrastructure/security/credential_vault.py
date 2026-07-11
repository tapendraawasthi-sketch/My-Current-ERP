"""Encrypt connector and provider credentials at rest."""

from __future__ import annotations

import base64
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from .secret_provider import SecretProvider

_SENSITIVE_KEYS = frozenset({"api_key", "connection_string", "password", "secret", "token"})


def _is_sensitive_field(field: str) -> bool:
    lowered = field.lower()
    return lowered in _SENSITIVE_KEYS or lowered.endswith("_api_key") or lowered.endswith("_secret")


class CredentialVault:
    def __init__(self, secret_provider: SecretProvider | None = None) -> None:
        provider = secret_provider or SecretProvider()
        raw = provider.get("OIP_CREDENTIAL_ENCRYPTION_KEY", "")
        if not raw:
            raw = hashlib.sha256(provider.get("OIP_JWT_SECRET", "dev-insecure-secret-change-me").encode()).digest()
            key = base64.urlsafe_b64encode(raw)
        else:
            key = raw.encode() if isinstance(raw, str) else raw
        self._fernet = Fernet(key)

    def encrypt_config(self, config: dict[str, Any]) -> dict[str, Any]:
        encrypted = dict(config)
        for field in config:
            if not _is_sensitive_field(field):
                continue
            value = encrypted.get(field)
            if isinstance(value, str) and value and not value.startswith("enc:"):
                token = self._fernet.encrypt(value.encode()).decode()
                encrypted[field] = f"enc:{token}"
        return encrypted

    def decrypt_config(self, config: dict[str, Any]) -> dict[str, Any]:
        decrypted = dict(config)
        for field in config:
            if not _is_sensitive_field(field):
                continue
            value = decrypted.get(field)
            if isinstance(value, str) and value.startswith("enc:"):
                token = value[4:].encode()
                try:
                    decrypted[field] = self._fernet.decrypt(token).decode()
                except InvalidToken:
                    decrypted[field] = ""
        return decrypted

    def redact_config(self, config: dict[str, Any]) -> dict[str, Any]:
        redacted = dict(config)
        for field in list(redacted.keys()):
            if not _is_sensitive_field(field):
                continue
            value = redacted.get(field)
            if isinstance(value, str) and value:
                redacted[field] = "***"
        metadata = redacted.get("metadata")
        if isinstance(metadata, dict):
            redacted["metadata"] = self.redact_config(metadata)
        return redacted

    @staticmethod
    def sanitize_for_audit(payload: dict[str, Any]) -> dict[str, Any]:
        return json.loads(json.dumps(CredentialVault(SecretProvider()).redact_config(payload)))
