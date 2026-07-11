"""Provider error taxonomy — mapped to FailureKind in pipeline."""

from __future__ import annotations


class ProviderError(Exception):
    retryable: bool = False
    error_code: str = "provider_unavailable"

    def __init__(self, message: str, *, error_code: str | None = None, retryable: bool | None = None) -> None:
        super().__init__(message)
        if error_code:
            self.error_code = error_code
        if retryable is not None:
            self.retryable = retryable


class ProviderRateLimitError(ProviderError):
    retryable = True
    error_code = "provider_throttled"


class ProviderTimeoutError(ProviderError):
    retryable = True
    error_code = "timeout"


class ProviderAuthError(ProviderError):
    retryable = False
    error_code = "provider_unavailable"


class ProviderModelError(ProviderError):
    retryable = False
    error_code = "provider_unavailable"


class ProviderNetworkError(ProviderError):
    retryable = True
    error_code = "provider_unavailable"
