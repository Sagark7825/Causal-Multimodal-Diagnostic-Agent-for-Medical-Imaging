"""
Ollama Provider Implementation
================================
Implements BaseLLMProvider for local Ollama inference server (default model: qwen2.5).
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
    LLMUnavailable,
    ModelNotFound,
    LLMTimeout,
    LLMResponseError,
)

logger = logging.getLogger(__name__)


@register_provider("ollama")
class OllamaProvider(BaseProvider):
    """
    Ollama LLM Provider connecting to Ollama REST API.
    """

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.generate_url = f"{self.config.base_url}/api/generate"
        self.chat_url     = f"{self.config.base_url}/api/chat"
        self.tags_url     = f"{self.config.base_url}/api/tags"
        self._resolved_model: Optional[str] = None

    def _resolve_model_name(self) -> str:
        """Dynamically resolves configured model to exact tag installed on Ollama server."""
        if self._resolved_model:
            return self._resolved_model

        configured = self.config.model
        try:
            resp = requests.get(self.tags_url, timeout=3)
            if resp.status_code == 200:
                models = [m.get("name", "") for m in resp.json().get("models", [])]
                if configured in models:
                    self._resolved_model = configured
                    return configured
                base = configured.split(":")[0].lower()
                matching = [m for m in models if base in m.lower()]
                if matching:
                    logger.info(f"[OllamaProvider] Auto-resolved model tag '{configured}' -> '{matching[0]}'")
                    self._resolved_model = matching[0]
                    return matching[0]
                if models:
                    logger.warning(f"[OllamaProvider] Configured model '{configured}' not found. Using installed model '{models[0]}'")
                    self._resolved_model = models[0]
                    return models[0]
        except Exception as e:
            logger.debug(f"[OllamaProvider] Tags check failed: {e}")

        self._resolved_model = configured
        return configured

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        """Sends a single generation request to Ollama /api/generate."""
        active_model = self._resolve_model_name()
        payload = {
            "model": active_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature if temperature is not None else self.config.temperature,
                "num_predict": max_tokens if max_tokens is not None else self.config.max_tokens,
                "top_p": kwargs.get("top_p", 0.9),
                "top_k": kwargs.get("top_k", 40),
                "repeat_penalty": kwargs.get("repeat_penalty", 1.1),
            },
        }

        # Inject provider-specific option overrides if passed
        for k, v in kwargs.items():
            if k not in ("top_p", "top_k", "repeat_penalty"):
                payload["options"][k] = v

        if system_prompt:
            payload["system"] = system_prompt

        def _make_req():
            start_time = time.time()
            try:
                resp = requests.post(self.generate_url, json=payload, timeout=self.config.timeout)
            except requests.exceptions.Timeout as e:
                raise LLMTimeout(f"Ollama request timed out after {self.config.timeout}s", provider="ollama", model=self.config.model, raw_error=e)
            except requests.exceptions.ConnectionError as e:
                raise LLMUnavailable(f"Cannot connect to Ollama at {self.config.base_url}", provider="ollama", model=self.config.model, raw_error=e)

            if resp.status_code != 200:
                self._handle_http_error(resp)

            data = resp.json()
            text = data.get("response", "").strip()
            if not text:
                raise LLMResponseError("Ollama returned an empty response", provider="ollama", model=self.config.model)

            elapsed_ms = (time.time() - start_time) * 1000.0
            prompt_tokens = data.get("prompt_eval_count", 0)
            completion_tokens = data.get("eval_count", 0)
            tokens = {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            }

            self._log_request_success("generate", elapsed_ms, tokens)

            return LLMResponse(
                text=text,
                provider="ollama",
                model=data.get("model", self.config.model),
                latency_ms=elapsed_ms,
                tokens=tokens,
                finish_reason="stop" if data.get("done") else "length",
                metadata={"eval_duration": data.get("eval_duration")},
            )

        return self._execute_with_retry(_make_req, "Ollama generate")

    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        """Sends a multi-turn chat request to Ollama /api/chat."""
        active_model = self._resolve_model_name()
        payload = {
            "model": active_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature if temperature is not None else self.config.temperature,
                "num_predict": max_tokens if max_tokens is not None else self.config.max_tokens,
            },
        }

        def _make_req():
            start_time = time.time()
            try:
                resp = requests.post(self.chat_url, json=payload, timeout=self.config.timeout)
            except requests.exceptions.Timeout as e:
                logger.exception(f"[OllamaProvider] Ollama chat timed out after {self.config.timeout}s: {e}")
                raise LLMTimeout(f"Ollama chat timed out after {self.config.timeout}s", provider="ollama", model=active_model, raw_error=e)
            except requests.exceptions.ConnectionError as e:
                logger.exception(f"[OllamaProvider] Cannot connect to Ollama at {self.config.base_url}: {e}")
                raise LLMUnavailable(f"Cannot connect to Ollama at {self.config.base_url}", provider="ollama", model=active_model, raw_error=e)

            if resp.status_code != 200:
                self._handle_http_error(resp)

            data = resp.json()
            msg = data.get("message", {})
            text = msg.get("content", "").strip()
            if not text:
                raise LLMResponseError("Ollama chat returned an empty response", provider="ollama", model=active_model)

            elapsed_ms = (time.time() - start_time) * 1000.0
            prompt_tokens = data.get("prompt_eval_count", 0)
            completion_tokens = data.get("eval_count", 0)
            tokens = {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            }

            self._log_request_success("chat", elapsed_ms, tokens)

            return LLMResponse(
                text=text,
                provider="ollama",
                model=data.get("model", active_model),
                latency_ms=elapsed_ms,
                tokens=tokens,
                finish_reason="stop" if data.get("done") else "length",
                metadata=data,
            )

        return self._execute_with_retry(_make_req, "Ollama chat")

    def stream_generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> Iterator[str]:
        """Streams response tokens from Ollama /api/generate with stream=True."""
        active_model = self._resolve_model_name()
        payload = {
            "model": active_model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": temperature if temperature is not None else self.config.temperature,
                "num_predict": max_tokens if max_tokens is not None else self.config.max_tokens,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            resp = requests.post(self.generate_url, json=payload, timeout=self.config.timeout, stream=True)
            if resp.status_code != 200:
                self._handle_http_error(resp)

            for line in resp.iter_lines():
                if line:
                    chunk = json.loads(line.decode("utf-8"))
                    text = chunk.get("response", "")
                    if text:
                        yield text
        except Exception as e:
            self._handle_raw_exception(e)

    def health_check(self) -> Dict[str, Any]:
        """Checks if Ollama server is running and configured model is pulled."""
        start_time = time.time()
        try:
            resp = requests.get(self.tags_url, timeout=5)
            elapsed_ms = (time.time() - start_time) * 1000.0

            if resp.status_code != 200:
                return {
                    "provider": "ollama",
                    "model": self.config.model,
                    "available": False,
                    "latency_ms": elapsed_ms,
                    "version": "unknown",
                    "details": {"error": f"HTTP status {resp.status_code}"},
                }

            data = resp.json()
            available_models = [m.get("name", "") for m in data.get("models", [])]

            # Match base model name e.g. "qwen2.5" matching "qwen2.5:latest"
            model_base = self.config.model.split(":")[0].lower()
            matching = [m for m in available_models if model_base in m.lower()]
            is_avail = len(matching) > 0 or len(available_models) > 0

            return {
                "provider": "ollama",
                "model": matching[0] if matching else self.config.model,
                "available": is_avail,
                "latency_ms": round(elapsed_ms, 2),
                "version": "Ollama local API",
                "details": {
                    "configured_model": self.config.model,
                    "available_models": available_models,
                    "base_url": self.config.base_url,
                },
            }
        except Exception as e:
            return {
                "provider": "ollama",
                "model": self.config.model,
                "available": False,
                "latency_ms": round((time.time() - start_time) * 1000.0, 2),
                "version": "unknown",
                "details": {"error": str(e), "base_url": self.config.base_url},
            }
