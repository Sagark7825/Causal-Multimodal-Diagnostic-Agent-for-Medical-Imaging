"""
Standardized LLM Exceptions
============================
Unified exception hierarchy for all LLM providers in the MedCausal AI Backend.

All provider-specific HTTP and API errors must be translated into these standard
exceptions so application code (agents, API routes, reasoning engine) never deals
with raw requests/SDK exceptions.
"""


class LLMException(Exception):
    """Base exception for all LLM provider errors."""
    def __init__(self, message: str, provider: str = "", model: str = "", raw_error: Exception = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.model = model
        self.raw_error = raw_error

    def __str__(self) -> str:
        ctx = f"[{self.provider}:{self.model}] " if self.provider else ""
        return f"{ctx}{self.message}"


class LLMUnavailable(LLMException, ConnectionError):
    """Raised when the LLM service endpoint is unreachable or down (e.g. 503, connection refused)."""
    pass


class InvalidAPIKey(LLMException):
    """Raised when API authentication fails (401 Unauthorized, invalid key)."""
    pass


class RateLimit(LLMException):
    """Raised when API rate limits or quota limits are exceeded (429 Too Many Requests)."""
    pass


class ModelNotFound(LLMException):
    """Raised when the requested model is not available or pulled (404 Not Found)."""
    pass


class LLMTimeout(LLMException, TimeoutError):
    """Raised when the request times out waiting for LLM response."""
    pass


class LLMResponseError(LLMException, ValueError):
    """Raised when the LLM returns a malformed, empty, or unparseable response."""
    pass


# Backward compatibility aliases
Timeout = LLMTimeout
