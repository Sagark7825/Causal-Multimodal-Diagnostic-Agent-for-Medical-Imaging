"""
Base Provider Helper
====================
Provides shared utility functions for all provider implementations:
  - Standardized per-request logging (latency, tokens, errors)
  - Automatic exponential backoff retries for transient errors
  - Standardized error mapping from raw requests/HTTP exceptions
"""

import time
import logging
import requests
from typing import Callable, Any, Optional

from llm_engine.base import BaseLLMProvider, LLMResponse
from llm_engine.config import LLMConfig
from llm_engine.exceptions import (
    LLMException,
    LLMUnavailable,
    InvalidAPIKey,
    RateLimit,
    ModelNotFound,
    LLMTimeout,
    LLMResponseError,
)

logger = logging.getLogger(__name__)


class BaseProvider(BaseLLMProvider):
    """
    Abstract provider helper containing shared logging, retries, and error handling.
    """

    def _execute_with_retry(
        self,
        func: Callable[[], Any],
        operation_name: str = "request",
    ) -> Any:
        """
        Executes a function with exponential backoff retry for transient network / service errors.
        """
        max_retries = max(1, self.config.max_retries)
        last_exception = None
        start_time = time.time()

        for attempt in range(1, max_retries + 1):
            try:
                result = func()
                return result
            except (InvalidAPIKey, ModelNotFound) as non_retryable:
                # Do not retry auth errors or missing model errors
                raise non_retryable
            except (requests.exceptions.RequestException, LLMUnavailable, LLMTimeout, RateLimit) as e:
                last_exception = e
                elapsed = time.time() - start_time
                if attempt < max_retries:
                    sleep_time = (1.5 ** attempt) * 0.5
                    logger.warning(
                        f"[{self.config.provider.upper()}] {operation_name} failed (attempt {attempt}/{max_retries}): {e}. "
                        f"Retrying in {sleep_time:.2f}s..."
                    )
                    time.sleep(sleep_time)
                else:
                    logger.error(
                        f"[{self.config.provider.upper()}] {operation_name} failed after {max_retries} retries ({elapsed:.2f}s)."
                    )

        # If loop finished without returning, raise normalized exception
        if last_exception:
            self._handle_raw_exception(last_exception)
        raise LLMResponseError(f"{operation_name} failed after retries", provider=self.config.provider, model=self.config.model)

    def _handle_http_error(self, response: requests.Response):
        """Maps HTTP response status codes to standardized LLM exceptions."""
        status = response.status_code
        error_msg = f"HTTP {status}: {response.text[:300]}"

        if status == 401:
            raise InvalidAPIKey(f"Invalid API Key or unauthorized access: {error_msg}", provider=self.config.provider, model=self.config.model)
        elif status == 404:
            raise ModelNotFound(f"Model or endpoint not found: {error_msg}", provider=self.config.provider, model=self.config.model)
        elif status == 429:
            raise RateLimit(f"Rate limit or quota exceeded: {error_msg}", provider=self.config.provider, model=self.config.model)
        elif status in (502, 503, 504):
            raise LLMUnavailable(f"LLM service unavailable: {error_msg}", provider=self.config.provider, model=self.config.model)
        else:
            raise LLMResponseError(f"HTTP request error: {error_msg}", provider=self.config.provider, model=self.config.model)

    def _handle_raw_exception(self, e: Exception):
        """Translates raw requests exceptions to standardized LLM exceptions."""
        if isinstance(e, LLMException):
            raise e
        elif isinstance(e, requests.exceptions.Timeout):
            raise LLMTimeout(f"Request timed out after {self.config.timeout}s: {e}", provider=self.config.provider, model=self.config.model, raw_error=e)
        elif isinstance(e, requests.exceptions.ConnectionError):
            raise LLMUnavailable(f"Connection failed to provider endpoint '{self.config.base_url}': {e}", provider=self.config.provider, model=self.config.model, raw_error=e)
        elif isinstance(e, requests.exceptions.HTTPError) and getattr(e, "response", None) is not None:
            self._handle_http_error(e.response)
        else:
            raise LLMResponseError(f"Unexpected provider error: {e}", provider=self.config.provider, model=self.config.model, raw_error=e)

    def _log_request_success(self, operation: str, latency_ms: float, tokens: dict):
        """Logs standard request metrics."""
        logger.info(
            f"[{self.config.provider.upper()}] ✅ {operation} succeeded | "
            f"Model: {self.config.model} | Latency: {latency_ms:.1f}ms | "
            f"Tokens: Prompt={tokens.get('prompt_tokens', 0)}, Completion={tokens.get('completion_tokens', 0)}, Total={tokens.get('total_tokens', 0)}"
        )
