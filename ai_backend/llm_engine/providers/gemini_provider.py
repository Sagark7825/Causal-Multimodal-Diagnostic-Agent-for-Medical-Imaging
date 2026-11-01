"""
Gemini Provider Implementation
===============================
Implements BaseLLMProvider for Google Gemini REST API (v1beta generateContent).
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


@register_provider("gemini", "google_gemini")
class GeminiProvider(BaseProvider):
    """
    Google Gemini LLM Provider using standard HTTP REST API (v1beta/models/{model}:generateContent).
    """

    def __init__(self, config: LLMConfig):
        super().__init__(config)

    def _get_api_key(self) -> str:
        if not self.config.api_key:
            raise InvalidAPIKey(
                "GEMINI_API_KEY environment variable is missing or empty. "
                "Please set GEMINI_API_KEY in your environment or .env file.",
                provider="gemini",
                model=self.config.model,
            )
        return self.config.api_key

    def _build_url(self, action: str = "generateContent") -> str:
        key = self._get_api_key()
        # Clean model name prefix if user provided e.g. "models/gemini-1.5-pro"
        model_name = self.config.model
        if not model_name.startswith("models/"):
            model_name = f"models/{model_name}"
        return f"{self.config.base_url}/{model_name}:{action}?key={key}"

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        """Single prompt generation."""
        contents = [{"role": "user", "parts": [{"text": prompt}]}]
        return self._send_generate_request(contents, system_prompt, temperature, max_tokens, **kwargs)

    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        """Multi-turn chat generation mapping standard roles to Gemini roles ('user' / 'model')."""
        system_prompt = None
        contents = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                system_prompt = content
            else:
                gemini_role = "model" if role in ("assistant", "model") else "user"
                contents.append({"role": gemini_role, "parts": [{"text": content}]})

        return self._send_generate_request(contents, system_prompt, temperature, max_tokens, **kwargs)

    def _send_generate_request(
        self,
        contents: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        url = self._build_url("generateContent")

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature if temperature is not None else self.config.temperature,
                "maxOutputTokens": max_tokens if max_tokens is not None else self.config.max_tokens,
                "candidateCount": kwargs.get("candidate_count", 1),
            },
        }

        # Inject extra kwargs into generationConfig
        for k, v in kwargs.items():
            if k not in ("candidate_count",):
                payload["generationConfig"][k] = v

        if system_prompt:
            payload["system_instruction"] = {"parts": [{"text": system_prompt}]}

        def _make_req():
            start_time = time.time()
            try:
                resp = requests.post(url, json=payload, timeout=self.config.timeout)
            except requests.exceptions.Timeout as e:
                raise LLMTimeout(f"Gemini request timed out after {self.config.timeout}s", provider="gemini", model=self.config.model, raw_error=e)
            except requests.exceptions.ConnectionError as e:
                raise LLMUnavailable(f"Cannot connect to Gemini endpoint at {self.config.base_url}", provider="gemini", model=self.config.model, raw_error=e)

            if resp.status_code != 200:
                self._handle_http_error(resp)

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise LLMResponseError("Gemini returned no candidates in response", provider="gemini", model=self.config.model)

            cand = candidates[0]
            parts = cand.get("content", {}).get("parts", [])
            text = "".join([p.get("text", "") for p in parts]).strip()

            elapsed_ms = (time.time() - start_time) * 1000.0
            usage = data.get("usageMetadata", {})
            tokens = {
                "prompt_tokens": usage.get("promptTokenCount", 0),
                "completion_tokens": usage.get("candidatesTokenCount", 0),
                "total_tokens": usage.get("totalTokenCount", 0),
            }

            finish_reason = cand.get("finishReason", "STOP").lower()

            self._log_request_success("generate", elapsed_ms, tokens)

            return LLMResponse(
                text=text,
                provider="gemini",
                model=self.config.model,
                latency_ms=elapsed_ms,
                tokens=tokens,
                finish_reason=finish_reason,
                metadata={"safetyRatings": cand.get("safetyRatings")},
            )

        return self._execute_with_retry(_make_req, "Gemini generate")

    def stream_generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> Iterator[str]:
        """Streams response tokens from Gemini streamGenerateContent endpoint."""
        url = self._build_url("streamGenerateContent")
        contents = [{"role": "user", "parts": [{"text": prompt}]}]
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature if temperature is not None else self.config.temperature,
                "maxOutputTokens": max_tokens if max_tokens is not None else self.config.max_tokens,
            },
        }
        if system_prompt:
            payload["system_instruction"] = {"parts": [{"text": system_prompt}]}

        try:
            resp = requests.post(url, json=payload, timeout=self.config.timeout, stream=True)
            if resp.status_code != 200:
                self._handle_http_error(resp)

            for line in resp.iter_lines():
                if line:
                    line_str = line.decode("utf-8").strip()
                    if line_str.startswith("[") or line_str.startswith(",") or line_str.startswith("]"):
                        line_str = line_str.lstrip("[,").rstrip("]")
                    if not line_str:
                        continue
                    try:
                        chunk = json.loads(line_str)
                        candidates = chunk.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            for p in parts:
                                txt = p.get("text", "")
                                if txt:
                                    yield txt
                    except json.JSONDecodeError:
                        pass
        except Exception as e:
            self._handle_raw_exception(e)

    def health_check(self) -> Dict[str, Any]:
        """Checks Gemini API key validity and model accessibility."""
        start_time = time.time()
        try:
            key = self._get_api_key()
            url = f"{self.config.base_url}/models?key={key}"
            resp = requests.get(url, timeout=5)
            elapsed_ms = (time.time() - start_time) * 1000.0

            if resp.status_code == 200:
                models_data = resp.json().get("models", [])
                model_names = [m.get("name", "") for m in models_data]
                is_avail = len(model_names) > 0

                return {
                    "provider": "gemini",
                    "model": self.config.model,
                    "available": is_avail,
                    "latency_ms": round(elapsed_ms, 2),
                    "version": "Google AI Studio v1beta API",
                    "details": {
                        "api_key_configured": bool(self.config.api_key),
                        "model_count": len(model_names),
                    },
                }
            else:
                return {
                    "provider": "gemini",
                    "model": self.config.model,
                    "available": False,
                    "latency_ms": round(elapsed_ms, 2),
                    "version": "Google AI Studio v1beta API",
                    "details": {"status_code": resp.status_code, "error": resp.text[:200]},
                }
        except Exception as e:
            return {
                "provider": "gemini",
                "model": self.config.model,
                "available": False,
                "latency_ms": round((time.time() - start_time) * 1000.0, 2),
                "version": "Google AI Studio v1beta API",
                "details": {"error": str(e)},
            }
