"""
OpenAI Provider Implementation
===============================
Implements BaseLLMProvider for OpenAI REST API (Chat Completions).
"""

import json
import time
import requests
import logging
from typing import Dict, Any, List, Optional, Iterator

from llm_engine.base import register_provider, LLMResponse
from llm_engine.config import LLMConfig
from llm_engine.providers.base_provider import BaseProvider
from llm_engine.exceptions import (
    InvalidAPIKey,
    ModelNotFound,
    RateLimit,
    LLMUnavailable,
    LLMTimeout,
    LLMResponseError,
)

logger = logging.getLogger(__name__)


@register_provider("openai", "azure_openai")
class OpenAIProvider(BaseProvider):
    """
    OpenAI LLM Provider using standard HTTP REST API (/v1/chat/completions).
    """

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.completions_url = f"{self.config.base_url}/chat/completions"
        self.models_url      = f"{self.config.base_url}/models"

    def _get_headers(self) -> Dict[str, str]:
        if not self.config.api_key:
            raise InvalidAPIKey(
                "OPENAI_API_KEY environment variable is missing or empty. "
                "Please set OPENAI_API_KEY in your environment or .env file.",
                provider="openai",
                model=self.config.model,
            )
        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        """Single-prompt generation formatted as a chat completion."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        return self.chat(messages, temperature=temperature, max_tokens=max_tokens, **kwargs)

    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        """Sends a chat request to OpenAI /chat/completions."""
        headers = self._get_headers()

        payload = {
            "model": self.config.model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.config.temperature,
            "max_tokens": max_tokens if max_tokens is not None else self.config.max_tokens,
        }

        # Support extra kwargs e.g. top_p, frequency_penalty, presence_penalty
        for k, v in kwargs.items():
            payload[k] = v

        def _make_req():
            start_time = time.time()
            try:
                resp = requests.post(self.completions_url, headers=headers, json=payload, timeout=self.config.timeout)
            except requests.exceptions.Timeout as e:
                raise LLMTimeout(f"OpenAI request timed out after {self.config.timeout}s", provider="openai", model=self.config.model, raw_error=e)
            except requests.exceptions.ConnectionError as e:
                raise LLMUnavailable(f"Cannot connect to OpenAI endpoint at {self.config.base_url}", provider="openai", model=self.config.model, raw_error=e)

            if resp.status_code != 200:
                self._handle_http_error(resp)

            data = resp.json()
            choices = data.get("choices", [])
            if not choices:
                raise LLMResponseError("OpenAI returned no choices in response", provider="openai", model=self.config.model)

            choice = choices[0]
            text = choice.get("message", {}).get("content", "").strip()
            finish_reason = choice.get("finish_reason", "stop")

            elapsed_ms = (time.time() - start_time) * 1000.0
            usage = data.get("usage", {})
            tokens = {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            }

            self._log_request_success("chat", elapsed_ms, tokens)

            return LLMResponse(
                text=text,
                provider="openai",
                model=data.get("model", self.config.model),
                latency_ms=elapsed_ms,
                tokens=tokens,
                finish_reason=finish_reason,
                metadata={"id": data.get("id"), "system_fingerprint": data.get("system_fingerprint")},
            )

        return self._execute_with_retry(_make_req, "OpenAI chat")

    def stream_generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> Iterator[str]:
        """Streams response tokens from OpenAI SSE stream."""
        headers = self._get_headers()
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.config.model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.config.temperature,
            "max_tokens": max_tokens if max_tokens is not None else self.config.max_tokens,
            "stream": True,
        }

        try:
            resp = requests.post(self.completions_url, headers=headers, json=payload, timeout=self.config.timeout, stream=True)
            if resp.status_code != 200:
                self._handle_http_error(resp)

            for line in resp.iter_lines():
                if line:
                    line_str = line.decode("utf-8").strip()
                    if line_str.startswith("data: "):
                        data_content = line_str[6:].strip()
                        if data_content == "[DONE]":
                            break
                        chunk = json.loads(data_content)
                        choices = chunk.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
        except Exception as e:
            self._handle_raw_exception(e)

    def health_check(self) -> Dict[str, Any]:
        """Checks OpenAI API key validity and model accessibility."""
        start_time = time.time()
        try:
            headers = self._get_headers()
            resp = requests.get(self.models_url, headers=headers, timeout=5)
            elapsed_ms = (time.time() - start_time) * 1000.0

            if resp.status_code == 200:
                models_data = resp.json().get("data", [])
                model_ids = [m.get("id") for m in models_data]
                is_avail = self.config.model in model_ids or len(model_ids) > 0

                return {
                    "provider": "openai",
                    "model": self.config.model,
                    "available": is_avail,
                    "latency_ms": round(elapsed_ms, 2),
                    "version": "OpenAI v1 REST API",
                    "details": {
                        "api_key_configured": bool(self.config.api_key),
                        "model_count": len(model_ids),
                    },
                }
            else:
                return {
                    "provider": "openai",
                    "model": self.config.model,
                    "available": False,
                    "latency_ms": round(elapsed_ms, 2),
                    "version": "OpenAI v1 REST API",
                    "details": {"status_code": resp.status_code, "error": resp.text[:200]},
                }
        except Exception as e:
            return {
                "provider": "openai",
                "model": self.config.model,
                "available": False,
                "latency_ms": round((time.time() - start_time) * 1000.0, 2),
                "version": "OpenAI v1 REST API",
                "details": {"error": str(e)},
            }
